/**
 * Réconciliation des commandes Mobile Money.
 *
 * Le premier paiement réel en production n'a jamais reçu de webhook : la
 * commande est restée « en attente », stock réservé, vendeur jamais prévenu.
 * Ces tests fixent le comportement de rattrapage.
 */

// ---------------------------------------------------------------------------
// État mutable lu par les mocks
// ---------------------------------------------------------------------------

interface Update {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
}

let _orders: Record<string, unknown>[] = [];
let _payment: Record<string, unknown> | null = null;
let _fetchThrows = false;
let _updates: Update[] = [];
let _released: unknown[] = [];
let _notified: string[] = [];
let _selectFilters: Record<string, unknown> = {};

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const REF = "MTX-TEST123456";

function makeUpdateChain(table: string, values: Record<string, unknown>) {
  const filters: Record<string, unknown> = {};
  const chain = {
    eq(col: string, val: unknown) {
      filters[col] = val;
      return chain;
    },
    select() {
      _updates.push({ table, values, filters });
      return Promise.resolve({ data: [{ id: ORDER_ID }], error: null });
    },
    then(resolve: (v: { error: null }) => unknown) {
      _updates.push({ table, values, filters });
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  return chain;
}

/**
 * PostgREST rend un builder qui reste chaînable *et* attendable : `.limit()`
 * ne clôt pas la requête, on peut encore poser un `.eq()` derrière. Le mock
 * doit se comporter pareil, sinon il teste une API qui n'existe pas.
 */
function makeSelectChain() {
  const chain = {
    eq(col: string, val: unknown) {
      _selectFilters[col] = val;
      return chain;
    },
    not() {
      return chain;
    },
    lt(col: string, val: unknown) {
      _selectFilters[col] = val;
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data: _orders, error: null }).then(resolve);
    },
  };
  return chain;
}

const mockAdmin = {
  from: (table: string) => ({
    select: () => makeSelectChain(),
    update: (values: Record<string, unknown>) => makeUpdateChain(table, values),
  }),
  rpc: (fn: string, args: { items: unknown[] }) => {
    if (fn === "release_stock") _released.push(...args.items);
    return Promise.resolve({ data: null, error: null });
  },
};

jest.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => mockAdmin }));

jest.mock("@/lib/geniuspay", () => ({
  isGeniusPayConfigured: () => true,
  fetchPayment: jest.fn(() => {
    if (_fetchThrows) return Promise.reject(new Error("Genius Pay down"));
    return Promise.resolve(_payment);
  }),
  mapStatusToPaymentStatus: (s: string) => {
    if (s === "completed") return "paid";
    if (s === "refunded") return "refunded";
    if (["failed", "cancelled", "expired"].includes(s)) return "failed";
    return "pending";
  },
}));

jest.mock("@/lib/order-notifications", () => ({
  notifySellerOfPaidOrder: jest.fn((id: string) => {
    _notified.push(id);
    return Promise.resolve();
  }),
}));

import { reconcilePendingGeniusPayOrders } from "@/lib/orders/reconcile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    total_amount: 1000,
    currency: "XOF",
    payment_ref: REF,
    items: [{ product_id: PRODUCT_ID, variant_id: null, quantity: 2 }],
    created_at: new Date(Date.now() - HOUR).toISOString(),
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    reference: REF,
    status: "completed",
    amount: 1000,
    currency: "XOF",
    ...overrides,
  };
}

beforeEach(() => {
  _orders = [order()];
  _payment = payment();
  _fetchThrows = false;
  _updates = [];
  _released = [];
  _notified = [];
  _selectFilters = {};
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reconcilePendingGeniusPayOrders", () => {
  test("confirme la commande quand Genius Pay dit « completed »", async () => {
    const res = await reconcilePendingGeniusPayOrders();

    expect(res.paid).toBe(1);
    expect(_updates).toHaveLength(1);
    expect(_updates[0].values).toEqual({
      payment_status: "paid",
      status: "confirmed",
    });
    expect(_notified).toEqual([ORDER_ID]);
    expect(_released).toHaveLength(0);
  });

  test("l'écriture est conditionnée à l'état « pending » — idempotence face au webhook", async () => {
    await reconcilePendingGeniusPayOrders();
    expect(_updates[0].filters).toEqual({
      id: ORDER_ID,
      payment_status: "pending",
    });
  });

  test("ne confirme jamais sur un montant inférieur", async () => {
    _payment = payment({ amount: 200 });

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.paid).toBe(0);
    expect(res.stillPending).toBe(1);
    expect(_updates).toHaveLength(0);
    expect(_notified).toHaveLength(0);
  });

  test("ne confirme jamais sur une autre devise", async () => {
    _payment = payment({ currency: "XAF" });

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.paid).toBe(0);
    expect(_updates).toHaveLength(0);
  });

  test("rend le stock et annule sur un paiement échoué", async () => {
    _payment = payment({ status: "failed" });

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.failed).toBe(1);
    expect(_released).toEqual([
      { product_id: PRODUCT_ID, variant_id: null, quantity: 2 },
    ]);
    expect(_updates[0].values).toEqual({
      payment_status: "failed",
      status: "cancelled",
    });
  });

  test("laisse en attente un paiement encore en cours", async () => {
    _payment = payment({ status: "processing" });

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.stillPending).toBe(1);
    expect(_updates).toHaveLength(0);
    expect(_released).toHaveLength(0);
  });

  test("libère le stock d'un panier abandonné depuis plus de 24 h", async () => {
    _orders = [
      order({ created_at: new Date(Date.now() - 30 * HOUR).toISOString() }),
    ];
    _payment = payment({ status: "pending" });

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.failed).toBe(1);
    expect(_released).toHaveLength(1);
  });

  test("une panne Genius Pay ne fait pas échouer le lot entier", async () => {
    _fetchThrows = true;

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.errors).toBe(1);
    expect(res.checked).toBe(1);
    expect(_updates).toHaveLength(0);
    expect(_released).toHaveLength(0);
  });

  test("filtre sur la boutique quand shopId est fourni", async () => {
    await reconcilePendingGeniusPayOrders({ shopId: "shop-1" });
    expect(_selectFilters.shop_id).toBe("shop-1");
  });

  test("ne touche à rien quand il n'y a aucune commande en attente", async () => {
    _orders = [];

    const res = await reconcilePendingGeniusPayOrders();

    expect(res.checked).toBe(0);
    expect(_updates).toHaveLength(0);
  });
});
