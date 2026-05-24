/**
 * P0 — GET /api/checkout/verify?session_id=xxx
 * TC-13 through TC-20
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = BASE_ORDER_DEFAULT();

function BASE_ORDER_DEFAULT() {
  return {
    id: "order-001",
    shop_id: "shop-001",
    total_amount: 5000,
    currency: "XOF",
    payment_status: "pending",
    status: "pending",
    items: [],
    buyer_name: "Kofi",
    buyer_email: "kofi@example.com",
  };
}

const mockCreateClient = jest.fn().mockImplementation(async () => ({
  from: (table: string) => {
    if (table === "orders") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: _order, error: null }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    if (table === "shops") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { name: "Boutique Test", slug: "boutique-test" }, error: null }),
          }),
        }),
      };
    }
    return {};
  },
}));

jest.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

const mockRetrieveSession = jest.fn();
jest.mock("@/lib/stripe", () => ({
  getStripe: () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }
    return { checkout: { sessions: { retrieve: mockRetrieveSession } } };
  },
  fromStripeAmount: (amount: number | null, currency: string) => {
    if (amount === null) return null;
    return ["XAF", "XOF"].includes(currency.toUpperCase()) ? amount : amount / 100;
  },
}));

import { GET } from "@/app/api/checkout/verify/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(sessionId?: string): NextRequest {
  const url = sessionId
    ? `http://localhost:3000/api/checkout/verify?session_id=${sessionId}`
    : "http://localhost:3000/api/checkout/verify";
  return new NextRequest(url);
}

function mockStripeSession(s: {
  payment_status: string;
  status: string;
  amount_total: number | null;
  currency: string;
}) {
  mockRetrieveSession.mockResolvedValueOnce({
    id: "cs_test_123",
    ...s,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _order = BASE_ORDER_DEFAULT();
  mockRetrieveSession.mockReset();
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/checkout/verify", () => {
  const SESSION_ID = "cs_test_123";

  // TC-13 — paid + montant correct → confirmation
  test("TC-13: paid session confirms order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.order.payment_status).toBe("paid");
    expect(json.order.status).toBe("confirmed");
  });

  // TC-14 — idempotence : déjà paid → Stripe non appelé
  test("TC-14: already paid order returns 200 without calling Stripe", async () => {
    _order = { ...BASE_ORDER_DEFAULT(), payment_status: "paid" };

    const res = await GET(makeRequest(SESSION_ID));

    expect(res.status).toBe(200);
    expect(mockRetrieveSession).not.toHaveBeenCalled();
  });

  // TC-15 — expired → 400
  test("TC-15: expired session returns 400", async () => {
    mockStripeSession({ payment_status: "unpaid", status: "expired", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/échoué/i);
  });

  // TC-16 — open/unpaid → 202
  test("TC-16: open unpaid session returns 202", async () => {
    mockStripeSession({ payment_status: "unpaid", status: "open", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    expect(res.status).toBe(202);
  });

  // TC-17 — session_id manquant
  test("TC-17: missing session_id returns 400", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/session_id/i);
  });

  // TC-18 — session_id inconnu en DB
  test("TC-18: unknown session_id returns 404", async () => {
    _order = null;

    const res = await GET(makeRequest("unknown-session"));
    expect(res.status).toBe(404);
  });

  // TC-19 — montant insuffisant → ne pas confirmer
  test("TC-19: underpaid session does not confirm order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 100, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));

    if (res.status === 200) {
      const json = await res.json();
      expect(json.order?.payment_status).not.toBe("paid");
    } else {
      expect(res.status).toBe(400);
    }
  });

  // TC-20 — devise différente → ne pas confirmer
  test("TC-20: currency mismatch session does not confirm order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "ghs" });

    const res = await GET(makeRequest(SESSION_ID));

    if (res.status === 200) {
      const json = await res.json();
      expect(json.order?.payment_status).not.toBe("paid");
    } else {
      expect(res.status).toBe(400);
    }
  });
});
