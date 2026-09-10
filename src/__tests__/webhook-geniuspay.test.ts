import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocking DB, verifyWebhookSignature, and notifySellerOfPaidOrder
//
// La fixture de commande reste en snake_case ; `toOrder` la traduit en ligne
// Prisma. Les appels à `settlePaidOrder` / `cancelUnpaidOrder` et la mise à
// jour de la commande sont capturés sous leur ancienne forme (`p_*`,
// `payment_ref`) pour que les assertions existantes restent valables.
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = null;
let _orderError: unknown = null;
let _updateResult: unknown = null;
let _updateError: unknown = null;
let _rpcResult: unknown = null;
let _rpcError: unknown = null;

const toOrder = (o: Record<string, unknown>) => ({
  id: o.id,
  totalAmount: o.total_amount,
  currency: o.currency,
  paymentStatus: o.payment_status,
});

const mockPrisma = {
  order: {
    findUnique: jest.fn(async () => {
      if (_orderError) throw _orderError;
      return _order ? toOrder(_order) : null;
    }),
    update: jest.fn(async (args: { data: { paymentRef?: unknown; paymentProvider?: unknown } }) => {
      _updateResult = {
        payment_ref: args.data.paymentRef,
        payment_provider: args.data.paymentProvider,
      };
      if (_updateError) throw _updateError;
      return {};
    }),
  },
  subscriptionPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
  boostPurchase: { updateMany: jest.fn(async () => ({ count: 0 })) },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

jest.mock("@/lib/db/orders", () => ({
  settlePaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    if (_rpcError) throw _rpcError;
    _rpcResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { settled: true };
  }),
  cancelUnpaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    if (_rpcError) throw _rpcError;
    _rpcResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { cancelled: true };
  }),
}));

jest.mock("@/lib/db/subscriptions", () => ({
  applySubscriptionPayment: jest.fn(async () => ({ applied: true })),
  applyBoostPayment: jest.fn(async () => ({ applied: true })),
}));

let _verifyResult = true;
jest.mock("@/lib/geniuspay", () => {
  const original = jest.requireActual("@/lib/geniuspay");
  return {
    ...original,
    verifyWebhookSignature: jest.fn().mockImplementation(() => _verifyResult),
  };
});

const mockNotifySellerOfPaidOrder = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: mockNotifySellerOfPaidOrder,
}));

import { POST } from "@/app/api/webhooks/geniuspay/route";

// ---------------------------------------------------------------------------
// Fixtures & Setup
// ---------------------------------------------------------------------------

const ORDER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REF_GP   = "GP-123456789";

function defaultOrderFixture() {
  return {
    id: ORDER_ID,
    total_amount: 10000,
    currency: "XOF",
    payment_status: "pending",
    items: [
      { product_id: "p-001", variant_id: "v-001", quantity: 2 },
    ],
  };
}

beforeEach(() => {
  _order = defaultOrderFixture();
  _orderError = null;
  _updateResult = null;
  _updateError = null;
  _rpcResult = null;
  _rpcError = null;
  _verifyResult = true;
  mockNotifySellerOfPaidOrder.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/geniuspay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": "sig-test-123",
      "x-webhook-timestamp": "1735587600",
      "x-webhook-event": headers["x-webhook-event"] ?? "payment.success",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "gp-evt-001",
    event: "payment.success",
    timestamp: 1735587600,
    data: {
      reference: REF_GP,
      status: "completed",
      amount: 10000,
      currency: "XOF",
      metadata: {
        orderId: ORDER_ID,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/geniuspay", () => {
  test("returns 401 if webhook signature verification fails", async () => {
    _verifyResult = false;
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(401);
  });

  test("returns 200 for webhook.test event even without details", async () => {
    const res = await POST(
      makeRequest(
        { event: "webhook.test", data: {} },
        { "x-webhook-event": "webhook.test" }
      )
    );
    expect(res.status).toBe(200);
  });

  test("returns 200 if metadata is missing orderId", async () => {
    const payload = validPayload();
    payload.data.metadata = {} as { orderId: string };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("returns 200 but does not update if order is already paid", async () => {
    if (_order) _order.payment_status = "paid";
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotifySellerOfPaidOrder).not.toHaveBeenCalled();
  });

  test("updates order and notifies seller on successful payment", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_rpcResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: REF_GP,
      p_payment_provider: "geniuspay",
    });
    expect(mockNotifySellerOfPaidOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  test("returns 200 but ignores update if currency mismatches", async () => {
    const payload = validPayload();
    payload.data.currency = "USD"; // Order has XOF
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("returns 200 but ignores update if amount is insufficient", async () => {
    const payload = validPayload();
    payload.data.amount = 5000; // Order has 10000
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("releases stock and cancels order on failed payment", async () => {
    const payload = validPayload({ event: "payment.failed" });
    payload.data.status = "failed";
    const res = await POST(
      makeRequest(payload, { "x-webhook-event": "payment.failed" })
    );

    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_rpcResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: REF_GP,
      p_payment_provider: "geniuspay",
    });
  });

  test("updates reference and returns 200 on pending/processing states", async () => {
    const payload = validPayload({ event: "payment.initiated" });
    payload.data.status = "processing";
    const res = await POST(
      makeRequest(payload, { "x-webhook-event": "payment.initiated" })
    );

    expect(res.status).toBe(200);
    expect(_updateResult).toEqual({
      payment_ref: REF_GP,
      payment_provider: "geniuspay",
    });
  });
});
