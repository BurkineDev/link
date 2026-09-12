/**
 * Contre-passation du net vendeur sur remboursement ou litige
 * (recordOrderRefund / reverseChargeback dans src/lib/db/orders.ts).
 */

// Le client Prisma généré n'est pas chargeable sous Jest (import.meta) : on
// ne garde que ce que le module utilise.
jest.mock("../../prisma/generated/client/client", () => ({
  Prisma: { Decimal: class DecimalStub { constructor(public value: number) {} toNumber() { return this.value; } } },
}));

interface LedgerRow {
  type: string;
  amount: number;
  reference: string | null;
  metadata: unknown;
  shopId: string;
  currency: string;
}

let _order: {
  id: string;
  shopId: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  items?: unknown;
  stockReservedAt?: Date | null;
  stockShortfall?: unknown;
} | null = null;
let _restored: Array<{ id: string; increment: number }> = [];
let _ledger: LedgerRow[] = [];
let _updates: Array<Record<string, unknown>> = [];
let _events: Array<Record<string, unknown>> = [];

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const SHOP_ID = "22222222-2222-4222-8222-222222222222";

const tx = {
  $queryRaw: jest.fn(async () => (_order ? [{ id: _order.id }] : [])),
  order: {
    findUniqueOrThrow: jest.fn(async () => _order),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      _updates.push(data);
      if (_order) Object.assign(_order, data);
      return _order;
    }),
  },
  transactionLedger: {
    findMany: jest.fn(async ({ where }: { where: { type: { in: string[] }; reference?: string } }) =>
      _ledger.filter((row) => where.type.in.includes(row.type) && (!where.reference || row.reference === where.reference))),
    create: jest.fn(async ({ data }: { data: LedgerRow }) => {
      _ledger.push({ ...data, amount: Number(data.amount) });
      return data;
    }),
  },
  orderStatusEvent: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { _events.push(data); return data; }) },
  product: {
    updateMany: jest.fn(async ({ where, data }: { where: { id: string }; data: { stockQuantity: { increment: number } } }) => {
      _restored.push({ id: where.id, increment: data.stockQuantity.increment });
      return { count: 1 };
    }),
  },
  productVariant: { updateMany: jest.fn(async () => ({ count: 0 })) },
};

jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) },
}));

import { recordOrderRefund, reverseChargeback } from "@/lib/db/orders";

beforeEach(() => {
  _restored = [];
  _order = {
    id: ORDER_ID,
    shopId: SHOP_ID,
    totalAmount: 20_000,
    currency: "XOF",
    paymentStatus: "paid",
    items: [{ product_id: "p-wax", variant_id: null, quantity: 2 }],
    stockReservedAt: new Date("2026-09-12T10:00:00Z"),
    stockShortfall: null,
  };
  _ledger = [
    { type: "gross", amount: 20_000, reference: "MTX-1", metadata: null, shopId: SHOP_ID, currency: "XOF" },
    { type: "platform_fee", amount: -1_000, reference: "MTX-1", metadata: null, shopId: SHOP_ID, currency: "XOF" },
    { type: "seller_net", amount: 19_000, reference: "MTX-1", metadata: null, shopId: SHOP_ID, currency: "XOF" },
  ];
  _updates = [];
  _events = [];
});

const adjustments = () => _ledger.filter((row) => !["gross", "platform_fee", "seller_net"].includes(row.type));

describe("recordOrderRefund", () => {
  test("remboursement total : ligne refund −net vendeur, commande remboursée", async () => {
    const res = await recordOrderRefund(ORDER_ID, { amount: 20_000, reference: "MTX-1:refund", provider: "geniuspay" });
    expect(res).toEqual({ recorded: true, clawback: 19_000, refundedTotal: 20_000, full: true });
    expect(adjustments()).toEqual([
      expect.objectContaining({ type: "refund", amount: -19_000, reference: "MTX-1:refund", metadata: { refundedAmount: 20_000, kind: "refund" } }),
    ]);
    expect(_updates[0]).toEqual({ paymentStatus: "refunded", status: "refunded", stockReservedAt: null });
    expect(_restored).toEqual([{ id: "p-wax", increment: 2 }]);
    expect(_events[0]).toMatchObject({ status: "refunded" });
  });

  test("remboursement total : le stock prélevé revient en vente, manque déduit", async () => {
    _order = { ..._order!, stockShortfall: [{ product_id: "p-wax", variant_id: null, requested: 2, taken: 1 }] };
    await recordOrderRefund(ORDER_ID, { amount: 20_000, reference: "r-full", provider: "geniuspay" });
    expect(_restored).toEqual([{ id: "p-wax", increment: 1 }]);
    expect(_updates[0]).toMatchObject({ paymentStatus: "refunded", status: "refunded", stockReservedAt: null });
  });

  test("remboursement total d'une commande jamais prélevée : rien à rendre", async () => {
    _order = { ..._order!, stockReservedAt: null };
    await recordOrderRefund(ORDER_ID, { amount: 20_000, reference: "r-full2", provider: "geniuspay" });
    expect(_restored).toEqual([]);
  });

  test("remboursement partiel : part proportionnelle, commande partiellement remboursée", async () => {
    const res = await recordOrderRefund(ORDER_ID, { amount: 5_000, reference: "r1", provider: "stripe" });
    expect(res).toEqual({ recorded: true, clawback: 4_750, refundedTotal: 5_000, full: false });
    expect(_updates[0]).toEqual({ paymentStatus: "partially_refunded" });
    expect(_restored).toEqual([]);
  });

  test("cumul Stripe : seule la différence avec ce qui est déjà enregistré est contre-passée", async () => {
    await recordOrderRefund(ORDER_ID, { amount: 5_000, cumulative: true, reference: "ch:5000", provider: "stripe" });
    const second = await recordOrderRefund(ORDER_ID, { amount: 20_000, cumulative: true, reference: "ch:20000", provider: "stripe" });
    expect(second).toEqual({ recorded: true, clawback: 14_250, refundedTotal: 20_000, full: true });
    expect(adjustments().reduce((sum, row) => sum + row.amount, 0)).toBe(-19_000);
  });

  test("jamais plus que le net vendeur, même si le prestataire rembourse davantage", async () => {
    await recordOrderRefund(ORDER_ID, { amount: 15_000, reference: "a", provider: "geniuspay" });
    await recordOrderRefund(ORDER_ID, { amount: 15_000, reference: "b", provider: "geniuspay" });
    expect(adjustments().reduce((sum, row) => sum + row.amount, 0)).toBe(-19_000);
  });

  test("idempotent sur la référence ; refusé sur une commande non payée", async () => {
    await recordOrderRefund(ORDER_ID, { amount: 5_000, reference: "r1", provider: "stripe" });
    expect(await recordOrderRefund(ORDER_ID, { amount: 5_000, reference: "r1", provider: "stripe" })).toEqual({ recorded: false, reason: "already_recorded" });
    expect(adjustments()).toHaveLength(1);

    _order = { ..._order!, paymentStatus: "pending" };
    expect(await recordOrderRefund(ORDER_ID, { amount: 5_000, reference: "r2", provider: "stripe" })).toEqual({ recorded: false, reason: "not_paid" });
    _order = null;
    expect(await recordOrderRefund(ORDER_ID, { amount: 5_000, reference: "r3", provider: "stripe" })).toEqual({ recorded: false, reason: "not_found" });
  });

  test("litige : retenue chargeback sans toucher au statut de la commande, puis levée si gagné", async () => {
    const opened = await recordOrderRefund(ORDER_ID, { amount: 20_000, reference: "dp_1", provider: "stripe", kind: "chargeback" });
    expect(opened).toMatchObject({ recorded: true, clawback: 19_000 });
    expect(_updates).toHaveLength(0);
    expect(adjustments()[0]).toMatchObject({ type: "chargeback", amount: -19_000 });

    expect(await reverseChargeback(ORDER_ID, { reference: "dp_1", provider: "stripe" })).toEqual({ recorded: true, amount: 19_000 });
    expect(adjustments()[1]).toMatchObject({ type: "chargeback_reversal", amount: 19_000, reference: "dp_1" });
    // Rejeu : rien de plus.
    expect(await reverseChargeback(ORDER_ID, { reference: "dp_1", provider: "stripe" })).toEqual({ recorded: false, amount: 0 });
    expect(adjustments()).toHaveLength(2);
  });
});
