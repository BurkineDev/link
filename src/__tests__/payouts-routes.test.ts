/**
 * Routes de reversement : qui peut faire quoi.
 *
 * Le point critique : un vendeur connecté ne doit jamais pouvoir marquer sa
 * propre demande « versée » (c'est cela qui écrit la ligne comptable).
 */

import { NextRequest } from "next/server";

let _user: { id: string; email: string } | null = null;
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(async () => _user),
  requireUser: jest.fn(async () => _user),
}));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const mockMarkPaid = jest.fn(async () => ({ ok: true as const }));
const mockRequest = jest.fn(async () => ({ ok: true as const, payoutId: "33333333-3333-4333-8333-333333333333", amount: 12_000, currency: "XOF" }));
jest.mock("@/lib/payouts/requests", () => ({
  markPayoutPaid: (...args: unknown[]) => mockMarkPaid(...(args as [])),
  markPayoutFailed: jest.fn(),
  markPayoutBounced: jest.fn(),
  markPayoutProcessing: jest.fn(),
  requestPayout: (...args: unknown[]) => mockRequest(...(args as [])),
}));
jest.mock("@/lib/payouts/notifications", () => ({
  notifyPayoutPaid: jest.fn(),
  notifyPayoutFailed: jest.fn(),
  notifyPayoutBounced: jest.fn(),
  notifyPayoutRequested: jest.fn(),
}));
jest.mock("@/lib/after-response", () => ({ scheduleAfterResponse: jest.fn() }));

const mockPrisma = {
  shop: { findFirst: jest.fn(async () => ({ id: "22222222-2222-4222-8222-222222222222", currency: "XOF" })) },
  payout: {
    findUniqueOrThrow: jest.fn(async () => ({
      id: "33333333-3333-4333-8333-333333333333",
      amount: 12_000,
      currency: "XOF",
      status: "requested",
      provider: "wave",
      reference: null,
      note: null,
      destination: null,
      periodStart: null,
      periodEnd: null,
      paidAt: null,
      createdAt: new Date("2026-09-12T00:00:00Z"),
    })),
    findMany: jest.fn(async () => []),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/payouts/balance-db", () => ({
  loadBalance: jest.fn(async () => ({ currency: "XOF", available: 0, maturing: 0, reserved: 0, paidOut: 0, oldestUnpaidAt: null, nextMaturityAt: null })),
}));

import { PATCH } from "@/app/api/admin/payouts/[id]/route";
import { GET as adminList } from "@/app/api/admin/payouts/route";
import { POST as requestPost, GET as sellerGet } from "@/app/api/payouts/route";

const PAYOUT_ID = "33333333-3333-4333-8333-333333333333";

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost:3000/api/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  _user = null;
  process.env.ADMIN_EMAILS = "equipe@bio-lien.com";
  mockMarkPaid.mockClear();
  mockRequest.mockClear();
});

describe("PATCH /api/admin/payouts/[id]", () => {
  test("anonyme → 403, vendeur connecté non admin → 403, rien n'est écrit", async () => {
    expect((await patch(PAYOUT_ID, { action: "paid", reference: "W-1" })).status).toBe(403);
    _user = { id: "u1", email: "vendeur@example.com" };
    expect((await patch(PAYOUT_ID, { action: "paid", reference: "W-1" })).status).toBe(403);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  test("admin (casse ignorée) → 200 et le versement est enregistré", async () => {
    _user = { id: "u2", email: "Equipe@Bio-Lien.com" };
    const res = await patch(PAYOUT_ID, { action: "paid", reference: "W-1" });
    expect(res.status).toBe(200);
    expect(mockMarkPaid).toHaveBeenCalledWith(PAYOUT_ID, { reference: "W-1", note: null });
  });

  test("ADMIN_EMAILS vide : personne n'est admin", async () => {
    delete process.env.ADMIN_EMAILS;
    _user = { id: "u2", email: "equipe@bio-lien.com" };
    expect((await patch(PAYOUT_ID, { action: "paid", reference: "W-1" })).status).toBe(403);
  });

  test("identifiant non UUID → 400 avant toute écriture ; corps invalide → 422", async () => {
    _user = { id: "u2", email: "equipe@bio-lien.com" };
    expect((await patch("------------------------------------", { action: "paid", reference: "W-1" })).status).toBe(400);
    expect((await patch(PAYOUT_ID, { action: "paid" })).status).toBe(422);
    expect((await patch(PAYOUT_ID, { action: "failed", note: "x" })).status).toBe(422);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/payouts", () => {
  test("vendeur → 403", async () => {
    _user = { id: "u1", email: "vendeur@example.com" };
    expect((await adminList(new NextRequest("http://localhost:3000/api/admin/payouts"))).status).toBe(403);
  });
});

describe("/api/payouts (vendeur)", () => {
  test("anonyme → 401 sur GET et POST", async () => {
    expect((await sellerGet()).status).toBe(401);
    expect((await requestPost()).status).toBe(401);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test("vendeur connecté → 201 avec la demande", async () => {
    _user = { id: "u1", email: "vendeur@example.com" };
    const res = await requestPost();
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.payout).toMatchObject({ id: PAYOUT_ID, amount: 12_000, status: "requested" });
  });
});
