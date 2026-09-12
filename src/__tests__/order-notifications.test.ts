/**
 * Notifications après paiement : le vendeur doit TOUJOURS recevoir un e-mail,
 * qu'il ait ou non un numéro WhatsApp, que l'API Cloud soit configurée ou
 * non. C'était le trou n°1 de l'audit : sans WhatsApp Cloud (vide en prod),
 * une commande payée ne prévenait personne.
 */

const ORDER_ID = "0f8a7b6c-1111-4222-8333-444455556666";

type Sent = { to: string; subject: string; text: string; html?: string; idempotencyKey?: string };
const _emails: Sent[] = [];
let _shop: Record<string, unknown> | null = null;
let _cloudConfigured = false;
const _cloud: string[] = [];
let _stockShortfall: unknown = null;

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(async () => ({
        id: ORDER_ID,
        shopId: "shop-1",
        totalAmount: 15000,
        currency: "XOF",
        buyerName: "Awa Diop",
        buyerPhone: "+221771234567",
        buyerEmail: "awa@example.com",
        shippingAddress: { address: "Rue 12", city: "Dakar", country: "SN" },
        items: [
          {
            quantity: 2,
            product_snapshot: { product_name: "Pagne wax", variant_name: "2 m" },
          },
        ],
        trackingToken: "tok-123",
        stockShortfall: _stockShortfall,
      })),
    },
    shop: { findUnique: jest.fn(async () => _shop) },
    digitalDownload: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock("@/lib/email", () => ({
  sendTransactionalEmail: jest.fn(async (m: Sent) => {
    _emails.push(m);
  }),
  escapeEmailHtml: (v: string) => v,
}));

jest.mock("@/lib/whatsapp", () => ({
  buildWaMeLink: (n: string) => `https://wa.me/${n}`,
  formatOrderMessageForSeller: () => "message",
  isWhatsAppCloudConfigured: () => _cloudConfigured,
  sendOrderTemplate: jest.fn(async (to: string) => {
    _cloud.push(`template:${to}`);
    return true;
  }),
  sendCloudApiMessage: jest.fn(async () => true),
}));

import { notifySellerOfPaidOrder, notifyPaidOrder } from "@/lib/order-notifications";

beforeEach(() => {
  _emails.length = 0;
  _cloud.length = 0;
  _cloudConfigured = false;
  _stockShortfall = null;
  _shop = {
    name: "Boutique Awa",
    whatsappNumber: null,
    contactEmail: null,
    owner: { user: { email: "vendeuse@example.com" } },
  };
});

describe("notifySellerOfPaidOrder", () => {
  it("envoie un e-mail au propriétaire même sans numéro WhatsApp ni API Cloud", async () => {
    await notifySellerOfPaidOrder(ORDER_ID);

    expect(_emails).toHaveLength(1);
    const mail = _emails[0];
    expect(mail.to).toBe("vendeuse@example.com");
    expect(mail.subject).toContain("Nouvelle commande payée");
    // toLocaleString("fr-FR") insère une espace insécable comme séparateur.
    expect(mail.subject.replace(/\u202f|\u00a0/g, " ")).toContain("15 000 FCFA");
    expect(mail.text).toContain("Pagne wax — 2 m × 2");
    expect(mail.text).toContain("+221771234567");
    expect(mail.text).toContain("Dakar");
    expect(mail.text).toContain(`/dashboard/orders?focus=${ORDER_ID}`);
    // Un webhook rejoué ne doit pas doubler l'e-mail.
    expect(mail.idempotencyKey).toBe(`order-seller/${ORDER_ID}`);
    expect(_cloud).toHaveLength(0);
  });

  it("préfère l'e-mail de contact de la boutique à celui du compte", async () => {
    _shop = { ..._shop!, contactEmail: "contact@boutique-awa.com" };
    await notifySellerOfPaidOrder(ORDER_ID);
    expect(_emails.map((m) => m.to)).toEqual(["contact@boutique-awa.com"]);
  });

  it("envoie AUSSI sur WhatsApp Cloud quand numéro et API sont là, sans supprimer l'e-mail", async () => {
    _shop = { ..._shop!, whatsappNumber: "221771112233" };
    _cloudConfigured = true;
    await notifySellerOfPaidOrder(ORDER_ID);
    expect(_emails).toHaveLength(1);
    expect(_cloud).toEqual(["template:221771112233"]);
  });

  it("l'échec de l'e-mail n'empêche pas WhatsApp, et inversement", async () => {
    const email = jest.requireMock("@/lib/email") as { sendTransactionalEmail: jest.Mock };
    email.sendTransactionalEmail.mockRejectedValueOnce(new Error("Resend down"));
    _shop = { ..._shop!, whatsappNumber: "221771112233" };
    _cloudConfigured = true;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(notifySellerOfPaidOrder(ORDER_ID)).resolves.toBeUndefined();
    expect(_cloud).toEqual(["template:221771112233"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ne fait rien si la commande n'existe pas", async () => {
    const prisma = jest.requireMock("@/lib/prisma") as { prisma: { order: { findUnique: jest.Mock } } };
    prisma.prisma.order.findUnique.mockResolvedValueOnce(null);
    await notifySellerOfPaidOrder(ORDER_ID);
    expect(_emails).toHaveLength(0);
  });
});

describe("notifySellerOfPaidOrder — stock insuffisant au paiement", () => {
  it("prévient le vendeur dans l'e-mail (texte et HTML) et par WhatsApp en texte, jamais via le template", async () => {
    _stockShortfall = [{ product_id: "p1", variant_id: null, product_name: "Pagne wax", requested: 2, taken: 1 }];
    _cloudConfigured = true;
    _shop = { ..._shop!, whatsappNumber: "221771234567" };
    const whatsapp = jest.requireMock("@/lib/whatsapp") as { sendCloudApiMessage: jest.Mock; sendOrderTemplate: jest.Mock };
    whatsapp.sendCloudApiMessage.mockClear();
    whatsapp.sendOrderTemplate.mockClear();

    await notifySellerOfPaidOrder(ORDER_ID);

    const mail = _emails.find((m) => m.to === "vendeuse@example.com")!;
    expect(mail.text).toMatch(/stock insuffisant au moment du paiement — Pagne wax : 1 sur 2 disponible/i);
    expect(mail.text).toMatch(/livrer plus tard ou remplacer/);
    expect(mail.html).toMatch(/Pagne wax : 1 sur 2/);
    expect(whatsapp.sendOrderTemplate).not.toHaveBeenCalled();
    expect(whatsapp.sendCloudApiMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "221771234567", body: expect.stringMatching(/⚠️ Attention : stock insuffisant/) }),
    );
  });

  it("sans manque : e-mail sans avertissement, template WhatsApp inchangé", async () => {
    _cloudConfigured = true;
    _shop = { ..._shop!, whatsappNumber: "221771234567" };
    await notifySellerOfPaidOrder(ORDER_ID);
    const mail = _emails.find((m) => m.to === "vendeuse@example.com")!;
    expect(mail.text).not.toMatch(/stock insuffisant/i);
    expect(_cloud).toEqual(["template:221771234567"]);
  });
});

describe("notifyPaidOrder", () => {
  it("prévient l'acheteur ET le vendeur", async () => {
    await notifyPaidOrder(ORDER_ID);
    const to = _emails.map((m) => m.to).sort();
    expect(to).toEqual(["awa@example.com", "vendeuse@example.com"]);
  });
});
