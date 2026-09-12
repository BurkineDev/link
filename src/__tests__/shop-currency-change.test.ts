/**
 * PATCH /api/shops/[id] : on ne change pas de devise tant qu'il reste du net
 * vendeur à reverser dans l'ancienne — sinon cet argent disparaît de l'écran.
 */

import { NextRequest } from "next/server";

jest.mock("../../prisma/generated/client/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
}));
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(async () => ({ id: "u1", email: "vendeur@example.com" })),
}));
jest.mock("@/lib/shops/revalidate", () => ({ revalidateShopSlug: jest.fn(), revalidateShop: jest.fn() }));

let _balance = { currency: "XOF", available: 0, maturing: 0, reserved: 0, paidOut: 0, oldestUnpaidAt: null, nextMaturityAt: null };
jest.mock("@/lib/payouts/balance-db", () => ({ loadBalance: jest.fn(async () => _balance) }));

const mockUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
  id: SHOP_ID,
  slug: "wax",
  name: "Wax",
  currency: (data.currency as string) ?? "XOF",
  ownerId: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findFirst: jest.fn(async () => ({ id: SHOP_ID, slug: "wax", currency: "XOF" })),
      update: (args: { data: Record<string, unknown> }) => mockUpdate(args),
    },
  },
}));
jest.mock("@/lib/db/serialize", () => ({ serializeShop: (shop: unknown) => shop }));

import { PATCH } from "@/app/api/shops/[id]/route";

const SHOP_ID = "22222222-2222-4222-8222-222222222222";

function patch(body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost:3000/api/shops/${SHOP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: SHOP_ID }) },
  );
}

beforeEach(() => {
  mockUpdate.mockClear();
  _balance = { currency: "XOF", available: 0, maturing: 0, reserved: 0, paidOut: 0, oldestUnpaidAt: null, nextMaturityAt: null };
});

describe("changement de devise", () => {
  test("refusé (409) tant qu'il reste du disponible, en sécurisation ou réservé", async () => {
    for (const partial of [{ available: 45_000 }, { maturing: 3_000 }, { reserved: 7_500 }]) {
      _balance = { ..._balance, available: 0, maturing: 0, reserved: 0, ...partial };
      const res = await patch({ currency: "GHS" });
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.code).toBe("OUTSTANDING_BALANCE");
      expect(json.error).toMatch(/XOF/);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("accepté quand tout est versé, et sans contrôle quand la devise ne change pas", async () => {
    expect((await patch({ currency: "GHS" })).status).toBe(200);
    _balance = { ..._balance, available: 45_000 };
    expect((await patch({ currency: "XOF" })).status).toBe(200);
    expect((await patch({ name: "Wax & Co" })).status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});
