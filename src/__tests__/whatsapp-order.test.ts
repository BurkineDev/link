/**
 * Commandes WhatsApp enregistrées : message, route publique, marquage payé.
 */

import { NextRequest } from "next/server";
import { formatWhatsAppOrderMessage, orderReference, whatsAppUrl } from "@/lib/orders/whatsapp-order";

// ---- doubles ---------------------------------------------------------------

let _shop: Record<string, unknown> | null = null;
let _products: Array<Record<string, unknown>> = [];
let _variants: Array<Record<string, unknown>> = [];
let _created: Record<string, unknown> | null = null;
let _stock: { ok: boolean; reason?: string; product_name?: string; available?: number } = { ok: true };
let _user: { id: string } | null = null;
let _existing: Record<string, unknown> | null = null;

const ORDER_ID = "0f8a7b6c-1111-4222-8333-444455556666";
const mockPrisma = {
  shop: { findUnique: jest.fn(async () => _shop) },
  product: { findMany: jest.fn(async () => _products) },
  productVariant: { findMany: jest.fn(async () => _variants) },
  order: {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      _created = data;
      return { id: ORDER_ID, trackingToken: "tok-abc" };
    }),
    findUnique: jest.fn(async () => _existing),
    findUniqueOrThrow: jest.fn(async () => ({
      id: ORDER_ID, shopId: "s", customerId: null, buyerEmail: null, buyerName: "Client WhatsApp", buyerPhone: null,
      status: "confirmed", paymentStatus: "paid", paymentProvider: "manual", paymentRef: "manual:x", totalAmount: 5000,
      shippingAmount: 0, currency: "XOF", items: [], shippingAddress: null, notes: null, promoCode: null, discountAmount: 0,
      trackingToken: "tok-abc", stockShortfall: null, createdAt: new Date(), updatedAt: new Date(),
    })),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/db/stock", () => ({ checkStockAvailability: jest.fn(async () => _stock) }));
jest.mock("@/lib/rate-limit", () => ({ enforceLimits: jest.fn(async () => null), getClientIp: () => "203.0.113.7" }));
jest.mock("@/lib/auth", () => ({ getCurrentUser: jest.fn(async () => _user) }));
const mockSettle = jest.fn(async () => ({ settled: true as const, customerId: null, commission: 0, plan: "free" as const, stockShortfall: [], offline: true }));
jest.mock("@/lib/db/orders", () => ({ settlePaidOrder: (...args: unknown[]) => mockSettle(...(args as [])) }));

import { POST as createWhatsAppOrder } from "@/app/api/orders/whatsapp/route";
import { POST as markPaid } from "@/app/api/orders/[id]/mark-paid/route";

const SHOP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function post(body: unknown) {
  return createWhatsAppOrder(
    new NextRequest("http://localhost:3000/api/orders/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  _shop = { id: SHOP_ID, name: "Wax & Co", slug: "wax", currency: "XOF", isPublished: true, checkoutMode: "whatsapp", whatsappNumber: "22670123456" };
  _products = [{ id: PRODUCT_ID, name: "Tissu wax", price: 5000, images: [{ url: "https://cdn/x.jpg" }], hasVariants: false, currency: "XOF" }];
  _variants = [];
  _created = null;
  _stock = { ok: true };
  _user = null;
  _existing = null;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.bio-lien.com";
  mockSettle.mockClear();
});

describe("message WhatsApp", () => {
  test("référence courte, lignes, total et lien de suivi", () => {
    expect(orderReference("0f8a7b6c-1111-4222-8333-444455556666")).toBe("0F8A7B");
    const message = formatWhatsAppOrderMessage({
      shopName: "Wax & Co",
      lines: [
        { product_name: "Tissu wax", variant_name: "2 m", quantity: 2, unit_price: 5000 },
        { product_name: "Boubou", quantity: 1, unit_price: 12_000 },
      ],
      totalLabel: "22 000 FCFA",
      reference: "0F8A7B",
      trackingUrl: "https://www.bio-lien.com/orders/track/tok",
      formatPrice: (n) => `${n} FCFA`,
    });
    expect(message).toBe(
      "Bonjour Wax & Co 👋\nJe commande :\n• Tissu wax (2 m) × 2 — 10000 FCFA\n• Boubou — 12000 FCFA\nTotal : 22 000 FCFA\n\nCommande #0F8A7B\nSuivi : https://www.bio-lien.com/orders/track/tok",
    );
    expect(whatsAppUrl("22670123456", "a b")).toBe("https://wa.me/22670123456?text=a%20b");
  });
});

describe("POST /api/orders/whatsapp", () => {
  test("crée la commande hors plateforme et renvoie le lien wa.me avec la référence", async () => {
    const res = await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 2 }] });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.order_id).toBe(ORDER_ID);
    expect(json.reference).toBe("0F8A7B");
    expect(json.wa_url).toMatch(/^https:\/\/wa\.me\/22670123456\?text=/);
    const text = decodeURIComponent(json.wa_url.split("text=")[1]);
    expect(text).toContain("Commande #0F8A7B");
    expect(text).toContain("https://www.bio-lien.com/orders/track/tok-abc");
    expect(text).toContain("Tissu wax × 2");
    expect(_created).toMatchObject({
      shopId: SHOP_ID,
      buyerName: "Client WhatsApp",
      buyerEmail: null,
      paymentProvider: "manual",
      paymentStatus: "pending",
      status: "pending",
      totalAmount: 10_000,
      currency: "XOF",
    });
    expect((_created!.items as Array<{ unit_price: number; quantity: number }>)[0]).toMatchObject({ unit_price: 5000, quantity: 2 });
  });

  test("le prix vient de la base, pas du client ; une variante inconnue est refusée", async () => {
    _products = [{ ..._products[0]!, hasVariants: true }];
    expect((await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }] })).status).toBe(400);
    _variants = [{ id: VARIANT_ID, productId: PRODUCT_ID, name: "2 m", price: 7000, sku: null }];
    const res = await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, variant_id: VARIANT_ID, quantity: 1, unit_price: 1 }] });
    expect(res.status).toBe(201);
    expect(_created).toMatchObject({ totalAmount: 7000 });
  });

  test("boutique non publiée → 404 ; pas en mode WhatsApp ou sans numéro → 409", async () => {
    _shop = { ..._shop!, isPublished: false };
    expect((await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }] })).status).toBe(404);
    _shop = { ..._shop!, isPublished: true, checkoutMode: "online" };
    expect((await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }] })).status).toBe(409);
    _shop = { ..._shop!, checkoutMode: "whatsapp", whatsappNumber: "12" };
    expect((await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }] })).status).toBe(409);
    expect(_created).toBeNull();
  });

  test("stock insuffisant (réservation douce comprise) → 409 sans commande", async () => {
    _stock = { ok: false, reason: "insufficient_stock", product_name: "Tissu wax", available: 0 };
    const res = await post({ shopId: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Tissu wax/);
    expect(_created).toBeNull();
    const stock = jest.requireMock("@/lib/db/stock") as { checkStockAvailability: jest.Mock };
    expect(stock.checkStockAvailability).toHaveBeenCalledWith(
      [{ product_id: PRODUCT_ID, variant_id: null, quantity: 1 }],
      { shopId: SHOP_ID },
    );
  });

  test("corps invalide → 422", async () => {
    expect((await post({ shopId: "x", items: [] })).status).toBe(422);
  });
});

describe("POST /api/orders/[id]/mark-paid", () => {
  const call = () =>
    markPaid(new NextRequest(`http://localhost:3000/api/orders/${ORDER_ID}/mark-paid`, { method: "POST" }), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

  test("anonyme → 401 ; autre vendeur → 403", async () => {
    expect((await call()).status).toBe(401);
    _user = { id: "u-other" };
    _existing = { paymentProvider: "manual", paymentStatus: "pending", shop: { ownerId: "u-owner" } };
    expect((await call()).status).toBe(403);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  test("commande en ligne → 409 (le paiement est confirmé automatiquement)", async () => {
    _user = { id: "u-owner" };
    _existing = { paymentProvider: "geniuspay", paymentStatus: "pending", shop: { ownerId: "u-owner" } };
    expect((await call()).status).toBe(409);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  test("commande WhatsApp en attente → réglée hors plateforme", async () => {
    _user = { id: "u-owner" };
    _existing = { paymentProvider: "manual", paymentStatus: "pending", shop: { ownerId: "u-owner" } };
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockSettle).toHaveBeenCalledWith(ORDER_ID, expect.stringMatching(/^manual:u-owner:\d+$/), "manual");
    const json = await res.json();
    expect(json.order).toMatchObject({ id: ORDER_ID, payment_status: "paid", buyer_email: null });
  });
});
