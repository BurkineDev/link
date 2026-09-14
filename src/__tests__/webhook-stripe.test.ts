/**
 * P0 — POST /api/webhooks/stripe (order checkout path)
 *
 * Covers signature handling, payment confirmation, amount/currency guards,
 * idempotency, expiry (stock release + cancel), and unrelated events.
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable state read by the persistent mocks
//
// La fixture de commande reste en snake_case ; `toOrder` la traduit en ligne
// Prisma. Les appels à `settlePaidOrder` / `cancelUnpaidOrder` sont capturés
// sous la forme des anciens paramètres SQL (`p_*`) pour que les assertions
// existantes restent valables.
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = null;
let _orderError: unknown = null;
let _updateResult: unknown = null;
let _updateError: unknown = null;
let _releaseResult: unknown = null;
let _settleResult: unknown = null;

let _event: unknown = null;
let _constructThrows = false;

const toOrder = (o: Record<string, unknown>) => ({
  id: o.id,
  totalAmount: o.total_amount,
  currency: o.currency,
  paymentStatus: o.payment_status,
});

const mockModels = {
  order: {
    findUnique: jest.fn(async () => {
      if (_orderError) throw _orderError;
      return _order ? toOrder(_order) : null;
    }),
    update: jest.fn(async (args: { data: unknown }) => {
      _updateResult = args.data;
      if (_updateError) throw _updateError;
      return {};
    }),
  },
  creatorSubscription: {
    findFirst: jest.fn(async () => null),
    updateMany: jest.fn(async () => ({ count: 0 })),
    upsert: jest.fn(async () => ({})),
  },
  boostPurchase: {
    update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({ count: 0 })),
  },
  shop: { update: jest.fn(async () => ({})) },
};
const mockPrisma = {
  ...mockModels,
  $transaction: jest.fn(async (fn: (tx: typeof mockModels) => Promise<unknown>) => fn(mockModels)),
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRecordRefund = jest.fn<Promise<unknown>, unknown[]>(async () => ({ recorded: true, clawback: 95, refundedTotal: 100, full: false }));
const mockReverseChargeback = jest.fn<Promise<unknown>, unknown[]>(async () => ({ recorded: true, amount: 95 }));
jest.mock("@/lib/db/orders", () => ({
  recordOrderRefund: (...args: unknown[]) => mockRecordRefund(...args),
  reverseChargeback: (...args: unknown[]) => mockReverseChargeback(...args),
  settlePaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    _settleResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { settled: true };
  }),
  cancelUnpaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    _releaseResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { cancelled: true };
  }),
}));

// Keep fromStripeAmount real; only stub getStripe (signature verification).
jest.mock("@/lib/stripe", () => {
  const actual = jest.requireActual("@/lib/stripe");
  return {
    ...actual,
    getStripe: () => ({
      webhooks: {
        constructEvent: () => {
          if (_constructThrows) throw new Error("invalid signature");
          return _event;
        },
      },
      charges: {
        retrieve: jest.fn(async (id: string) => ({ id, metadata: { orderId: ORDER_ID } })),
      },
    }),
  };
});

const mockNotify = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: mockNotify,
}));

// Alertes fondateur : on vérifie ce qui est signalé, pas l'envoi lui-même.
const mockOps = { critical: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock("@/lib/ops/events", () => ({ ops: mockOps, recordOpsEvent: jest.fn(), recordOpsEventAfterResponse: jest.fn() }));

import { POST } from "@/app/api/webhooks/stripe/route";

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const ORDER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SESSION_ID = "cs_test_123";

function defaultOrder() {
  return {
    id: ORDER_ID,
    total_amount: 10000,
    currency: "XOF",
    payment_status: "pending",
    items: [{ product_id: "p-1", variant_id: "v-1", quantity: 2 }],
  };
}

function completedEvent(sessionOverrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: SESSION_ID,
        mode: "payment",
        payment_status: "paid",
        amount_total: 10000, // XOF is zero-decimal -> 10000 == 10000
        currency: "xof",
        metadata: { orderId: ORDER_ID },
        ...sessionOverrides,
      },
    },
  };
}

function expiredEvent(sessionOverrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.expired",
    data: {
      object: {
        id: SESSION_ID,
        mode: "payment",
        metadata: { orderId: ORDER_ID },
        ...sessionOverrides,
      },
    },
  };
}

function makeRequest(withSignature = true): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSignature) headers["stripe-signature"] = "sig-test-123";
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: JSON.stringify({ ignored: true }), // body is irrelevant; constructEvent is stubbed
  });
}

beforeEach(() => {
  _order = defaultOrder();
  _orderError = null;
  _updateResult = null;
  _updateError = null;
  _releaseResult = null;
  _settleResult = null;
  _event = completedEvent();
  _constructThrows = false;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mockNotify.mockClear();
  mockRecordRefund.mockClear();
  mockReverseChargeback.mockClear();
  mockOps.critical.mockClear();
  mockOps.warning.mockClear();
  mockOps.info.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/stripe", () => {
  test("missing stripe-signature header returns 400", async () => {
    const res = await POST(makeRequest(false));
    expect(res.status).toBe(400);
    expect(_updateResult).toBeNull();
  });

  test("missing STRIPE_WEBHOOK_SECRET returns 400", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.signature_rejected", dedupeKey: "webhook.signature_rejected:stripe", context: expect.objectContaining({ hasSecret: false }) }),
    );
  });

  test("invalid signature (constructEvent throws) returns 400", async () => {
    _constructThrows = true;
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(_updateResult).toBeNull();
    expect(mockOps.critical).toHaveBeenCalledWith(expect.objectContaining({ kind: "webhook.signature_rejected" }));
  });

  test("completed + paid confirms order and notifies seller", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_settleResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: SESSION_ID,
      p_payment_provider: "stripe",
    });
    expect(mockNotify).toHaveBeenCalledWith(ORDER_ID);
  });

  test("already-paid order is idempotent (no update, no notify)", async () => {
    if (_order) _order.payment_status = "paid";
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("paid session on a cancelled order: 200, nothing written, critical alert", async () => {
    if (_order) _order.payment_status = "failed";
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_settleResult).toBeNull();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.late_payment", dedupeKey: `webhook.late_payment:${ORDER_ID}` }),
    );
  });

  test("underpaid session does not confirm the order", async () => {
    _event = completedEvent({ amount_total: 5000 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.amount_mismatch", context: expect.objectContaining({ received: 5000, expected: 10000 }) }),
    );
  });

  test("currency mismatch does not confirm the order", async () => {
    _event = completedEvent({ currency: "usd" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("session not marked paid does not confirm the order", async () => {
    _event = completedEvent({ payment_status: "unpaid" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    // Rien d'encaissé : pas d'alerte.
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("missing orderId metadata returns 200 without update", async () => {
    _event = completedEvent({ metadata: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockOps.critical).toHaveBeenCalledWith(expect.objectContaining({ kind: "webhook.order_not_found" }));
  });

  test("unknown order returns 200 without update", async () => {
    _order = null;
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.order_not_found", dedupeKey: `webhook.order_not_found:stripe:${ORDER_ID}` }),
    );
  });

  test("expired session cancels order and releases stock", async () => {
    _event = expiredEvent();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_releaseResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: SESSION_ID,
      p_payment_provider: "stripe",
    });
  });

  test("unrelated event type is a 200 no-op", async () => {
    _event = { type: "payment_intent.succeeded", data: { object: {} } };
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });
  // Remboursements et litiges : contre-passation du net vendeur.
  test("charge.refunded contre-passe le net vendeur avec le cumul remboursé", async () => {
    _event = {
      type: "charge.refunded",
      data: { object: { id: "ch_1", amount_refunded: 5000, currency: "xof", metadata: { orderId: ORDER_ID } } },
    };
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockRecordRefund).toHaveBeenCalledWith(ORDER_ID, {
      amount: 5000,
      cumulative: true,
      reference: "ch_1:refund:5000",
      provider: "stripe",
    });
  });

  test("charge.refunded sans orderId est ignoré", async () => {
    _event = { type: "charge.refunded", data: { object: { id: "ch_2", amount_refunded: 5000, currency: "xof", metadata: {} } } };
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockRecordRefund).not.toHaveBeenCalled();
  });

  test("charge.dispute.created retient le montant contesté, charge.dispute.closed gagné le rend", async () => {
    _event = {
      type: "charge.dispute.created",
      data: { object: { id: "dp_1", charge: "ch_1", amount: 5000, currency: "xof", status: "needs_response" } },
    };
    expect((await POST(makeRequest())).status).toBe(200);
    expect(mockRecordRefund).toHaveBeenCalledWith(ORDER_ID, {
      amount: 5000,
      reference: "dp_1",
      provider: "stripe",
      kind: "chargeback",
    });
    // Un litige a une date limite de réponse : alerte immédiate.
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.dispute_opened", dedupeKey: "webhook.dispute:dp_1" }),
    );

    _event = {
      type: "charge.dispute.closed",
      data: { object: { id: "dp_1", charge: "ch_1", amount: 5000, currency: "xof", status: "won" } },
    };
    expect((await POST(makeRequest())).status).toBe(200);
    expect(mockReverseChargeback).toHaveBeenCalledWith(ORDER_ID, { reference: "dp_1", provider: "stripe" });

    _event = {
      type: "charge.dispute.closed",
      data: { object: { id: "dp_1", charge: "ch_1", amount: 5000, currency: "xof", status: "lost" } },
    };
    mockReverseChargeback.mockClear();
    expect((await POST(makeRequest())).status).toBe(200);
    expect(mockReverseChargeback).not.toHaveBeenCalled();
    expect(mockOps.critical).toHaveBeenCalledWith(expect.objectContaining({ kind: "webhook.dispute_lost" }));
  });

  test("handler error: 500 and a critical alert naming the event", async () => {
    _orderError = new Error("column does not exist");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.handler_error", dedupeKey: "webhook.handler_error:stripe:checkout.session.completed" }),
    );
  });
});
