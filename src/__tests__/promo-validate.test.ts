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
  };
  mockFindUnique.mockClear();
  mockEnforce.mockReset();
  mockEnforce.mockResolvedValue(null);
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
});
