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
jest.mock("@/lib/ops/events", () => ({
  recordOpsEvent: jest.fn(async (input: Record<string, unknown>) => {
    _events.push(input);
    return { id: "ev", persisted: true, occurrences: 1, notified: false };
  }),
  ops: { critical: jest.fn(), warning: jest.fn(), info: jest.fn() },
  recordOpsEventAfterResponse: jest.fn(),
}));
const mockDigest = jest.fn(async () => ({ sent: 1, skipped: null }));
jest.mock("@/lib/ops/digest", () => ({ sendDailyDigest: (...args: unknown[]) => mockDigest(...(args as [])) }));

import { GET } from "@/app/api/cron/reconcile-orders/route";

function call(auth?: string) {
  return GET(
    new NextRequest("http://localhost:3000/api/cron/reconcile-orders", {
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

beforeEach(() => {
  _events.length = 0;
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

  test("mauvais secret : 401 et trace « à surveiller », sans rien exécuter", async () => {
    const res = await call("Bearer nope");
    expect(res.status).toBe(401);
    expect(_events).toEqual([expect.objectContaining({ kind: "cron.unauthorized", severity: "warning" })]);
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
    expect(mockDigest).toHaveBeenCalledWith({
      cron: { reconcile: _reconcile, payouts: { stale: 1, reminded: 1 }, manualOrders: { expired: 3, errors: 0 } },
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
