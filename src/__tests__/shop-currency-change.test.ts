/**
 * PATCH /api/shops/[id] : on ne change pas de devise tant qu'il reste du net
 * vendeur à reverser dans l'ancienne — sinon cet argent disparaît de l'écran.
 * Et, caisse masquée (drapeau NEXT_PUBLIC_ONLINE_CHECKOUT absent), le mode
 * « online », la livraison et le retrait du numéro WhatsApp sont refusés.
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
let _subscription: { plan: string; status: string; provider: string; currentPeriodEnd: Date | null } | null = null;
let _badgeInDb = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockZonesDeactivate = jest.fn(async (_args: unknown) => ({ count: 2 }));
const txMock = {
  shop: { update: (args: { data: Record<string, unknown> }) => mockUpdate(args) },
  shippingZone: { updateMany: (args: unknown) => mockZonesDeactivate(args) },
};
jest.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findFirst: jest.fn(async () => ({ id: SHOP_ID, slug: "wax", currency: "XOF", showBioLienBadge: _badgeInDb })),
      update: (args: { data: Record<string, unknown> }) => mockUpdate(args),
    },
    creatorSubscription: { findUnique: jest.fn(async () => _subscription) },
    $transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
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
  _subscription = null;
  _badgeInDb = true;
});

// Sous Jest la variable est absente : caisse masquée par défaut. Les cas
// « En ligne » l'allument explicitement et la retirent ensuite.
afterEach(() => {
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
});

describe("badge Bio-Lien", () => {
  test("le masquer est refusé (402) sur le plan gratuit, accepté sur un plan payant en cours", async () => {
    const res = await patch({ show_biolien_badge: false });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "PLAN_REQUIRED" });
    expect(mockUpdate).not.toHaveBeenCalled();

    _subscription = { plan: "starter", status: "active", provider: "geniuspay", currentPeriodEnd: new Date(Date.now() + 86_400_000) };
    expect((await patch({ show_biolien_badge: false })).status).toBe(200);
    expect(mockUpdate.mock.calls[0]![0].data).toMatchObject({ showBioLienBadge: false });

    // Plan échu : de nouveau gratuit.
    _subscription = { ..._subscription, currentPeriodEnd: new Date(Date.now() - 86_400_000) };
    expect((await patch({ show_biolien_badge: false })).status).toBe(402);
    // Le réafficher reste toujours possible.
    expect((await patch({ show_biolien_badge: true })).status).toBe(200);
    // Renvoyer la valeur déjà en base (réglage pris pendant le plan payant)
    // ne bloque pas l'enregistrement des couleurs d'un plan échu.
    _badgeInDb = false;
    expect((await patch({ show_biolien_badge: false, theme_color: "#123456" })).status).toBe(200);
  });
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
    // Les zones tarifées dans l'ancienne devise sont désactivées : un
    // « 1 500 » FCFA ne devient pas 1 500 cédis sans relecture.
    expect(mockZonesDeactivate).toHaveBeenCalledWith({
      where: { shopId: SHOP_ID, currency: { not: "GHS" } },
      data: { isActive: false },
    });
    mockZonesDeactivate.mockClear();
    _balance = { ..._balance, available: 45_000 };
    expect((await patch({ currency: "XOF" })).status).toBe(200);
    expect(mockZonesDeactivate).not.toHaveBeenCalled();
    expect((await patch({ name: "Wax & Co" })).status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  test("le message du solde restant renvoie vers l'équipe caisse masquée, vers Reversements caisse allumée", async () => {
    _balance = { ..._balance, available: 45_000 };
    let json = await (await patch({ currency: "GHS" })).json();
    expect(json.code).toBe("OUTSTANDING_BALANCE");
    expect(json.error).toMatch(/Écris à l'équipe Bio-Lien/);
    expect(json.error).not.toMatch(/Reversements/);

    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    json = await (await patch({ currency: "GHS" })).json();
    expect(json.code).toBe("OUTSTANDING_BALANCE");
    expect(json.error).toMatch(/Paiements → Reversements/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("mode de commande (drapeau NEXT_PUBLIC_ONLINE_CHECKOUT)", () => {
  test("caisse masquée : « online » refusé (422), accepté caisse allumée ; valeur inconnue toujours refusée", async () => {
    let res = await patch({ checkout_mode: "online" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "ONLINE_CHECKOUT_DISABLED" });
    // WhatsApp reste enregistrable : c'est le seul mode qui s'applique.
    expect((await patch({ checkout_mode: "whatsapp" })).status).toBe(200);
    expect(mockUpdate.mock.calls[0]![0].data).toMatchObject({ checkoutMode: "whatsapp" });
    mockUpdate.mockClear();

    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    res = await patch({ checkout_mode: "online" });
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0]![0].data).toMatchObject({ checkoutMode: "online" });

    // Le schéma est strict dans les deux modes : plus de chaîne libre.
    expect((await patch({ checkout_mode: "foo" })).status).toBe(422);
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect((await patch({ checkout_mode: "foo" })).status).toBe(422);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  test("caisse masquée : retirer le numéro WhatsApp est refusé (422), le changer reste possible", async () => {
    const res = await patch({ whatsapp_number: null });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "WHATSAPP_NUMBER_REQUIRED" });
    expect((await patch({ whatsapp_number: "" })).status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();

    expect((await patch({ whatsapp_number: "22670123456" })).status).toBe(200);
    expect(mockUpdate.mock.calls[0]![0].data).toMatchObject({ whatsappNumber: "22670123456" });
    // Un numéro sans indicatif reste refusé, drapeau ou pas.
    expect((await patch({ whatsapp_number: "70123456" })).status).toBe(422);

    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect((await patch({ whatsapp_number: null })).status).toBe(200);
  });

  test("caisse masquée : livraison facturée et paiement à la livraison refusés (422), acceptés caisse allumée", async () => {
    for (const body of [{ shipping_enabled: true }, { shipping_enabled: false }, { cash_on_delivery: true }]) {
      const res = await patch(body);
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ code: "ONLINE_CHECKOUT_DISABLED" });
    }
    expect(mockUpdate).not.toHaveBeenCalled();

    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect((await patch({ shipping_enabled: true, cash_on_delivery: true })).status).toBe(200);
    expect(mockUpdate.mock.calls[0]![0].data).toMatchObject({ shippingEnabled: true, cashOnDelivery: true });
  });
});
