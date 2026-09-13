/**
 * P0 — POST /api/checkout
 * TC-01 through TC-12
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable state read by the persistent mocks — updated per test via setup()
//
// Les fixtures restent en snake_case (forme historique des tests) ; les
// convertisseurs ci-dessous les traduisent en lignes Prisma (camelCase),
// pour que les cas de test n'aient pas à changer.
// ---------------------------------------------------------------------------

let _shop: Record<string, unknown> | null = null;
let _products: Record<string, unknown>[] = [];
let _variants: Record<string, unknown>[] = [];
let _orderError: unknown = null;
let _reserveResult: { ok: boolean; reason?: string; product_name?: string; available?: number } = { ok: true };
let _redeemResult: { ok: boolean; discount?: number; reason?: string } = { ok: true, discount: 0 };
let _zones: Array<{ countries: string[]; rate: number; freeAbove: number | null }> = [];

const toShop = (s: Record<string, unknown>) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  currency: s.currency,
  isPublished: s.is_published,
  ownerId: s.owner_id,
  shippingEnabled: s.shipping_enabled,
});

const toProduct = (p: Record<string, unknown>) => ({
  id: p.id,
  shopId: p.shop_id,
  name: p.name,
  price: p.price,
  currency: p.currency,
  images: p.images,
  isPublished: p.is_published,
  isDigital: p.is_digital,
  hasVariants: p.has_variants,
});

const toVariant = (v: Record<string, unknown>) => ({
  id: v.id,
  productId: v.product_id,
  name: v.name,
  price: v.price,
  sku: v.sku,
});

const mockPrisma = {
  shop: {
    findUnique: jest.fn(async () => (_shop ? toShop(_shop) : null)),
  },
  creatorSubscription: {
    findUnique: jest.fn(async () => null),
  },
  product: {
    findMany: jest.fn(async () => _products.map(toProduct)),
  },
  productVariant: {
    findMany: jest.fn(async () => _variants.map(toVariant)),
  },
  shippingZone: {
    findMany: jest.fn(async () => _zones),
  },
  order: {
    create: jest.fn(async () => {
      if (_orderError) throw _orderError;
      return { id: ORDER_ID };
    }),
    update: jest.fn(async () => ({})),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Les fonctions Postgres portées en TypeScript : on ne teste ici que la
// route, pas leur logique (elle a ses propres tests).
// Au passage en caisse, le stock est seulement vérifié : le prélèvement se
// fait au règlement (settlePaidOrder, mocké plus bas).
jest.mock("@/lib/db/stock", () => ({
  checkStockAvailability: jest.fn(async () => _reserveResult),
  reserveStock: jest.fn(async () => {
    throw new Error("reserveStock ne doit plus être appelé au passage en caisse");
  }),
  releaseStock: jest.fn(async () => {
    throw new Error("releaseStock ne doit plus être appelé au passage en caisse");
  }),
}));
jest.mock("@/lib/db/promo", () => ({
  redeemPromoCode: jest.fn(async () => _redeemResult),
  releasePromoRedemption: jest.fn(async () => undefined),
}));
jest.mock("@/lib/db/orders", () => ({
  settlePaidOrder: jest.fn(async () => ({ settled: true })),
  cancelUnpaidOrder: jest.fn(async () => ({ cancelled: true })),
}));

const mockCreateSession = jest.fn();
const mockCreateCoupon = jest.fn();
jest.mock("@/lib/stripe", () => ({
  getStripe: () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }
    return {
      checkout: { sessions: { create: mockCreateSession } },
      coupons: { create: mockCreateCoupon },
    };
  },
  toStripeAmount: (amount: number, currency: string) =>
    ["XAF", "XOF"].includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100),
}));

jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: jest.fn().mockResolvedValue(undefined),
}));

// Limitation de débit : laissée passante par défaut, un test la fait bloquer.
let _blockedResponse: Response | null = null;
jest.mock("@/lib/rate-limit", () => ({
  enforceLimits: jest.fn(async () => _blockedResponse),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));


import { POST } from "@/app/api/checkout/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// RFC 4122-compliant UUIDs (Zod v4 requires version [1-8] and variant [89ab])
const SHOP_ID    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const BASE_SHOP = {
  id: SHOP_ID,
  name: "Boutique Test",
  slug: "boutique-test",
  currency: "XOF",
  is_published: true,
  owner_id: "user-001",
  shipping_enabled: false,
};

const BASE_PRODUCT = {
  id: PRODUCT_ID,
  shop_id: SHOP_ID,
  name: "Tissu wax",
  price: 5000,
  currency: "XOF",
  images: [{ url: "https://cdn.example.com/img.jpg" }],
  is_published: true,
  is_digital: false,
  has_variants: false,
};

const BASE_VARIANT = {
  id: VARIANT_ID,
  product_id: PRODUCT_ID,
  name: "Bleu / XL",
  price: 7_500,
  sku: "WAX-BL-XL",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(opts: {
  shop?: typeof BASE_SHOP | null;
  products?: typeof BASE_PRODUCT[];
  variants?: typeof BASE_VARIANT[];
  orderError?: unknown;
  reserveResult?: { ok: boolean; reason?: string; product_name?: string; available?: number };
  redeemResult?: { ok: boolean; discount?: number; reason?: string };
} = {}) {
  _shop = opts.shop !== undefined ? (opts.shop as Record<string, unknown> | null) : (BASE_SHOP as Record<string, unknown>);
  _products = (opts.products !== undefined ? opts.products : [BASE_PRODUCT]) as Record<string, unknown>[];
  _variants = (opts.variants ?? []) as Record<string, unknown>[];
  _orderError = opts.orderError ?? null;
  _reserveResult = opts.reserveResult ?? { ok: true };
  _redeemResult = opts.redeemResult ?? { ok: true, discount: 0 };
  _zones = [];
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
  _blockedResponse = null;
  mockPrisma.order.create.mockClear();
  mockPrisma.shippingZone.findMany.mockClear();
  (jest.requireMock("@/lib/db/promo") as { redeemPromoCode: jest.Mock }).redeemPromoCode.mockClear();
  mockCreateSession.mockReset();
  mockCreateCoupon.mockReset();
  mockCreateCoupon.mockResolvedValue({ id: "coupon_order_123" });
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

  // TC-02 — prix du client ≠ prix en base : le prix en base fait foi, mais
  // la page est prévenue avant tout effet (ni promo consommée, ni commande).
  test("TC-02: un unit_price différent de la base → 409 PRICE_CHANGED avec les prix à jour, sans commande", async () => {
    const res = await POST(
      makeRequest(validPayload({ items: [{ product_id: PRODUCT_ID, quantity: 1, unit_price: 1 }], promoCode: "WAX10" })),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: expect.stringMatching(/prix .* changé/i),
      code: "PRICE_CHANGED",
      items: [{ product_id: PRODUCT_ID, variant_id: null, product_name: "Tissu wax", unit_price: 5000 }],
    });
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    const promo = jest.requireMock("@/lib/db/promo") as { redeemPromoCode: jest.Mock };
    expect(promo.redeemPromoCode).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("TC-02b: a selected variant uses its DB price and snapshot", async () => {
    setup({
      products: [{ ...BASE_PRODUCT, has_variants: true }],
      variants: [BASE_VARIANT],
    });
    mockStripeOk();

    const res = await POST(
      makeRequest(
        validPayload({
          items: [
            {
              product_id: PRODUCT_ID,
              variant_id: VARIANT_ID,
              quantity: 1,
              unit_price: 7_500,
            },
          ],
        }),
      ),
    );
    expect(res.status).toBe(200);

    const stripeSession = mockCreateSession.mock.calls[0][0];
    expect(stripeSession.line_items[0].price_data.unit_amount).toBe(7_500);
  });

  test("TC-02c: a variant from another product is rejected", async () => {
    setup({
      products: [{ ...BASE_PRODUCT, has_variants: true }],
      variants: [{ ...BASE_VARIANT, product_id: ORDER_ID }],
    });

    const res = await POST(
      makeRequest(
        validPayload({
          items: [
            {
              product_id: PRODUCT_ID,
              variant_id: VARIANT_ID,
              quantity: 1,
              unit_price: 7_500,
            },
          ],
        }),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/variante invalide/i);
  });

  test("TC-02d: a promo is applied to the Stripe session amount", async () => {
    setup({ redeemResult: { ok: true, discount: 2_000 } });
    mockStripeOk();

    await POST(makeRequest(validPayload({ promoCode: "PROMO20" })));

    expect(mockCreateCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_off: 2_000,
        currency: "xof",
        max_redemptions: 1,
      }),
      expect.objectContaining({ idempotencyKey: `order-discount-${ORDER_ID}` }),
    );
    expect(mockCreateSession.mock.calls[0][0].discounts).toEqual([
      { coupon: "coupon_order_123" },
    ]);
  });

  // TC-SH — livraison : même règle que la page de commande
  test("TC-SH1: la livraison de la zone s'ajoute au total et à la session Stripe", async () => {
    setup({ shop: { ...BASE_SHOP, shipping_enabled: true } });
    _zones = [{ countries: ["BF", "ML"], rate: 1_500, freeAbove: 50_000 }];
    mockStripeOk();

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
    const order = (mockPrisma.order.create.mock.calls[0] as unknown as [{ data: { shippingAmount: number; totalAmount: number } }])[0].data;
    expect(order.shippingAmount).toBe(1_500);
    expect(order.totalAmount).toBe(11_500);
    const stripeSession = mockCreateSession.mock.calls[0][0];
    const shippingLine = stripeSession.line_items.find(
      (line: { price_data: { product_data: { name: string } } }) => /livraison/i.test(line.price_data.product_data.name),
    );
    expect(shippingLine?.price_data.unit_amount).toBe(1_500);
    expect(mockPrisma.shippingZone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: SHOP_ID, isActive: true, currency: "XOF" } }),
    );
  });

  test("TC-SH2: gratuite au-dessus du seuil ; pays non desservi → 422 sans commande", async () => {
    setup({ shop: { ...BASE_SHOP, shipping_enabled: true } });
    _zones = [{ countries: ["BF"], rate: 1_500, freeAbove: 10_000 }];
    mockStripeOk();
    expect((await POST(makeRequest(validPayload()))).status).toBe(200);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
    expect((mockPrisma.order.create.mock.calls[0] as unknown as [{ data: { shippingAmount: number } }])[0].data.shippingAmount).toBe(0);

    mockPrisma.order.create.mockClear();
    const res = await POST(
      makeRequest(validPayload({ shippingAddress: { full_name: "Kofi Mensah", address_line1: "Rue du Commerce 12", city: "Dakar", country: "SN" } })),
    );
    const body = await res.json();
    expect([res.status, body]).toEqual([422, expect.objectContaining({ code: "SHIPPING_UNAVAILABLE" })]);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  test("TC-SH3: article physique sans adresse chez un vendeur qui livre → 422 SHIPPING_ADDRESS_REQUIRED", async () => {
    setup({ shop: { ...BASE_SHOP, shipping_enabled: true } });
    const res = await POST(makeRequest(validPayload({ shippingAddress: null })));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "SHIPPING_ADDRESS_REQUIRED" });
  });

  test("TC-MONEY: la remise est consommée dans la devise de la boutique, le total est arrondi à sa précision et les URL de retour portent la boutique", async () => {
    setup({ redeemResult: { ok: true, discount: 199.5 } });
    mockStripeOk();
    const res = await POST(makeRequest(validPayload({ promoCode: "DIX" })));
    expect(res.status).toBe(200);
    const promo = jest.requireMock("@/lib/db/promo") as { redeemPromoCode: jest.Mock };
    expect(promo.redeemPromoCode).toHaveBeenCalledWith(SHOP_ID, "DIX", 10_000, "XOF");
    const order = (mockPrisma.order.create.mock.calls[0] as unknown as [{ data: { totalAmount: number } }])[0].data;
    // 10 000 − 199,5 = 9 800,5 → 9 801 en XOF (0 décimale) : Stripe et Genius Pay ne connaissent pas le demi-franc.
    expect(order.totalAmount).toBe(9_801);
    const stripeSession = mockCreateSession.mock.calls[0][0];
    expect(stripeSession.cancel_url).toBe(`http://localhost:3000/checkout?shop=${SHOP_ID}&cancelled=1`);
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

  // TC-12c — Genius Pay règle en XOF : une boutique dans une autre devise
  // ne peut pas voir sa commande confirmée. On refuse AVANT toute réservation.
  test("TC-12c: mobile_money est refusé pour une boutique hors XOF, sans toucher au stock", async () => {
    process.env.GENIUSPAY_API_KEY = "k";
    process.env.GENIUSPAY_API_SECRET = "s";
    process.env.GENIUSPAY_WEBHOOK_SECRET = "w";
    setup({
      shop: { ...BASE_SHOP, currency: "XAF" },
      products: [{ ...BASE_PRODUCT, currency: "XAF" }],
    });
    const check = (jest.requireMock("@/lib/db/stock") as { checkStockAvailability: jest.Mock }).checkStockAvailability;
    check.mockClear();

    const res = await POST(
      makeRequest(validPayload({ currency: "XAF", paymentMethod: { type: "mobile_money" } })),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("MOBILE_MONEY_CURRENCY_UNSUPPORTED");
    expect(json.error).toMatch(/XAF/);
    expect(check).not.toHaveBeenCalled();

    delete process.env.GENIUSPAY_API_KEY;
    delete process.env.GENIUSPAY_API_SECRET;
    delete process.env.GENIUSPAY_WEBHOOK_SECRET;
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

  // TC-12d — le passage en caisse ne réserve plus rien : une seule
  // vérification, aucun prélèvement, aucune restitution.
  test("TC-12d: checkout only checks availability, never reserves or releases stock", async () => {
    const stock = jest.requireMock("@/lib/db/stock") as {
      checkStockAvailability: jest.Mock;
      reserveStock: jest.Mock;
      releaseStock: jest.Mock;
    };
    stock.checkStockAvailability.mockClear();
    mockCreateSession.mockResolvedValue({ id: "cs_test_ok", url: "https://checkout.stripe.com/pay/cs_test_ok" });

    const res = await POST(makeRequest(validPayload()));

    expect(res.status).toBe(200);
    expect(stock.checkStockAvailability).toHaveBeenCalledTimes(1);
    expect(stock.checkStockAvailability).toHaveBeenCalledWith(
      [{ product_id: PRODUCT_ID, variant_id: null, quantity: 2 }],
      { shopId: SHOP_ID },
    );
    expect(stock.reserveStock).not.toHaveBeenCalled();
    expect(stock.releaseStock).not.toHaveBeenCalled();
  });

  // TC-12e — stock insuffisant à la vérification : refus 409, sans écriture.
  test("TC-12e: insufficient stock at check time is a 409 with no reservation", async () => {
    setup({ reserveResult: { ok: false, reason: "insufficient_stock", product_name: "Tissu wax", available: 0 } });
    mockPrisma.order.create.mockClear();

    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/Tissu wax/);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  // TC-12f — l'insertion de la commande échoue : rien à rendre (aucun stock
  // prélevé), seul le code promo est relâché.
  test("TC-12f: order insert failure releases only the promo", async () => {
    setup({ orderError: new Error("db down"), redeemResult: { ok: true, discount: 500 } });
    const promo = jest.requireMock("@/lib/db/promo") as { releasePromoRedemption: jest.Mock };
    promo.releasePromoRedemption.mockClear();

    const res = await POST(makeRequest(validPayload({ promoCode: "WAX10" })));

    expect(res.status).toBe(500);
    expect(promo.releasePromoRedemption).toHaveBeenCalledWith(SHOP_ID, "WAX10");
  });

  // TC-RL — limitation de débit : refus avant toute lecture en base.
  test("TC-RL: rate limited request returns the 429 before touching the database", async () => {
    const { NextResponse } = jest.requireActual("next/server") as typeof import("next/server");
    _blockedResponse = NextResponse.json(
      { error: "Trop de requêtes." },
      { status: 429, headers: { "Retry-After": "42" } },
    );
    mockPrisma.shop.findUnique.mockClear();

    const res = await POST(makeRequest(validPayload()));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockPrisma.shop.findUnique).not.toHaveBeenCalled();
  });
});
