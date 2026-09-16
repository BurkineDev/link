/**
 * POST /api/promo-codes/validate — limitation par IP puis par boutique.
 */

import { NextRequest } from "next/server";

type Rule = { name: string; key: string; limit: number; windowSeconds: number };

let _promo: Record<string, unknown> | null = null;
const mockFindUnique = jest.fn<Promise<Record<string, unknown> | null>, [unknown?]>(async () => _promo);
jest.mock("@/lib/prisma", () => ({
  prisma: { promoCode: { findUnique: (args?: unknown) => mockFindUnique(args) } },
}));

const mockEnforce = jest.fn<Promise<Response | null>, [Rule[]]>(async () => null);
jest.mock("@/lib/rate-limit", () => ({
  enforceLimits: (rules: Rule[]) => mockEnforce(rules),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));

import { POST } from "@/app/api/promo-codes/validate/route";

const SHOP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/promo-codes/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function blocked(): Response {
  const { NextResponse } = jest.requireActual("next/server") as typeof import("next/server");
  return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
}

beforeEach(() => {
  _promo = {
    discountType: "percent",
    discountValue: 10,
    minOrderAmount: null,
    maxUses: null,
    usesCount: 0,
    expiresAt: null,
    isActive: true,
    shop: { currency: "XOF" },
  };
  mockFindUnique.mockClear();
  mockEnforce.mockReset();
  mockEnforce.mockResolvedValue(null);
  // Les codes promo n'existent qu'à la caisse Bio-Lien, masquée par défaut
  // (décision du 14 septembre 2026) : ces cas la supposent rallumée.
  process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
});

describe("POST /api/promo-codes/validate", () => {
  test("code valide : remise calculée, deux règles appliquées (IP puis boutique)", async () => {
    const res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 10_000 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, discount: 1000, discount_type: "percent" });

    expect(mockEnforce).toHaveBeenCalledTimes(2);
    const [ipRules] = mockEnforce.mock.calls[0]!;
    const [shopRules] = mockEnforce.mock.calls[1]!;
    expect(ipRules[0]).toMatchObject({ name: "promo:ip", key: "203.0.113.7" });
    expect(shopRules[0]).toMatchObject({ name: "promo:shop", key: SHOP_ID });
  });

  test("limite IP atteinte : 429 avant de lire le corps ou la base", async () => {
    mockEnforce.mockResolvedValueOnce(blocked());

    const res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 10_000 }));

    expect(res.status).toBe(429);
    expect(mockEnforce).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("limite boutique atteinte : 429 sans lire la base", async () => {
    mockEnforce.mockResolvedValueOnce(null).mockResolvedValueOnce(blocked());

    const res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 10_000 }));

    expect(res.status).toBe(429);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("corps invalide : 422, la règle par boutique n'est pas évaluée", async () => {
    const res = await POST(makeRequest({ shopId: "pas-un-uuid", code: "X", orderTotal: -1 }));

    expect(res.status).toBe(422);
    expect(mockEnforce).toHaveBeenCalledTimes(1);
  });

  test("code introuvable : 404", async () => {
    _promo = null;
    const res = await POST(makeRequest({ shopId: SHOP_ID, code: "INCONNU", orderTotal: 10_000 }));
    expect(res.status).toBe(404);
  });

  test("drapeau éteint : 404 après la règle IP, sans lire le corps ni la base", async () => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;

    const res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 10_000 }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Introuvable" });
    // Seule la règle IP a tourné : ni la règle par boutique, ni la base.
    expect(mockEnforce).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).not.toHaveBeenCalled();

    // Un client bloqué reste bloqué : le 429 passe avant le 404.
    mockEnforce.mockResolvedValueOnce(blocked());
    expect((await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 10_000 }))).status).toBe(429);
  });
});

describe("arrondi de la remise", () => {
  test("pourcentage arrondi à la précision de la devise de la boutique, comme à la consommation", async () => {
    _promo = { ..._promo!, discountValue: 10, shop: { currency: "XOF" } };
    let res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 1_995 }));
    expect(await res.json()).toMatchObject({ ok: true, discount: 200 });

    _promo = { ..._promo!, shop: { currency: "EUR" } };
    res = await POST(makeRequest({ shopId: SHOP_ID, code: "BIENVENUE", orderTotal: 15.6 }));
    expect(await res.json()).toMatchObject({ ok: true, discount: 1.56 });
  });
});

/**
 * Caisse masquée : on ne modifie plus de code promo (aucun acheteur ne peut
 * en saisir) ; la lecture et la suppression restent. La route de création
 * importe le client Prisma généré (non chargeable sous Jest) : couverte par
 * la même garde, testée ici sur PATCH.
 */
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(async () => {
    throw new Error("getCurrentUser ne doit pas être appelé : 404 avant l'authentification");
  }),
}));

describe("codes promo (vendeur) — caisse masquée", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  });

  test("PATCH /api/promo-codes/[id] répond 404 avant toute authentification ou lecture", async () => {
    const { NextRequest } = await import("next/server");
    const { PATCH } = await import("@/app/api/promo-codes/[id]/route");
    const patched = await PATCH(
      new NextRequest("http://localhost:3000/api/promo-codes/p1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(patched.status).toBe(404);
  });
});
