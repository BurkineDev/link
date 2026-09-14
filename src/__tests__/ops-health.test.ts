/**
 * getHealth : base, migrations embarquées vs appliquées, cron muet, alertes
 * ouvertes — et la règle « 503 dès que l'une des trois premières est mauvaise ».
 */

let _dbDown = false;
let _applied: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }> = [];
let _lastRun: Date | null = null;
let _critical = 0;

const mockPrisma = {
  $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
    if (_dbDown) throw new Error("connect ETIMEDOUT");
    const sql = strings.join("?");
    if (sql.includes("_prisma_migrations")) return _applied;
    return [{ "?column?": 1 }];
  }),
  opsEvent: {
    findFirst: jest.fn(async () => (_lastRun ? { createdAt: _lastRun } : null)),
    count: jest.fn(async ({ where }: { where: { severity: string } }) => (where.severity === "critical" ? _critical : 0)),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const NOW = new Date("2026-09-14T03:00:00Z");
const EMBEDDED = ["20260901000000_init", "20260914020000_ops_events"];

// La liste embarquée est lue au chargement du module (Next l'inline au
// build) : elle doit être posée AVANT l'import.
process.env.PRISMA_MIGRATIONS = EMBEDDED.join(",");
type Health = typeof import("@/lib/ops/health");
let getHealth: Health["getHealth"];
beforeAll(async () => {
  ({ getHealth } = await import("@/lib/ops/health"));
});

beforeEach(() => {
  _dbDown = false;
  _applied = EMBEDDED.map((name) => ({ migration_name: name, finished_at: new Date("2026-09-13T00:00:00Z"), rolled_back_at: null }));
  _lastRun = new Date("2026-09-13T03:10:00Z");
  _critical = 0;
  process.env.VERCEL_ENV = "production";
  process.env.RESEND_API_KEY = "re_x";
  process.env.EMAIL_FROM = "Bio-Lien <no-reply@bio-lien.test>";
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VERCEL_ENV;
});

describe("getHealth", () => {
  test("tout va bien", async () => {
    const h = await getHealth({ now: NOW });
    expect(h.ok).toBe(true);
    expect(h.database.ok).toBe(true);
    expect(h.migrations).toMatchObject({ ok: true, pending: [], latest: "20260914020000_ops_events", embedded: 2 });
    expect(h.cron).toEqual({ lastRunAt: "2026-09-13T03:10:00.000Z", stale: false, enforced: true });
    expect(h.email.configured).toBe(true);
  });

  test("migration embarquée mais absente en base : ok = false et son nom est donné (incident du 13/09)", async () => {
    _applied = _applied.slice(0, 1);
    const h = await getHealth({ now: NOW });
    expect(h.ok).toBe(false);
    expect(h.migrations.pending).toEqual(["20260914020000_ops_events"]);
  });

  test("base injoignable : ok = false, message, migrations et cron non évalués", async () => {
    _dbDown = true;
    const h = await getHealth({ now: NOW });
    expect(h.ok).toBe(false);
    expect(h.database).toMatchObject({ ok: false, latencyMs: null });
    expect(h.database.error).toContain("ETIMEDOUT");
    expect(h.migrations.ok).toBe(false);
    expect(h.cron.lastRunAt).toBeNull();
  });

  test("cron muet depuis plus de 26 h : ko en production, seulement signalé ailleurs", async () => {
    _lastRun = new Date("2026-09-12T20:00:00Z");
    expect((await getHealth({ now: NOW })).ok).toBe(false);
    process.env.VERCEL_ENV = "preview";
    const preview = await getHealth({ now: NOW });
    expect(preview.ok).toBe(true);
    expect(preview.cron).toMatchObject({ stale: true, enforced: false });
  });

  test("les alertes critiques ouvertes sont comptées sans dégrader ok", async () => {
    _critical = 2;
    const h = await getHealth({ now: NOW });
    expect(h.ok).toBe(true);
    expect(h.alerts.openCritical).toBe(2);
  });

});
