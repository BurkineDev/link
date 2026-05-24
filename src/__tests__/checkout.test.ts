/**
 * P0 — POST /api/checkout
 * TC-01 through TC-12
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable state read by the persistent mock — updated per test via setup()
// ---------------------------------------------------------------------------

let _shop: Record<string, unknown> | null = null;
let _products: Record<string, unknown>[] = [];
let _orderError: unknown = null;
let _reserveResult: { ok: boolean; reason?: string; product_name?: string; available?: number } = { ok: true };

const mockCreateClient = jest.fn().mockImplementation(async () => ({
  from: (table: string) => {
    if (table === "shops") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: _shop, error: _shop ? null : "not found" }),
          }),
        }),
      };
    }
    if (table === "products") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: _products, error: null }),
        }),
      };
    }
    if (table === "orders") {
      return {
        insert: () => ({
          select: () => ({
            single: () =>
              _orderError
                ? Promise.resolve({ data: null, error: _orderError })
                : Promise.resolve({ data: { id: ORDER_ID }, error: null }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    return {};
  },
  rpc: (fn: string) => {
    if (fn === "reserve_stock") {
      return Promise.resolve({ data: _reserveResult, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  },
}));

jest.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

// Admin client (subscription past_due check). Always returns no subscription.
const mockAdminClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  }),
};
jest.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => mockAdminClient,
}));

const mockCreateSession = jest.fn();
jest.mock("@/lib/stripe", () => ({
  getStripe: () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }
    return { checkout: { sessions: { create: mockCreateSession } } };
  },
  toStripeAmount: (amount: number, currency: string) =>
    ["XAF", "XOF"].includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100),
}));

import { POST } from "@/app/api/checkout/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// RFC 4122-compliant UUIDs (Zod v4 requires version [1-8] and variant [89ab])
const SHOP_ID    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const BASE_SHOP = {
  id: SHOP_ID,
  name: "Boutique Test",
  slug: "boutique-test",
  currency: "XOF",
  is_published: true,
  owner_id: "user-001",
};

const BASE_PRODUCT = {
  id: PRODUCT_ID,
  name: "Tissu wax",
  price: 5000,
  currency: "XOF",
  images: [{ url: "https://cdn.example.com/img.jpg" }],
  is_published: true,
  is_digital: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(opts: {
  shop?: typeof BASE_SHOP | null;
  products?: typeof BASE_PRODUCT[];
  orderError?: unknown;
  reserveResult?: { ok: boolean; reason?: string; product_name?: string; available?: number };
} = {}) {
  _shop = opts.shop !== undefined ? (opts.shop as Record<string, unknown> | null) : (BASE_SHOP as Record<string, unknown>);
  _products = (opts.products !== undefined ? opts.products : [BASE_PRODUCT]) as Record<string, unknown>[];
  _orderError = opts.orderError ?? null;
  _reserveResult = opts.reserveResult ?? { ok: true };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    shopId: SHOP_ID,
    buyerDetails: { full_name: "Kofi Mensah", email: "kofi@example.com", phone: "0022670000001" },
    shippingAddress: {
      full_name: "Kofi Mensah",
      address_line1: "Rue du Commerce 12",
      city: "Ouagadougou",
      country: "BF",
    },
    items: [{ product_id: PRODUCT_ID, quantity: 2, unit_price: BASE_PRODUCT.price }],
    paymentMethod: { type: "card" },
    currency: "XOF",
    ...overrides,
  };
}

function mockStripeOk(url = "https://checkout.stripe.com/c/pay/cs_test_123") {
  mockCreateSession.mockResolvedValueOnce({
    id: "cs_test_123",
    url,
  });
}

function mockStripeMissingUrl() {
  mockCreateSession.mockResolvedValueOnce({
    id: "cs_test_123",
    url: null,
  });
}

// ---------------------------------------------------------------------------
// Setup — reset state before each test, preserve mock implementation
// ---------------------------------------------------------------------------

beforeEach(() => {
  setup(); // reset to defaults
  mockCreateSession.mockReset();
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/checkout", () => {
  // TC-01 — happy path
  test("TC-01: valid payload returns paymentLink and orderId", async () => {
    mockStripeOk();

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("paymentLink");
    expect(json).toHaveProperty("orderId");
  });

  // TC-02 — price tampering: unit_price in body is ignored
  test("TC-02: client unit_price is ignored — DB price is used", async () => {
    mockStripeOk();

    const payload = validPayload({
      items: [{ product_id: PRODUCT_ID, quantity: 1, unit_price: 1 }],
    });
    await POST(makeRequest(payload));

    const stripeSession = mockCreateSession.mock.calls[0][0];
    expect(stripeSession.line_items[0].price_data.unit_amount).toBe(5000);
  });

  // TC-03 — boutique non publiée
  test("TC-03: unpublished shop returns 403", async () => {
    setup({ shop: { ...BASE_SHOP, is_published: false } });

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/pas encore ouverte/i);
  });

  // TC-04 — boutique inexistante
  test("TC-04: unknown shopId returns 404", async () => {
    setup({ shop: null });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(404);
  });

  // TC-05 — produit inconnu en DB
  test("TC-05: unknown product_id returns 400", async () => {
    setup({ products: [] });

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/introuvable/i);
  });

  // TC-06 — produit non publié
  test("TC-06: unpublished product returns 400", async () => {
    setup({ products: [{ ...BASE_PRODUCT, is_published: false }] });

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/indisponible/i);
  });

  // TC-07 — shopId non UUID
  test("TC-07: non-UUID shopId returns 400 with validation details", async () => {
    const res = await POST(makeRequest(validPayload({ shopId: "pas-un-uuid" })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty("details");
  });

  // TC-08 — items vide
  test("TC-08: empty items returns 400", async () => {
    const res = await POST(makeRequest(validPayload({ items: [] })));
    expect(res.status).toBe(400);
  });

  // TC-09 — quantity = 0
  test("TC-09: quantity 0 returns 400", async () => {
    const payload = validPayload({
      items: [{ product_id: PRODUCT_ID, quantity: 0, unit_price: 5000 }],
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  // TC-10 — STRIPE_SECRET_KEY absent
  test("TC-10: missing STRIPE_SECRET_KEY returns 500", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/configur/i);
  });

  // TC-11 — Stripe session without redirect URL
  test("TC-11: Stripe session without URL returns 502", async () => {
    mockStripeMissingUrl();

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(502);
  });

  // TC-12a — stock insuffisant
  test("TC-12a: insufficient stock returns 409", async () => {
    setup({
      reserveResult: {
        ok: false,
        reason: "insufficient_stock",
        product_name: "Tissu wax",
        available: 1,
      },
    });

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/stock/i);
  });

  // TC-12b — Mobile Money returns 503 when Genius Pay isn't configured
  test("TC-12b: mobile_money returns 503 when Genius Pay not configured", async () => {
    // No GENIUSPAY_* env vars set in beforeEach → isGeniusPayConfigured() → false
    const res = await POST(
      makeRequest(validPayload({ paymentMethod: { type: "mobile_money" } })),
    );
    expect(res.status).toBe(503);
  });

  // TC-12 — body non-JSON
  test("TC-12: non-JSON body returns 4xx or 500", async () => {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    const res = await POST(req);
    expect([400, 422, 500]).toContain(res.status);
  });
});
