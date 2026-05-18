import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = (await import("@/lib/supabase/server")).createClient as unknown as ReturnType<typeof vi.fn>;

const { POST } = await import("@/app/api/checkout/route");
const { GET } = await import("@/app/api/checkout/verify/route");

type SupabaseRow = { data: unknown; error: unknown };

function buildMockSupabase(shopResult: SupabaseRow, productsResult: SupabaseRow, orderResult: SupabaseRow) {
  const shopQuery = {
    eq: vi.fn(() => ({
      single: vi.fn(async () => shopResult),
    })),
  };

  const productsQuery = {
    in: vi.fn(async () => productsResult),
  };

  const insertQuery = {
    select: vi.fn(() => ({
      single: vi.fn(async () => orderResult),
    })),
  };

  const updateQuery = {
    eq: vi.fn(async () => ({ data: null, error: null })),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === "shops") {
        return {
          select: vi.fn(() => shopQuery),
        };
      }

      if (table === "products") {
        return {
          select: vi.fn(() => productsQuery),
        };
      }

      if (table === "orders") {
        return {
          insert: vi.fn(() => insertQuery),
          update: vi.fn(() => updateQuery),
        };
      }

      return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) };
    }),
  };

  mockedCreateClient.mockReturnValue(client);

  return client;
}

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("Checkout API routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(crypto, "randomUUID").mockReturnValue("deposit-123");
    process.env.PAWAPAY_API_TOKEN = "test-token";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("creates an order and returns a PawaPay payment link", async () => {
    buildMockSupabase(
      { data: { id: "80d8e9f7-8116-44b1-91a9-a0d5d7699eb8", name: "Test Shop", slug: "test-shop", currency: "XOF", is_published: true, owner_id: "bb15d2b4-6435-4aa7-bb0d-f7fce8e9a4f3" }, error: null },
      { data: [{ id: "c85fe4b9-8cde-4444-aa8d-5c5dda5fd291", name: "Test product", price: 100, currency: "XOF", images: [{ url: "https://example.com/image.png", alt: "test", position: 0 }], is_published: true, is_digital: false }], error: null },
      { data: { id: "f3f7a0dc-0995-4bba-9a57-994764c6c22a" }, error: null },
    );

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ redirectUrl: "https://paywith.pawapay.io/session/test" }),
    });

    const response = await POST(
      buildRequest({
        shopId: "80d8e9f7-8116-44b1-91a9-a0d5d7699eb8",
        buyerDetails: {
          full_name: "Jean Dupont",
          email: "jean@example.com",
          phone: "+221770000000",
        },
        shippingAddress: {
          full_name: "Jean Dupont",
          address_line1: "123 Rue de Test",
          city: "Dakar",
          country: "SN",
          phone: "+221770000000",
        },
        items: [{ product_id: "c85fe4b9-8cde-4444-aa8d-5c5dda5fd291", variant_id: null, quantity: 1, unit_price: 100 }],
        paymentMethod: { type: "mobile_money" },
        currency: "XOF",
        notes: "Livraison rapide",
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.paymentLink).toBe("https://paywith.pawapay.io/session/test");
    expect(body.orderId).toBe("f3f7a0dc-0995-4bba-9a57-994764c6c22a");
  });

  it("verifies a completed PawaPay deposit and marks the order as paid", async () => {
    mockedCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "order-1",
                    shop_id: "shop-1",
                    total_amount: 100,
                    currency: "XOF",
                    payment_status: "pending",
                    status: "pending",
                    payment_provider: "pawapay",
                    items: [],
                    buyer_name: "Jean Dupont",
                    buyer_email: "jean@example.com",
                    buyer_phone: "+221770000000",
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: null, error: null })),
            })),
          };
        }

        if (table === "shops") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { name: "Test Shop", slug: "test-shop" },
                  error: null,
                })),
              })),
            })),
          };
        }

        return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) };
      }),
    });

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "FOUND",
        data: {
          status: "COMPLETED",
          amount: "100",
          currency: "XOF",
        },
      }),
    });

    const request = new Request("http://localhost/api/checkout/verify?tx_ref=deposit-123") as unknown as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order.payment_status).toBe("paid");
    expect(data.order.status).toBe("confirmed");
  });
});
