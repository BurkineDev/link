/**
 * POST /api/onboarding — une transaction, une seule fois. Et, caisse
 * masquée (drapeau NEXT_PUBLIC_ONLINE_CHECKOUT absent, le défaut sous
 * Jest), toute boutique naît en WhatsApp avec un numéro.
 */
import { NextRequest } from "next/server";

class KnownError extends Error {
  constructor(public code: string, public meta?: Record<string, unknown>) {
    super(code);
  }
}
jest.mock("../../prisma/generated/client/client", () => ({
  Prisma: { PrismaClientKnownRequestError: KnownError },
}));

let _user: { id: string } | null = { id: "u-1" };
let _existingShop: { id: string; slug: string } | null = null;
let _claimCount = 1;
let _createError: Error | null = null;
const _writes: Array<[string, unknown]> = [];
const tx = {
  profile: {
    updateMany: jest.fn(async (args: unknown) => { _writes.push(["tx.profile.updateMany", args]); return { count: _claimCount }; }),
  },
  shop: {
    create: jest.fn(async (args: unknown) => {
      if (_createError) throw _createError;
      _writes.push(["shop.create", args]);
      return { id: "shop-1" };
    }),
  },
  pageBlock: { createMany: jest.fn(async (args: unknown) => { _writes.push(["pageBlock.createMany", args]); return { count: 1 }; }) },
};
const profileUpdateMany = jest.fn(async (args: unknown) => { _writes.push(["profile.updateMany", args]); return { count: 1 }; });
jest.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findFirst: jest.fn(async () => _existingShop) },
    profile: { updateMany: (args: unknown) => profileUpdateMany(args) },
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
  _claimCount = 1;
  _createError = null;
  _writes.length = 0;
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
});

test("crée profil (drapeau posé d'emblée, sous verrou), boutique non publiée et blocs, sans objectif obligatoire", async () => {
  const res = await post(BODY);
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ shopId: "shop-1" });
  expect(_writes.map(([name]) => name)).toEqual(["tx.profile.updateMany", "shop.create", "pageBlock.createMany"]);
  expect(_writes[0]![1]).toEqual({
    where: { id: "u-1", onboardingCompleted: false },
    data: { fullName: "Amara Diallo", username: "amara", onboardingCompleted: true },
  });
  expect((_writes[1]![1] as { data: Record<string, unknown> }).data).toMatchObject({ isPublished: false, intentions: [], whatsappNumber: "+22670123456" });
});

test("rejoué avec une boutique existante → 409 ALREADY_ONBOARDED avec le slug, drapeau réparé, rien d'autre écrit", async () => {
  _existingShop = { id: "shop-0", slug: "ma-boutique" };
  const res = await post(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: "ALREADY_ONBOARDED", shopId: "shop-0", slug: "ma-boutique" });
  expect(profileUpdateMany).toHaveBeenCalledWith({ where: { id: "u-1", onboardingCompleted: false }, data: { onboardingCompleted: true } });
  expect(_writes.map(([name]) => name)).toEqual(["profile.updateMany"]);
});

test("deux envois simultanés : le second ne prend pas le verrou et reçoit 409, sans boutique", async () => {
  _claimCount = 0;
  _existingShop = null; // la lecture rapide n'a rien vu…
  const res = await post(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: "ALREADY_ONBOARDED" });
  expect(tx.shop.create).not.toHaveBeenCalled();
  expect(_writes.map(([name]) => name)).toEqual(["tx.profile.updateMany"]);
});

test("pseudo ou adresse pris entre-temps → 409 avec le champ désigné", async () => {
  _createError = new KnownError("P2002", { target: ["slug"] });
  let res = await post(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: "SLUG_TAKEN" });
  _createError = new KnownError("P2002", { target: ["username"] });
  res = await post(BODY);
  expect(await res.json()).toMatchObject({ code: "USERNAME_TAKEN" });
  _createError = new Error("boom");
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await post(BODY)).status).toBe(500);
  error.mockRestore();
});

test("anonyme → 401 ; numéro WhatsApp sans indicatif → 422", async () => {
  _user = null;
  expect((await post(BODY)).status).toBe(401);
  _user = { id: "u-1" };
  expect((await post({ ...BODY, shop: { ...BODY.shop, whatsappNumber: "70123456" } })).status).toBe(422);
});

describe("caisse masquée (drapeau absent)", () => {
  test("le mode « online » est refusé (422), rien n'est écrit", async () => {
    const res = await post({ ...BODY, shop: { ...BODY.shop, checkoutMode: "online", whatsappNumber: null } });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "ONLINE_CHECKOUT_DISABLED" });
    expect(_writes).toEqual([]);
  });

  test("le numéro WhatsApp est obligatoire (422), absent ou vide", async () => {
    for (const whatsappNumber of [undefined, null, ""]) {
      const res = await post({ ...BODY, shop: { ...BODY.shop, whatsappNumber } });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ code: "WHATSAPP_NUMBER_REQUIRED" });
    }
    expect(_writes).toEqual([]);
  });

  test("un mode inconnu est refusé (422) : le schéma est strict", async () => {
    expect((await post({ ...BODY, shop: { ...BODY.shop, checkoutMode: "cash" } })).status).toBe(422);
    expect(_writes).toEqual([]);
  });

  test("le cas nominal WhatsApp passe toujours", async () => {
    expect((await post(BODY)).status).toBe(201);
    expect((_writes[1]![1] as { data: Record<string, unknown> }).data).toMatchObject({ checkoutMode: "whatsapp", whatsappNumber: "+22670123456" });
  });
});

describe("caisse allumée (NEXT_PUBLIC_ONLINE_CHECKOUT=1)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
  });

  test("le mode « online » est accepté, sans numéro WhatsApp", async () => {
    const res = await post({ ...BODY, shop: { ...BODY.shop, checkoutMode: "online", whatsappNumber: null } });
    expect(res.status).toBe(201);
    expect((_writes[1]![1] as { data: Record<string, unknown> }).data).toMatchObject({ checkoutMode: "online", whatsappNumber: null });
  });
});
