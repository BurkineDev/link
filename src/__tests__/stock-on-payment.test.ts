/**
 * Stock prélevé au règlement, plus au passage en caisse.
 *
 * - `checkStockAvailability` : lecture seule au checkout.
 * - `claimStock` : prélèvement sous verrou au règlement, jamais de refus —
 *   ce qui manque est signalé.
 * - `settlePaidOrder` : appelle `claimStock` une seule fois, note le manque.
 * - `cancelUnpaidOrder` : ne rend le stock que s'il avait été réservé
 *   (commandes d'avant ce changement).
 */

jest.mock("../../prisma/generated/client/client", () => ({
  Prisma: {
    Decimal: class DecimalStub {
      constructor(public value: number) {}
      toNumber() { return this.value; }
      minus(n: number) { return new DecimalStub(this.value - n); }
      negated() { return new DecimalStub(-this.value); }
    },
    DbNull: Symbol("DbNull"),
  },
}));

// ---- doubles ---------------------------------------------------------------

let _products: Record<string, { stock: number | null; name: string }> = {};
let _variants: Record<string, { stock: number | null; productId: string }> = {};
let _order: Record<string, unknown> | null = null;
let _updates: Array<Record<string, unknown>> = [];
let _events: Array<Record<string, unknown>> = [];

const tx = {
  $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    if (sql.includes("from public.orders")) return _order ? [{ id: _order.id }] : [];
    if (sql.includes("product_variants v")) {
      const v = _variants[values[0] as string];
      return v ? [{ stock_quantity: v.stock, name: _products[v.productId]?.name ?? "?" }] : [];
    }
    if (sql.includes("from public.products")) {
      const p = _products[values[0] as string];
      return p ? [{ stock_quantity: p.stock, name: p.name }] : [];
    }
    return [];
  }),
  product: {
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { stockQuantity: { decrement: number } } }) => {
      _products[where.id]!.stock! -= data.stockQuantity.decrement;
    }),
    updateMany: jest.fn(async ({ where, data }: { where: { id: string }; data: { stockQuantity: { increment: number } } }) => {
      const p = _products[where.id];
      if (p && p.stock !== null) p.stock += data.stockQuantity.increment;
      return { count: p ? 1 : 0 };
    }),
    findUnique: jest.fn(async () => null),
  },
  productVariant: {
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { stockQuantity: { decrement: number } } }) => {
      _variants[where.id]!.stock! -= data.stockQuantity.decrement;
    }),
    updateMany: jest.fn(async () => ({ count: 0 })),
  },
  order: {
    findUniqueOrThrow: jest.fn(async () => _order),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { _updates.push(data); Object.assign(_order!, data); return _order; }),
  },
  orderStatusEvent: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { _events.push(data); return data; }) },
  customer: {
    findUnique: jest.fn(async () => null),
    create: jest.fn(async () => ({ id: "cust-1" })),
  },
  shop: { findUniqueOrThrow: jest.fn(async () => ({ owner: { subscriptions: [] } })) },
  transactionLedger: { createMany: jest.fn(async () => ({ count: 3 })) },
  orderItem: { findFirst: jest.fn(async () => null) },
  digitalDownload: { create: jest.fn(async () => ({})) },
  promoCode: { updateMany: jest.fn(async () => ({ count: 0 })) },
};

let _pendingOrders: Array<{ items: unknown }> = [];
const prismaMock = {
  $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  order: { findMany: jest.fn(async () => _pendingOrders) },
  product: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const p = _products[where.id];
      return p ? { stockQuantity: p.stock, name: p.name } : null;
    }),
  },
  productVariant: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const v = _variants[where.id];
      return v ? { stockQuantity: v.stock, product: { name: _products[v.productId]?.name ?? "?" } } : null;
    }),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { checkStockAvailability, claimStock } from "@/lib/db/stock";
import { cancelUnpaidOrder, settlePaidOrder, transitionOrderStatus } from "@/lib/db/orders";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333333";
const ORDER = "44444444-4444-4444-8444-444444444444";

const decimal = (n: number) => ({ toNumber: () => n, minus: (m: number) => decimal(n - m), valueOf: () => n });

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER,
    shopId: "55555555-5555-4555-8555-555555555555",
    buyerEmail: "kofi@example.com",
    buyerName: "Kofi",
    buyerPhone: null,
    paymentStatus: "pending",
    status: "pending",
    totalAmount: decimal(15_000),
    currency: "XOF",
    items: [
      { product_id: P1, variant_id: null, quantity: 2, product_snapshot: {} },
      { product_id: P2, variant_id: V1, quantity: 1, product_snapshot: {} },
    ],
    promoCode: null,
    paymentRef: null,
    paymentProvider: null,
    createdAt: new Date("2026-09-12T10:00:00Z"),
    stockReservedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  _products = { [P1]: { stock: 5, name: "Tissu wax" }, [P2]: { stock: null, name: "Boubou" } };
  _variants = { [V1]: { stock: 1, productId: P2 } };
  _order = order();
  _updates = [];
  _events = [];
  _pendingOrders = [];
  jest.clearAllMocks();
});

describe("checkStockAvailability (lecture seule)", () => {
  test("accepte un panier servable sans rien écrire", async () => {
    const res = await checkStockAvailability([
      { product_id: P1, variant_id: null, quantity: 5 },
      { product_id: P2, variant_id: V1, quantity: 1 },
    ]);
    expect(res).toEqual({ ok: true });
    expect(_products[P1]!.stock).toBe(5);
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  test("refuse au-delà du stock, en nommant l'article, et ignore un stock non suivi", async () => {
    expect(await checkStockAvailability([{ product_id: P1, variant_id: null, quantity: 6 }])).toEqual({
      ok: false, reason: "insufficient_stock", product_id: P1, product_name: "Tissu wax", available: 5, requested: 6,
    });
    expect(await checkStockAvailability([{ product_id: P2, variant_id: null, quantity: 999 }])).toEqual({ ok: true });
    expect(await checkStockAvailability([{ product_id: P2, variant_id: V1, quantity: 2 }])).toMatchObject({
      ok: false, reason: "insufficient_stock", variant_id: V1, product_name: "Boubou", available: 1,
    });
    expect(await checkStockAvailability([{ product_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }])).toMatchObject({ reason: "product_not_found" });
    expect(await checkStockAvailability("nope")).toEqual({ ok: false, reason: "invalid_items" });
  });
});

describe("checkStockAvailability — réservation douce", () => {
  test("les unités des commandes en attente récentes de la boutique comptent comme engagées", async () => {
    _pendingOrders = [
      { items: [{ product_id: P1, variant_id: null, quantity: 3 }] },
      { items: [{ product_id: P1, variant_id: null, quantity: 1 }] },
    ];
    expect(await checkStockAvailability([{ product_id: P1, quantity: 1 }], { shopId: "shop" })).toEqual({ ok: true });
    expect(await checkStockAvailability([{ product_id: P1, quantity: 2 }], { shopId: "shop" })).toEqual({
      ok: false, reason: "insufficient_stock", product_id: P1, product_name: "Tissu wax", available: 1, requested: 2,
    });
    const call = (prismaMock.order.findMany.mock.calls as unknown as Array<[{ where: { paymentStatus: string; stockReservedAt: null; createdAt: { gt: Date }; OR: unknown[] } }]>)[0]![0];
    expect(call.where).toMatchObject({ shopId: "shop", paymentStatus: "pending", stockReservedAt: null });
    expect(Date.now() - call.where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
  });

  test("les commandes WhatsApp (manual) n'engagent rien : deux curieux ne bloquent pas la boutique", async () => {
    await checkStockAvailability([{ product_id: P1, quantity: 1 }], { shopId: "shop" });
    const call = (prismaMock.order.findMany.mock.calls as unknown as Array<[{ where: { OR: unknown[] } }]>)[0]![0];
    expect(call.where.OR).toEqual([{ paymentProvider: null }, { paymentProvider: { not: "manual" } }]);
  });

  test("sans boutique (appel interne) : pas de réservation douce", async () => {
    _pendingOrders = [{ items: [{ product_id: P1, variant_id: null, quantity: 5 }] }];
    expect(await checkStockAvailability([{ product_id: P1, quantity: 5 }])).toEqual({ ok: true });
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });

  test("deux lignes sur le même article se cumulent avant la comparaison", async () => {
    _products[P1]!.stock = 1;
    expect(
      await checkStockAvailability([
        { product_id: P1, quantity: 1 },
        { product_id: P1, quantity: 1 },
      ]),
    ).toMatchObject({ ok: false, reason: "insufficient_stock", requested: 2, available: 1 });
  });
});

describe("claimStock (au règlement)", () => {
  test("verrouille les articles dans un ordre stable, quel que soit l'ordre du panier", async () => {
    const original = tx.$queryRaw.getMockImplementation()!;
    const seen: string[] = [];
    tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("from public.products") || sql.includes("product_variants v")) seen.push(values[0] as string);
      return original(strings, ...values);
    });
    try {
      await claimStock(tx as never, [
        { product_id: P2, variant_id: V1, quantity: 1 },
        { product_id: P1, variant_id: null, quantity: 1 },
      ]);
    } finally {
      tx.$queryRaw.mockImplementation(original);
    }
    expect(seen).toEqual([P1, V1].sort((a, b) => a.localeCompare(b)));
  });

  test("prélève ce qui existe et signale le manque, sans jamais refuser", async () => {
    _products[P1]!.stock = 1;
    const shortfall = await claimStock(tx as never, [
      { product_id: P1, variant_id: null, quantity: 2 },
      { product_id: P2, variant_id: V1, quantity: 1 },
    ]);
    expect(_products[P1]!.stock).toBe(0);
    expect(_variants[V1]!.stock).toBe(0);
    expect(shortfall).toEqual([{ product_id: P1, variant_id: null, product_name: "Tissu wax", requested: 2, taken: 1 }]);
  });

  test("stock non suivi ou article disparu : rien à prélever, rien à signaler", async () => {
    const shortfall = await claimStock(tx as never, [
      { product_id: P2, variant_id: null, quantity: 3 },
      { product_id: "00000000-0000-4000-8000-000000000000", variant_id: null, quantity: 1 },
    ]);
    expect(shortfall).toEqual([]);
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});

describe("settlePaidOrder", () => {
  test("prélève le stock au règlement et l'inscrit sur la commande", async () => {
    const res = await settlePaidOrder(ORDER, "MTX-1", "geniuspay");
    expect(res).toMatchObject({ settled: true, stockShortfall: [] });
    expect(_products[P1]!.stock).toBe(3);
    expect(_variants[V1]!.stock).toBe(0);
    expect(_updates[0]).toMatchObject({ paymentStatus: "paid", status: "confirmed" });
    expect(_updates[0]!.stockReservedAt).toBeInstanceOf(Date);
    expect(_events[0]).toMatchObject({ status: "confirmed", note: null });
  });

  test("deux acheteurs ont payé le dernier exemplaire : la commande est réglée, le manque noté", async () => {
    _products[P1]!.stock = 1;
    const res = await settlePaidOrder(ORDER, "MTX-2", "geniuspay");
    expect(res).toMatchObject({
      settled: true,
      stockShortfall: [{ product_id: P1, product_name: "Tissu wax", requested: 2, taken: 1 }],
    });
    expect(_products[P1]!.stock).toBe(0);
    expect(_updates[0]!.stockShortfall).toEqual([
      { product_id: P1, variant_id: null, product_name: "Tissu wax", requested: 2, taken: 1 },
    ]);
    expect(_events[0]!.note).toMatch(/Stock insuffisant au moment du paiement : Tissu wax \(1\/2\)/);
  });

  test("manque sur une variante : signalé avec le nom du produit", async () => {
    _variants[V1]!.stock = 0;
    const res = await settlePaidOrder(ORDER, "MTX-4", "geniuspay");
    expect(res).toMatchObject({
      settled: true,
      stockShortfall: [{ product_id: P2, variant_id: V1, product_name: "Boubou", requested: 1, taken: 0 }],
    });
    expect(_events[0]!.publicMessage).toMatch(/vérifie la disponibilité/);
  });

  test("produit numérique en édition limitée : pas de fichier délivré à l'acheteur qui n'a rien obtenu", async () => {
    _products[P1] = { stock: 0, name: "E-book" };
    _order = order({ items: [{ product_id: P1, variant_id: null, quantity: 1, product_snapshot: {} }] });
    tx.product.findUnique.mockResolvedValue({ id: P1, name: "E-book", isDigital: true, metadata: { download_key: "k" } } as never);
    await settlePaidOrder(ORDER, "MTX-5", "stripe");
    expect(tx.digitalDownload.create).not.toHaveBeenCalled();

    _products[P1]!.stock = 1;
    _order = order({ items: [{ product_id: P1, variant_id: null, quantity: 1, product_snapshot: {} }] });
    await settlePaidOrder(ORDER, "MTX-6", "stripe");
    expect(tx.digitalDownload.create).toHaveBeenCalledTimes(1);
  });

  test("commande WhatsApp réglée hors plateforme : stock prélevé, ni registre ni fiche client sans e-mail", async () => {
    _order = order({ buyerEmail: null, paymentProvider: "manual" });
    const res = await settlePaidOrder(ORDER, "manual:u1:1", "manual");
    expect(res).toMatchObject({ settled: true, offline: true, commission: 0, customerId: null, stockShortfall: [] });
    expect(_products[P1]!.stock).toBe(3);
    expect(tx.transactionLedger.createMany).not.toHaveBeenCalled();
    expect(tx.customer.create).not.toHaveBeenCalled();
    expect(_updates[0]).toMatchObject({ paymentStatus: "paid", status: "confirmed", paymentProvider: "manual" });
  });

  test("commande d'avant le changement (stock déjà réservé) : pas de second prélèvement", async () => {
    _order = order({ stockReservedAt: new Date("2026-09-10T00:00:00Z") });
    const res = await settlePaidOrder(ORDER, "MTX-3", "stripe");
    expect(res).toMatchObject({ settled: true, stockShortfall: [] });
    expect(_products[P1]!.stock).toBe(5);
    expect(_updates[0]!.stockReservedAt).toEqual(new Date("2026-09-10T00:00:00Z"));
  });
});

describe("settlePaidOrder — statut", () => {
  test("une commande déjà expédiée ne recule pas à « confirmée » quand le paiement tombe", async () => {
    _order = order({ status: "shipped" });
    expect(await settlePaidOrder(ORDER, "MTX-9", "manual")).toMatchObject({ settled: true });
    expect(_updates[0]).toMatchObject({ paymentStatus: "paid", status: "shipped" });
  });
});

describe("transitionOrderStatus — commande WhatsApp non payée", () => {
  const OWNER = "66666666-6666-4666-8666-666666666666";

  test("ne se confirme pas à la main : c'est « Marquer comme payée » qui confirme", async () => {
    _order = order({ paymentProvider: "manual", shop: { ownerId: OWNER } });
    expect(await transitionOrderStatus({ orderId: ORDER, status: "confirmed", actorId: OWNER })).toEqual({
      updated: false,
      reason: "manual_order_requires_payment",
    });
    expect(_updates).toHaveLength(0);
    expect(_events).toHaveLength(0);
  });

  test("peut être annulée ; une commande en ligne en attente se confirme comme avant", async () => {
    _order = order({ paymentProvider: "manual", shop: { ownerId: OWNER } });
    expect(await transitionOrderStatus({ orderId: ORDER, status: "cancelled", actorId: OWNER })).toEqual({
      updated: true,
      status: "cancelled",
    });
    _order = order({ paymentProvider: "geniuspay", shop: { ownerId: OWNER } });
    expect(await transitionOrderStatus({ orderId: ORDER, status: "confirmed", actorId: OWNER })).toEqual({
      updated: true,
      status: "confirmed",
    });
  });
});

describe("cancelUnpaidOrder", () => {
  test("commande en attente créée après le changement : rien à rendre", async () => {
    expect(await cancelUnpaidOrder(ORDER, null, "geniuspay")).toEqual({ cancelled: true });
    expect(_products[P1]!.stock).toBe(5);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(_updates[0]).toMatchObject({ status: "cancelled", paymentStatus: "failed", stockReservedAt: null });
  });

  test("commande d'avant le changement : le stock réservé est rendu", async () => {
    _order = order({ stockReservedAt: new Date("2026-09-10T00:00:00Z") });
    expect(await cancelUnpaidOrder(ORDER, null, "geniuspay")).toEqual({ cancelled: true });
    expect(_products[P1]!.stock).toBe(7);
  });
});
