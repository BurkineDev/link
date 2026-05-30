/**
 * P0 — POST /api/webhooks/stripe (order checkout path)
 *
 * Covers signature handling, payment confirmation, amount/currency guards,
 * idempotency, expiry (stock release + cancel), and unrelated events.
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable state read by the persistent mocks
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = null;
let _orderError: unknown = null;
let _updateResult: unknown = null;
let _updateError: unknown = null;
let _releaseResult: unknown = null;

let _event: unknown = null;
let _constructThrows = false;

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
      _releaseResult = payload;
      return Promise.resolve({ error: null });
    }
    return Promise.resolve({ error: null });
  },
};

jest.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => mockAdminClient,
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
    }),
  };
});

const mockNotify = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/order-notifications", () => ({
  notifySellerOfPaidOrder: mockNotify,
}));

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
  _event = completedEvent();
  _constructThrows = false;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mockNotify.mockClear();
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
  });

  test("invalid signature (constructEvent throws) returns 400", async () => {
    _constructThrows = true;
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(_updateResult).toBeNull();
  });

  test("completed + paid confirms order and notifies seller", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toEqual({
      payment_status: "paid",
      status: "confirmed",
      payment_ref: SESSION_ID,
    });
    expect(mockNotify).toHaveBeenCalledWith(ORDER_ID);
  });

  test("already-paid order is idempotent (no update, no notify)", async () => {
    if (_order) _order.payment_status = "paid";
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  test("underpaid session does not confirm the order", async () => {
    _event = completedEvent({ amount_total: 5000 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
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
  });

  test("missing orderId metadata returns 200 without update", async () => {
    _event = completedEvent({ metadata: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("unknown order returns 200 without update", async () => {
    _order = null;
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("expired session cancels order and releases stock", async () => {
    _event = expiredEvent();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toEqual({
      payment_status: "failed",
      status: "cancelled",
      payment_ref: SESSION_ID,
    });
    expect(_releaseResult).toEqual({
      items: [{ product_id: "p-1", variant_id: "v-1", quantity: 2 }],
    });
  });

  test("unrelated event type is a 200 no-op", async () => {
    _event = { type: "payment_intent.succeeded", data: { object: {} } };
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });
});
