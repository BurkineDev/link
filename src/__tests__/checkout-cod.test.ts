/**
 * POST /api/checkout — paiement à la livraison.
 *
 * Une commande COD naît « en attente », comme une commande WhatsApp : pas
 * de passerelle, rien de payé, donc rien de prélevé (une requête anonyme
 * ne vide pas le stock d'une boutique). Seul le vendeur est prévenu ; sa
 * confirmation rendra la commande ferme. L'option n'est acceptée que si
 * le vendeur l'offre, pour un colis qui part vraiment quelque part.
 */

import { NextRequest } from "next/server";

const SHOP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let _shop: Record<string, unknown> | null = null;
let _zones: Array<{ countries: string[]; rate: number; freeAbove: number | null }> = [];
let _reserveResult: { ok: boolean; reason?: string; product_name?: string; available?: number } = { ok: true };
let _checkResult: { ok: boolean; reason?: string; product_name?: string; available?: number } = { ok: true };
let _updateError: unknown = null;

const mockPrisma = {
  shop: { findUnique: jest.fn(async () => _shop) },
  creatorSubscription: { findUnique: jest.fn(async () => null) },
  product: {
    findMany: jest.fn(async () => [
      {
        id: PRODUCT_ID,
        shopId: SHOP_ID,
        name: "Tissu wax",
        price: 5000,
        currency: "XOF",
        images: [],
        isPublished: true,
        isDigital: false,
        hasVariants: false,
      },
    ]),
  },
  productVariant: { findMany: jest.fn(async () => []) },
  shippingZone: { findMany: jest.fn(async () => _zones) },
  order: {
    // Les paramètres typés servent à relire `mock.calls` sans cast.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({ id: ORDER_ID })),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update: jest.fn(async (_args: { data: Record<string, unknown> }) => {
      if (_updateError) throw _updateError;
      return {};
    }),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockReserve = jest.fn(async () => _reserveResult);
const mockRelease = jest.fn(async () => undefined);
jest.mock("@/lib/db/stock", () => ({
  checkStockAvailability: jest.fn(async () => _checkResult),
  reserveStock: (...args: unknown[]) => mockReserve(...(args as [])),
  releaseStock: (...args: unknown[]) => mockRelease(...(args as [])),
}));
jest.mock("@/lib/db/promo", () => ({
  redeemPromoCode: jest.fn(async () => ({ ok: true, discount: 0 })),
  releasePromoRedemption: jest.fn(async () => undefined),
}));
const mockCancelUnpaid = jest.fn(async () => ({ cancelled: true }));
jest.mock("@/lib/db/orders", () => ({
  settlePaidOrder: jest.fn(async () => ({ settled: true })),
  cancelUnpaidOrder: (...args: unknown[]) => mockCancelUnpaid(...(args as [])),
}));
jest.mock("@/lib/stripe", () => ({
  getStripe: () => {
    throw new Error("Stripe ne doit pas être appelé pour une commande COD");
  },
  toStripeAmount: (amount: number) => amount,
}));
const mockNotifyCod = jest.fn(async () => undefined);
jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: jest.fn(async () => undefined),
  notifyCashOnDeliveryOrder: (...args: unknown[]) => mockNotifyCod(...(args as [])),
}));
jest.mock("@/lib/rate-limit", () => ({
  enforceLimits: jest.fn(async () => null),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));

import { POST } from "@/app/api/checkout/route";

const BASE_SHOP = {
  id: SHOP_ID,
  name: "Boutique Test",
  slug: "boutique-test",
  currency: "XOF",
  isPublished: true,
  ownerId: "user-001",
  shippingEnabled: true,
  cashOnDelivery: true,
};

function setup(opts: {
  shop?: Partial<typeof BASE_SHOP>;
  zones?: typeof _zones;
  reserveResult?: typeof _reserveResult;
  checkResult?: typeof _checkResult;
  updateError?: unknown;
} = {}) {
  _shop = { ...BASE_SHOP, ...opts.shop };
  _zones = opts.zones ?? [{ countries: ["BF"], rate: 1500, freeAbove: null }];
  _reserveResult = opts.reserveResult ?? { ok: true };
  _checkResult = opts.checkResult ?? { ok: true };
  _updateError = opts.updateError ?? null;
  jest.clearAllMocks();
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    shopId: SHOP_ID,
    buyerDetails: { full_name: "Kofi Mensah", email: "kofi@example.com", phone: "0022670000001" },
    shippingAddress: {
      full_name: "Kofi Mensah",
      address_line1: "Rue du Commerce 12",
      city: "Ouagadougou",
      country: "BF",
    },
    items: [{ product_id: PRODUCT_ID, quantity: 2, unit_price: 5000 }],
    paymentMethod: { type: "cash_on_delivery" },
    currency: "XOF",
    ...overrides,
  };
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("POST /api/checkout — paiement à la livraison", () => {
  it("enregistre une commande en attente : rien de prélevé, statut inchangé, vendeur prévenu", async () => {
    setup();
    const res = await post(payload());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("cash_on_delivery");
    expect(body.orderId).toBe(ORDER_ID);
    expect(body.paymentLink).toContain(`/checkout/success?provider=cash_on_delivery&order=${ORDER_ID}`);

    // Créée avec le fournisseur COD, les frais de zone inclus, l'article marqué physique.
    const created = mockPrisma.order.create.mock.calls[0]![0];
    expect(created.data.paymentProvider).toBe("cash_on_delivery");
    expect(created.data.shippingAmount).toBe(1500);
    expect(created.data.totalAmount).toBe(11_500);
    const items = created.data.items as Array<{ product_snapshot: { is_digital?: boolean } }>;
    expect(items[0]!.product_snapshot.is_digital).toBe(false);

    // Ni prélèvement ni confirmation à la caisse : c'est au vendeur de le faire.
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockPrisma.order.update).not.toHaveBeenCalled();

    await flush();
    expect(mockNotifyCod).toHaveBeenCalledWith(ORDER_ID);
    expect(mockCancelUnpaid).not.toHaveBeenCalled();
  });

  it("refuse (400 COD_UNAVAILABLE) quand le vendeur ne l'offre pas", async () => {
    setup({ shop: { cashOnDelivery: false } });
    const res = await post(payload());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("COD_UNAVAILABLE");
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it("refuse quand la boutique ne livre pas (frais non calculables)", async () => {
    setup({ shop: { shippingEnabled: false } });
    const res = await post(payload());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("COD_UNAVAILABLE");
  });

  it("refuse un panier sans article à livrer", async () => {
    setup();
    mockPrisma.product.findMany.mockResolvedValueOnce([
      {
        id: PRODUCT_ID,
        shopId: SHOP_ID,
        name: "E-book",
        price: 5000,
        currency: "XOF",
        images: [],
        isPublished: true,
        isDigital: true,
        hasVariants: false,
      },
    ]);
    const res = await post(payload());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("COD_UNAVAILABLE");
  });

  it("refuse un pays hors zone avant même de parler de COD (422 SHIPPING_UNAVAILABLE)", async () => {
    setup({ zones: [{ countries: ["CI"], rate: 2000, freeAbove: null }] });
    const res = await post(payload());
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SHIPPING_UNAVAILABLE");
  });

  it("vérifie tout de même le stock en lecture (409) : pas de commande pour un article épuisé", async () => {
    setup({ checkResult: { ok: false, reason: "insufficient_stock", product_name: "Tissu wax", available: 1 } });
    const res = await post(payload());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Tissu wax/);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it("ne réserve rien pour un paiement par carte (le stock part au règlement)", async () => {
    setup();
    // Stripe est mocké pour lever : on vérifie seulement que la branche COD
    // n'est pas prise et que rien n'a été prélevé.
    const res = await post(payload({ paymentMethod: { type: "card" } }));
    expect(res.status).not.toBe(200);
    expect(mockReserve).not.toHaveBeenCalled();
  });
});
