/**
 * POST /api/onboarding — une transaction, une seule fois.
 */
import { NextRequest } from "next/server";

jest.mock("../../prisma/generated/client/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } },
}));

let _user: { id: string } | null = { id: "u-1" };
let _existingShop: { id: string } | null = null;
const _writes: Array<[string, unknown]> = [];
const tx = {
  profile: { update: jest.fn(async (args: unknown) => { _writes.push(["profile.update", args]); return {}; }) },
  shop: { create: jest.fn(async (args: unknown) => { _writes.push(["shop.create", args]); return { id: "shop-1" }; }) },
  pageBlock: { createMany: jest.fn(async (args: unknown) => { _writes.push(["pageBlock.createMany", args]); return { count: 1 }; }) },
};
jest.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findFirst: jest.fn(async () => _existingShop) },
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  },
}));
jest.mock("@/lib/auth", () => ({ getCurrentUser: jest.fn(async () => _user) }));

import { POST } from "@/app/api/onboarding/route";

const BODY = {
  fullName: "Amara Diallo",
  username: "amara",
  shop: { name: "Wax & Co", slug: "wax-and-co", currency: "XOF", checkoutMode: "whatsapp", whatsappNumber: "+22670123456", bioTheme: "classic", intentions: [] },
  blocks: [{ type: "WHATSAPP", position: 0, title: null, config: { phone: "22670123456", label: "Commander" } }],
};

function post(body: unknown) {
  return POST(new NextRequest("http://localhost:3000/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  _user = { id: "u-1" };
  _existingShop = null;
  _writes.length = 0;
});

test("crée profil, boutique (non publiée) et blocs, sans objectif obligatoire", async () => {
  const res = await post(BODY);
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ shopId: "shop-1" });
  expect(_writes.map(([name]) => name)).toEqual(["profile.update", "shop.create", "pageBlock.createMany", "profile.update"]);
  expect((_writes[1]![1] as { data: Record<string, unknown> }).data).toMatchObject({ isPublished: false, intentions: [], whatsappNumber: "+22670123456" });
  expect((_writes[3]![1] as { data: Record<string, unknown> }).data).toEqual({ onboardingCompleted: true });
});

test("rejoué avec une boutique existante → 409 ALREADY_ONBOARDED, rien n'est écrit", async () => {
  _existingShop = { id: "shop-0" };
  const res = await post(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: "ALREADY_ONBOARDED", shopId: "shop-0" });
  expect(_writes).toHaveLength(0);
});

test("anonyme → 401 ; numéro WhatsApp sans indicatif → 422", async () => {
  _user = null;
  expect((await post(BODY)).status).toBe(401);
  _user = { id: "u-1" };
  expect((await post({ ...BODY, shop: { ...BODY.shop, whatsappNumber: "70123456" } })).status).toBe(422);
});
