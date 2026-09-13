/**
 * Expiration des commandes WhatsApp jamais marquées payées (cron quotidien).
 */

let _stale: Array<{ id: string }> = [];
let _updateCount = 1;
let _updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
let _events: Array<Record<string, unknown>> = [];

const tx = {
  order: {
    updateMany: jest.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      _updates.push(args);
      return { count: _updateCount };
    }),
  },
  orderStatusEvent: {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      _events.push(data);
      return data;
    }),
  },
};
const prismaMock = {
  $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  order: { findMany: jest.fn(async () => _stale) },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { expireStaleManualOrders, MANUAL_ORDER_TTL_MS } from "@/lib/orders/expire-manual";

beforeEach(() => {
  _stale = [];
  _updateCount = 1;
  _updates = [];
  _events = [];
  jest.clearAllMocks();
});

test("ne vise que les commandes manual en attente depuis plus de sept jours", async () => {
  const now = new Date("2026-09-20T06:00:00Z");
  expect(await expireStaleManualOrders({ now })).toEqual({ expired: 0, errors: 0 });
  const call = (prismaMock.order.findMany.mock.calls as unknown as Array<[{ where: Record<string, unknown>; take: number }]>)[0]![0];
  expect(call.where).toEqual({
    paymentProvider: "manual",
    paymentStatus: "pending",
    status: "pending",
    createdAt: { lt: new Date(now.getTime() - MANUAL_ORDER_TTL_MS) },
  });
  expect(call.take).toBe(200);
  expect(MANUAL_ORDER_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
});

test("annule chaque commande expirée avec un mot sur la page de suivi", async () => {
  _stale = [{ id: "o1" }, { id: "o2" }];
  expect(await expireStaleManualOrders()).toEqual({ expired: 2, errors: 0 });
  expect(_updates.map((u) => u.where.id)).toEqual(["o1", "o2"]);
  // Conditionnel : l'écriture ne touche que ce qui est encore en attente.
  expect(_updates[0]!.where).toMatchObject({ paymentProvider: "manual", paymentStatus: "pending", status: "pending" });
  expect(_updates[0]!.data).toEqual({ status: "cancelled", paymentStatus: "failed" });
  expect(_events).toHaveLength(2);
  expect(_events[0]).toMatchObject({ orderId: "o1", status: "cancelled" });
  expect(_events[0]!.publicMessage).toMatch(/expirée/i);
});

test("une commande marquée payée entre la lecture et l'écriture est laissée en paix", async () => {
  _stale = [{ id: "o1" }];
  _updateCount = 0;
  expect(await expireStaleManualOrders()).toEqual({ expired: 0, errors: 0 });
  expect(_events).toHaveLength(0);
});

test("ne lève jamais : une erreur de lecture ou d'écriture est comptée", async () => {
  prismaMock.order.findMany.mockRejectedValueOnce(new Error("boom"));
  expect(await expireStaleManualOrders()).toEqual({ expired: 0, errors: 1 });

  _stale = [{ id: "o1" }, { id: "o2" }];
  tx.order.updateMany.mockRejectedValueOnce(new Error("deadlock"));
  expect(await expireStaleManualOrders()).toEqual({ expired: 1, errors: 1 });
});
