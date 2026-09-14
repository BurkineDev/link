/**
 * recordOpsEvent : dédoublonnage, montée en gravité, accélérateur d'e-mail,
 * repli sans base, webhook sortant — et jamais d'exception.
 */

type Row = {
  id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string | null;
  context: unknown;
  dedupeKey: string | null;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  notifiedAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  createdAt: Date;
};

let _rows: Row[] = [];
let _dbDown = false;
let _seq = 0;
/** Simule la course perdue : la création échoue sur l'index unique partiel. */
let _raceOnCreate = false;

const failIfDown = () => {
  if (_dbDown) throw new Error("connect ETIMEDOUT");
};

const mockPrisma = {
  opsEvent: {
    findFirst: jest.fn(async ({ where }: { where: { dedupeKey: string; acknowledgedAt: null } }) => {
      failIfDown();
      return (
        _rows
          .filter((r) => r.dedupeKey === where.dedupeKey && r.acknowledgedAt === null)
          .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0] ?? null
      );
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      failIfDown();
      const row = _rows.find((r) => r.id === where.id)!;
      if (data.occurrences && typeof data.occurrences === "object") row.occurrences += 1;
      if (data.lastSeenAt) row.lastSeenAt = data.lastSeenAt as Date;
      if (data.title) row.title = data.title as string;
      if (data.kind) row.kind = data.kind as string;
      if (data.severity) row.severity = data.severity as Row["severity"];
      if (data.notifiedAt) row.notifiedAt = data.notifiedAt as Date;
      return row;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      failIfDown();
      if (_raceOnCreate) {
        _raceOnCreate = false;
        // L'autre appel vient de créer la ligne.
        _rows.push({
          id: `ev-${++_seq}`, kind: data.kind as string, severity: data.severity as Row["severity"], title: "autre",
          detail: null, context: null, dedupeKey: data.dedupeKey as string, occurrences: 1,
          firstSeenAt: data.firstSeenAt as Date, lastSeenAt: data.lastSeenAt as Date, notifiedAt: data.lastSeenAt as Date,
          acknowledgedAt: null, acknowledgedBy: null, createdAt: data.firstSeenAt as Date,
        });
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
      const row: Row = {
        id: `ev-${++_seq}`,
        kind: data.kind as string,
        severity: data.severity as Row["severity"],
        title: data.title as string,
        detail: (data.detail as string | null) ?? null,
        context: data.context ?? null,
        dedupeKey: data.dedupeKey as string,
        occurrences: 1,
        firstSeenAt: data.firstSeenAt as Date,
        lastSeenAt: data.lastSeenAt as Date,
        notifiedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        createdAt: data.firstSeenAt as Date,
      };
      _rows.push(row);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: { where: { id: string; acknowledgedAt: null }; data: Record<string, unknown> }) => {
      const row = _rows.find((r) => r.id === where.id && r.acknowledgedAt === null);
      if (!row) return { count: 0 };
      row.acknowledgedAt = data.acknowledgedAt as Date;
      row.acknowledgedBy = data.acknowledgedBy as string;
      return { count: 1 };
    }),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const _emails: Array<{ to: string; subject: string; idempotencyKey?: string }> = [];
let _emailDown = false;
jest.mock("@/lib/email", () => ({
  sendTransactionalEmail: jest.fn(async (m: { to: string; subject: string; idempotencyKey?: string }) => {
    if (_emailDown) throw new Error("Resend: invalid API key");
    _emails.push(m);
    return { skipped: false, id: "re_1" };
  }),
  escapeEmailHtml: (v: string) => v,
}));

const _webhookCalls: Array<{ url: string; body: unknown }> = [];
const fetchMock = jest.fn(async (url: string, init: { body: string }) => {
  _webhookCalls.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 200 } as Response;
});

import { acknowledgeOpsEvent, recordOpsEvent } from "@/lib/ops/events";

const T0 = new Date("2026-09-14T03:00:00Z");
const critical = (over: Record<string, unknown> = {}) => ({
  kind: "payment.late_after_cancel" as const,
  severity: "critical" as const,
  title: "Paiement tardif",
  context: { orderId: "o1" },
  dedupeKey: "payment.late_after_cancel:o1",
  ...over,
});

beforeEach(() => {
  _rows = [];
  _emails.length = 0;
  _webhookCalls.length = 0;
  _dbDown = false;
  _emailDown = false;
  _raceOnCreate = false;
  _seq = 0;
  process.env.ADMIN_EMAILS = "fondateur@bio-lien.test";
  process.env.VERCEL_ENV = "production";
  delete process.env.OPS_ALERT_WEBHOOK_URL;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VERCEL_ENV;
});

describe("recordOpsEvent", () => {
  test("un critique crée la ligne et envoie l'e-mail au fondateur, avec une clé d'idempotence", async () => {
    const res = await recordOpsEvent(critical(), { now: T0 });
    expect(res).toEqual({ id: "ev-1", persisted: true, occurrences: 1, notified: true });
    expect(_emails).toHaveLength(1);
    expect(_emails[0]!.to).toBe("fondateur@bio-lien.test");
    expect(_emails[0]!.subject).toBe("🔴 Bio-Lien : Paiement tardif");
    expect(_emails[0]!.idempotencyKey).toMatch(/^ops-alert\/payment\.late_after_cancel:o1\//);
    expect(_rows[0]!.notifiedAt).toEqual(T0);
  });

  test("même clé : la ligne est incrémentée, pas d'e-mail avant six heures, puis un nouveau", async () => {
    await recordOpsEvent(critical(), { now: T0 });
    const again = await recordOpsEvent(critical({ title: "Paiement tardif (2)" }), { now: new Date(T0.getTime() + 60_000) });
    expect(again).toMatchObject({ id: "ev-1", occurrences: 2, notified: false });
    expect(_rows).toHaveLength(1);
    expect(_rows[0]!.title).toBe("Paiement tardif (2)");
    expect(_emails).toHaveLength(1);

    const later = await recordOpsEvent(critical(), { now: new Date(T0.getTime() + 7 * 60 * 60 * 1000) });
    expect(later).toMatchObject({ occurrences: 3, notified: true });
    expect(_emails).toHaveLength(2);
  });

  test("un avertissement n'envoie rien tout de suite ; s'il devient critique, la ligne monte en gravité", async () => {
    await recordOpsEvent({ ...critical(), severity: "warning" }, { now: T0 });
    expect(_emails).toHaveLength(0);
    expect(_rows[0]!.severity).toBe("warning");
    await recordOpsEvent(critical(), { now: T0 });
    expect(_rows[0]!.severity).toBe("critical");
    expect(_emails).toHaveLength(1);
    // Et jamais l'inverse.
    await recordOpsEvent({ ...critical(), severity: "info" }, { now: T0 });
    expect(_rows[0]!.severity).toBe("critical");
  });

  test("une ligne traitée ne se rouvre pas : le problème suivant crée une nouvelle ligne", async () => {
    await recordOpsEvent(critical(), { now: T0 });
    expect(await acknowledgeOpsEvent("ev-1", "fondateur@bio-lien.test")).toBe(true);
    expect(await acknowledgeOpsEvent("ev-1", "fondateur@bio-lien.test")).toBe(false);
    const res = await recordOpsEvent(critical(), { now: new Date(T0.getTime() + 1000) });
    expect(res.id).toBe("ev-2");
    expect(_rows).toHaveLength(2);
    expect(_emails).toHaveLength(2);
  });

  test("base injoignable : rien n'est levé, l'e-mail part quand même avec une clé horaire, puis silence une heure", async () => {
    _dbDown = true;
    const res = await recordOpsEvent(critical(), { now: T0 });
    expect(res).toEqual({ id: null, persisted: false, occurrences: 1, notified: true });
    expect(_emails[0]!.idempotencyKey).toBe("ops-alert/payment.late_after_cancel:o1/2026-09-14T03/fondateur@bio-lien.test");
    // Sans base, la mémoire d'instance évite de mitrailler Resend.
    const again = await recordOpsEvent(critical(), { now: new Date(T0.getTime() + 10 * 60_000) });
    expect(again.notified).toBe(false);
    expect(_emails).toHaveLength(1);
    const later = await recordOpsEvent(critical(), { now: new Date(T0.getTime() + 61 * 60_000) });
    expect(later.notified).toBe(true);
  });

  test("course perdue à la création : la ligne gagnante est incrémentée, pas doublée, sans second e-mail", async () => {
    _raceOnCreate = true;
    const res = await recordOpsEvent(critical(), { now: T0 });
    expect(res).toMatchObject({ id: "ev-1", persisted: true, occurrences: 2, notified: false });
    expect(_rows).toHaveLength(1);
    expect(_emails).toHaveLength(0);
  });

  test("la famille et le titre suivent la dernière occurrence sur une même clé", async () => {
    await recordOpsEvent({ ...critical(), kind: "webhook.handler_error", title: "première" }, { now: T0 });
    await recordOpsEvent({ ...critical(), kind: "payment.amount_mismatch", title: "seconde" }, { now: T0 });
    expect(_rows).toHaveLength(1);
    expect(_rows[0]!.kind).toBe("payment.amount_mismatch");
    expect(_rows[0]!.title).toBe("seconde");
  });

  test("le contexte est borné : une valeur venue d'un tiers ne fait pas 50 Ko", async () => {
    await recordOpsEvent(critical({ context: { orderId: "o1", blob: "x".repeat(5000) } }), { now: T0 });
    const ctx = _rows[0]!.context as Record<string, string>;
    expect(ctx.orderId).toBe("o1");
    expect(ctx.blob.length).toBeLessThanOrEqual(201);
  });

  test("un envoi qui échoue date quand même la tentative : Resend n'est pas resollicité à chaque occurrence", async () => {
    _emailDown = true;
    await recordOpsEvent(critical(), { now: T0 });
    expect(_rows[0]!.notifiedAt).toEqual(T0);
    const again = await recordOpsEvent(critical(), { now: new Date(T0.getTime() + 60_000) });
    expect(again.notified).toBe(false);
  });

  test("e-mail mort : rien n'est levé, le webhook sortant prend le relais", async () => {
    _emailDown = true;
    process.env.OPS_ALERT_WEBHOOK_URL = "https://hooks.example.test/x";
    const res = await recordOpsEvent(critical(), { now: T0 });
    expect(res.notified).toBe(true);
    expect(_webhookCalls).toHaveLength(1);
    expect(_webhookCalls[0]!.url).toBe("https://hooks.example.test/x");
    expect((_webhookCalls[0]!.body as { text: string }).text).toContain("Paiement tardif");
  });

  test("sans ADMIN_EMAILS ni webhook, la ligne est écrite et rien ne part", async () => {
    process.env.ADMIN_EMAILS = "";
    const res = await recordOpsEvent(critical(), { now: T0 });
    expect(res).toMatchObject({ persisted: true, notified: false });
    expect(_emails).toHaveLength(0);
  });

  test("hors production, le sujet nomme l'environnement", async () => {
    process.env.VERCEL_ENV = "preview";
    await recordOpsEvent(critical(), { now: T0 });
    expect(_emails[0]!.subject).toBe("🔴 Bio-Lien [preview] : Paiement tardif");
  });

  test("plusieurs administrateurs reçoivent chacun l'alerte", async () => {
    process.env.ADMIN_EMAILS = "a@bio-lien.test, B@bio-lien.test";
    await recordOpsEvent(critical(), { now: T0 });
    expect(_emails.map((m) => m.to)).toEqual(["a@bio-lien.test", "b@bio-lien.test"]);
  });
});
