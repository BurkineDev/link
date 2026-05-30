import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocking DB, verifyWebhookSignature, and notifySellerOfPaidOrder
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = null;
let _orderError: unknown = null;
let _updateResult: unknown = null;
let _updateError: unknown = null;
let _rpcResult: unknown = null;
let _rpcError: unknown = null;

const mockAdminClient = {
  from: (table: string) => {
    if (table === "orders") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              _orderError
                ? Promise.resolve({ data: null, error: _orderError })
                : Promise.resolve({ data: _order, error: null }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: () => {
            _updateResult = payload;
            return Promise.resolve({ error: _updateError });
          },
        }),
      };
    }
    return {};
  },
  rpc: (fn: string, payload: unknown) => {
    if (fn === "release_stock") {
      _rpcResult = payload;
      return Promise.resolve({ error: _rpcError });
    }
    return Promise.resolve({ error: null });
  },
};

jest.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => mockAdminClient,
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
  notifySellerOfPaidOrder: mockNotifySellerOfPaidOrder,
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
    expect(_updateResult).toEqual({
      payment_status: "paid",
      status: "confirmed",
      payment_ref: REF_GP,
      payment_provider: "geniuspay",
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
    expect(_updateResult).toEqual({
      payment_status: "failed",
      status: "cancelled",
      payment_ref: REF_GP,
      payment_provider: "geniuspay",
    });
    expect(_rpcResult).toEqual({
      items: [
        { product_id: "p-001", variant_id: "v-001", quantity: 2 },
      ],
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
