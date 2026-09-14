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
    count: jest.fn(async ({ where }: { where: { severity?: string; kind?: string } }) => (where.severity === "critical" ? _critical : 0)),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const _recorded: Array<Record<string, unknown>> = [];
jest.mock("@/lib/ops/events", () => ({
  recordOpsEvent: jest.fn(async (input: Record<string, unknown>) => {
    _recorded.push(input);
    return { id: "ev", persisted: true, occurrences: 1, notified: true };
  }),
}));

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
  _recorded.length = 0;
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
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.ok).toBe(true);
    expect(h.database.ok).toBe(true);
    expect(h.migrations).toMatchObject({ ok: true, pending: [], latest: "20260914020000_ops_events", embedded: 2 });
    expect(h.cron).toEqual({ lastRunAt: "2026-09-13T03:10:00.000Z", stale: false, enforced: true });
    expect(h.email.configured).toBe(true);
  });

  test("migration embarquée mais absente en base : ok = false, son nom est donné, et le journal l'enregistre (incident du 13/09)", async () => {
    _applied = _applied.slice(0, 1);
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.ok).toBe(false);
    expect(h.migrations.pending).toEqual(["20260914020000_ops_events"]);
    expect(_recorded).toEqual([
      expect.objectContaining({ kind: "health.migration_drift", severity: "critical", dedupeKey: "health.migration_drift" }),
    ]);
  });

  test("cron jamais exécuté : en retard 26 h après l'installation du journal, pas avant", async () => {
    _lastRun = null;
    _applied = EMBEDDED.map((name) => ({ migration_name: name, finished_at: new Date("2026-09-13T20:00:00Z"), rolled_back_at: null }));
    expect((await getHealth({ now: NOW, fresh: true })).cron.stale).toBe(false);
    _applied = EMBEDDED.map((name) => ({ migration_name: name, finished_at: new Date("2026-09-12T20:00:00Z"), rolled_back_at: null }));
    const late = await getHealth({ now: NOW, fresh: true });
    expect(late.cron).toMatchObject({ lastRunAt: null, stale: true });
    expect(late.ok).toBe(false);
  });

  test("un canal e-mail mort dégrade la santé (c'est le seul chemin qui ne passe pas par l'e-mail)", async () => {
    mockPrisma.opsEvent.count.mockImplementation(async ({ where }: { where: { kind?: string; severity?: string } }) =>
      where.kind === "email.dead" ? 1 : 0,
    );
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.email.dead).toBe(true);
    expect(h.ok).toBe(false);
    mockPrisma.opsEvent.count.mockImplementation(async ({ where }: { where: { severity?: string } }) =>
      where.severity === "critical" ? _critical : 0,
    );
  });

  test("le résultat est mis en cache 20 s par instance", async () => {
    const first = await getHealth({ now: NOW, fresh: true });
    _dbDown = true;
    const second = await getHealth({ now: new Date(NOW.getTime() + 5000) });
    expect(second).toBe(first);
    const third = await getHealth({ now: new Date(NOW.getTime() + 30_000) });
    expect(third.database.ok).toBe(false);
  });

  test("base injoignable : ok = false, message sans hôte, migrations et cron non évalués, alerte par le repli", async () => {
    _dbDown = true;
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.ok).toBe(false);
    expect(h.database).toMatchObject({ ok: false, latencyMs: null });
    expect(h.database.error).toContain("ETIMEDOUT");
    expect(h.migrations.ok).toBe(false);
    expect(h.cron.lastRunAt).toBeNull();
    expect(_recorded).toEqual([expect.objectContaining({ kind: "health.db_unreachable", severity: "critical" })]);
  });

  test("le message public ne nomme ni hôte ni port", async () => {
    mockPrisma.$queryRaw.mockImplementationOnce(async () => {
      throw Object.assign(new Error("\nCan't reach database server at `ep-dawn-tree-b2sxokvu.c-6.eu-central-1.aws.neon.tech:5432`"), { code: "P1001" });
    });
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.database.error).toBe("P1001 Can't reach database server at …");
  });

  test("cron muet depuis plus de 26 h : ko en production, seulement signalé ailleurs", async () => {
    _lastRun = new Date("2026-09-12T20:00:00Z");
    expect((await getHealth({ now: NOW, fresh: true })).ok).toBe(false);
    process.env.VERCEL_ENV = "preview";
    const preview = await getHealth({ now: NOW, fresh: true });
    expect(preview.ok).toBe(true);
    expect(preview.cron).toMatchObject({ stale: true, enforced: false });
  });

  test("les alertes critiques ouvertes sont comptées sans dégrader ok", async () => {
    _critical = 2;
    const h = await getHealth({ now: NOW, fresh: true });
    expect(h.ok).toBe(true);
    expect(h.alerts.openCritical).toBe(2);
  });

});
