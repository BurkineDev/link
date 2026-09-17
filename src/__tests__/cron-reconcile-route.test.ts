/**
 * GET /api/cron/reconcile-orders — le seul cron : authentification, les
 * trois étapes, le battement de cœur `cron.run`, le rapport quotidien, et
 * un 500 quand une étape a levé (Vercel Cron montre alors l'échec).
 */

import { NextRequest } from "next/server";

let _reconcile = { checked: 2, paid: 1, failed: 0, stillPending: 1, errors: 0 };
let _payoutsThrow = false;
let _expireThrow = false;

jest.mock("@/lib/orders/reconcile", () => ({
  reconcilePendingGeniusPayOrders: jest.fn(async () => _reconcile),
}));
jest.mock("@/lib/payouts/notifications", () => ({
  remindStalePayouts: jest.fn(async () => {
    if (_payoutsThrow) throw new Error("neon down");
    return { stale: 1, reminded: 1 };
  }),
}));
jest.mock("@/lib/orders/expire-manual", () => ({
  expireStaleManualOrders: jest.fn(async () => {
    if (_expireThrow) throw new Error("neon down");
    return { expired: 3, errors: 0 };
  }),
}));

const _events: Array<Record<string, unknown>> = [];
let _previousRuns: Array<Record<string, unknown> | null> = [];
const _acknowledged: Array<{ kinds: string[]; by: string }> = [];
jest.mock("@/lib/ops/events", () => ({
  recordOpsEvent: jest.fn(async (input: Record<string, unknown>) => {
    _events.push(input);
    return { id: "ev", persisted: true, occurrences: 1, notified: false };
  }),
  ops: { critical: jest.fn(), warning: jest.fn(), info: jest.fn() },
  recordOpsEventAfterResponse: jest.fn(),
  purgeOpsEvents: jest.fn(async () => 0),
  // Comme la base : les battements de cœur déjà écrits par ce test (du plus
  // récent au plus ancien) précèdent la mémoire simulée — une route qui
  // écrirait cron.run AVANT de sonder se verrait donc elle-même.
  recentCronRunContexts: jest.fn(async () => [
    ..._events.filter((e) => e.kind === "cron.run").map((e) => e.context as Record<string, unknown>).reverse(),
    ..._previousRuns,
  ]),
  acknowledgeOpsEventsByKind: jest.fn(async (kinds: readonly string[], by: string) => {
    _acknowledged.push({ kinds: [...kinds], by });
    return kinds.length;
  }),
}));

// La sonde TikTok : le réseau est remplacé, la lecture de la réponse et la
// règle de bascule restent les vraies (voir ops-tiktok-link.test.ts).
let _tiktokStatus: "direct" | "interstitial" | "blocked" | "unknown" = "interstitial";
jest.mock("@/lib/ops/tiktok-link", () => {
  const real = jest.requireActual("@/lib/ops/tiktok-link");
  return {
    ...real,
    probeTikTokLink: jest.fn(async () => ({
      status: _tiktokStatus,
      target: real.TIKTOK_PROBE_TARGET,
      httpStatus: _tiktokStatus === "direct" ? 302 : _tiktokStatus === "unknown" ? null : 200,
      location: _tiktokStatus === "direct" ? real.TIKTOK_PROBE_TARGET : null,
      error: _tiktokStatus === "unknown" ? "fetch failed" : null,
    })),
  };
});
const mockDigest = jest.fn(async () => ({ sent: 1, skipped: null }));
jest.mock("@/lib/ops/digest", () => ({ sendDailyDigest: (...args: unknown[]) => mockDigest(...(args as [])) }));

import { GET } from "@/app/api/cron/reconcile-orders/route";

function call(auth?: string, userAgent?: string) {
  return GET(
    new NextRequest("http://localhost:3000/api/cron/reconcile-orders", {
      headers: { ...(auth ? { authorization: auth } : {}), ...(userAgent ? { "user-agent": userAgent } : {}) },
    }),
  );
}

beforeEach(() => {
  _events.length = 0;
  _previousRuns = [];
  _acknowledged.length = 0;
  _tiktokStatus = "interstitial";
  _reconcile = { checked: 2, paid: 1, failed: 0, stillPending: 1, errors: 0 };
  _payoutsThrow = false;
  _expireThrow = false;
  process.env.CRON_SECRET = "s3cret";
  mockDigest.mockClear();
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("GET /api/cron/reconcile-orders", () => {
  test("sans CRON_SECRET : 503 et alerte critique", async () => {
    delete process.env.CRON_SECRET;
    const res = await call("Bearer x");
    expect(res.status).toBe(503);
    expect(_events).toEqual([expect.objectContaining({ kind: "cron.not_configured", severity: "critical" })]);
    expect(mockDigest).not.toHaveBeenCalled();
  });

  test("mauvais secret : 401 ; un robot ne laisse rien, Vercel Cron refusé est critique", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect((await call(undefined, "Mozilla/5.0 scanner")).status).toBe(401);
    expect(_events).toEqual([]);
    expect((await call("Bearer nope", "vercel-cron/1.0")).status).toBe(401);
    expect(_events).toEqual([expect.objectContaining({ kind: "cron.unauthorized", severity: "critical" })]);
    expect(mockDigest).not.toHaveBeenCalled();
  });

  test("passage normal : 200, battement de cœur enregistré, rapport envoyé avec le résumé", async () => {
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ checked: 2, paid: 1, payouts: { stale: 1, reminded: 1 }, manual_orders: { expired: 3 }, ok: true, digest: { sent: 1 } });
    const run = _events.find((e) => e.kind === "cron.run");
    expect(run).toMatchObject({ severity: "info", context: expect.objectContaining({ reconcile: _reconcile, payouts: { stale: 1, reminded: 1 } }) });
    expect(_events.some((e) => e.kind === "cron.step_failed")).toBe(false);
    const tiktok = { status: "interstitial", target: "https://www.bio-lien.com/", httpStatus: 200, location: null, error: null };
    expect(body.tiktok).toEqual(tiktok);
    expect(run?.context).toMatchObject({ tiktok });
    expect(mockDigest).toHaveBeenCalledWith({
      cron: { reconcile: _reconcile, payouts: { stale: 1, reminded: 1 }, manualOrders: { expired: 3, errors: 0 }, tiktok },
    });
  });

  describe("sonde TikTok", () => {
    test("l'écran, comme hier : aucune alerte, rien n'est marqué traité", async () => {
      _previousRuns = [{ tiktok: { status: "interstitial" } }];
      await call("Bearer s3cret");
      expect(_events.map((e) => e.kind)).toEqual(["cron.run"]);
      expect(_acknowledged).toEqual([]);
    });

    test("le domaine passe (302) : une alerte « ouvre directement », les alertes inverses marquées traitées, le battement de cœur le garde", async () => {
      _tiktokStatus = "direct";
      _previousRuns = [{ tiktok: { status: "unknown" } }, { tiktok: { status: "interstitial" } }];
      const res = await call("Bearer s3cret");
      expect(res.status).toBe(200);
      expect(_events.find((e) => e.kind === "tiktok.link_direct")).toMatchObject({
        severity: "warning",
        dedupeKey: "tiktok.link_direct",
        context: expect.objectContaining({ httpStatus: 302, previous: "interstitial" }),
      });
      expect(_acknowledged).toEqual([{ kinds: ["tiktok.link_interstitial", "tiktok.link_blocked"], by: "sonde TikTok" }]);
      expect(_events.find((e) => e.kind === "cron.run")?.context).toMatchObject({ tiktok: { status: "direct" } });
    });

    test("déjà direct hier : pas de nouvelle alerte ; l'écran qui revient : alerte « remet l'écran »", async () => {
      _tiktokStatus = "direct";
      _previousRuns = [{ tiktok: { status: "direct" } }];
      await call("Bearer s3cret");
      expect(_events.map((e) => e.kind)).toEqual(["cron.run"]);

      // Le passage suivant relit le battement de cœur que le précédent vient d'écrire.
      _previousRuns = [];
      _tiktokStatus = "interstitial";
      await call("Bearer s3cret");
      expect(_events.map((e) => e.kind)).toEqual(["cron.run", "tiktok.link_interstitial", "cron.run"]);
      expect(_acknowledged).toEqual([{ kinds: ["tiktok.link_direct", "tiktok.link_blocked"], by: "sonde TikTok" }]);
    });

    test("page de blocage : alerte critique, e-mail immédiat via recordOpsEvent", async () => {
      _tiktokStatus = "blocked";
      _previousRuns = [{ tiktok: { status: "interstitial" } }];
      await call("Bearer s3cret");
      expect(_events.find((e) => e.kind === "tiktok.link_blocked")).toMatchObject({ severity: "critical" });
      expect(_acknowledged).toEqual([{ kinds: ["tiktok.link_direct", "tiktok.link_interstitial"], by: "sonde TikTok" }]);
    });

    test("TikTok injoignable : rien à conclure, le passage réussit quand même", async () => {
      _tiktokStatus = "unknown";
      _previousRuns = [{ tiktok: { status: "direct" } }];
      const res = await call("Bearer s3cret");
      expect(res.status).toBe(200);
      expect(_events.map((e) => e.kind)).toEqual(["cron.run"]);
      expect((await res.json()).tiktok).toMatchObject({ status: "unknown", error: "fetch failed" });
    });
  });

  test("une étape qui lève : le passage continue, 500 pour Vercel, alerte critique, rapport quand même", async () => {
    _payoutsThrow = true;
    _expireThrow = true;
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, payouts: { stale: -1 }, manual_orders: { expired: -1 } });
    expect(_events.find((e) => e.kind === "cron.step_failed")).toMatchObject({
      severity: "critical",
      context: expect.objectContaining({ steps: ["relance des reversements", "expiration des commandes hors ligne"] }),
    });
    expect(_events.some((e) => e.kind === "cron.run")).toBe(true);
    expect(mockDigest).toHaveBeenCalled();
  });
});
