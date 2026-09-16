/**
 * buildDigest / sendDailyDigest : la partie du rapport quotidien qui lit la
 * base — fenêtre de 24 h, compteur des commandes WhatsApp marquées payées,
 * drapeau du mode « En ligne » recopié dans les données (formatDigestEmail
 * reste pure), et l'envoi à ADMIN_EMAILS.
 */

type CountArgs = { where: Record<string, unknown> };

let _whatsappPaid = 0;
let _counts: CountArgs[] = [];

const mockPrisma = {
  opsEvent: {
    findMany: jest.fn(async () => []),
    groupBy: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
  transactionLedger: {
    groupBy: jest.fn(async () => []),
  },
  order: {
    // Quatre comptages distincts, reconnus à la forme du `where`.
    count: jest.fn(async (args: CountArgs) => {
      _counts.push(args);
      if (args.where.statusEvents) return _whatsappPaid;
      if (args.where.paymentProvider && args.where.createdAt) return 1;
      if (args.where.paymentProvider) return 2;
      return 5;
    }),
  },
  payout: {
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockHealth = {
  ok: true,
  checkedAt: "2026-09-14T03:00:00.000Z",
  version: "bf9c2f6",
  environment: "production",
  database: { ok: true, latencyMs: 40, error: null },
  migrations: { ok: true, pending: [], latest: "20260914020000_ops_events", embedded: 6 },
  cron: { lastRunAt: null, stale: false, enforced: true },
  alerts: { openCritical: 0, openWarning: 0 },
  email: { configured: true, dead: false },
};
jest.mock("@/lib/ops/health", () => ({ getHealth: jest.fn(async () => mockHealth) }));

type Sent = { to: string; subject: string; text: string; idempotencyKey?: string };
const mockSend = jest.fn(async (message: Sent) => ({ id: `email-${message.to}` }));
jest.mock("@/lib/email", () => ({
  sendTransactionalEmail: (message: Sent) => mockSend(message),
  escapeEmailHtml: (value: string) => value,
}));

import { buildDigest, sendDailyDigest, type CronSummary } from "@/lib/ops/digest";

const NOW = new Date("2026-09-14T03:00:00Z");
const SINCE = new Date("2026-09-13T03:00:00Z");

beforeEach(() => {
  _whatsappPaid = 0;
  _counts = [];
  mockSend.mockClear();
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  delete process.env.ADMIN_EMAILS;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  delete process.env.ADMIN_EMAILS;
});

describe("buildDigest", () => {
  test("drapeau éteint : onlineCheckout = false, fenêtre de 24 h, compteurs recopiés", async () => {
    _whatsappPaid = 3;

    const data = await buildDigest({ now: NOW });

    expect(data.onlineCheckout).toBe(false);
    expect(data.whatsappPaid).toBe(3);
    expect(data.date).toBe("2026-09-14");
    expect(data.window).toEqual({ from: SINCE.toISOString(), to: NOW.toISOString() });
    expect(data.ordersCreated).toBe(5);
    expect(data.offlineAwaiting).toEqual({ count: 2, expiringSoon: 1 });
    expect(data.sales).toEqual({ paidOrders: 0, byCurrency: [] });
    expect(data.payoutsOpen).toEqual({ count: 0, oldestDays: null });
    expect(data.cron).toBeNull();
  });

  test("les commandes WhatsApp marquées payées : une requête par commande, sur l'événement de règlement (sans acteur) dans la fenêtre", async () => {
    await buildDigest({ now: NOW });

    // Un `count` sur la commande avec `some` : une commande = 1, quel que
    // soit le nombre d'événements. `createdBy: null` écarte les changements
    // de statut du vendeur (ils portent son identifiant), ne garde que
    // l'événement écrit par `settlePaidOrder`.
    const query = _counts.find((call) => call.where.statusEvents);
    expect(query?.where).toEqual({
      paymentProvider: { in: ["manual", "cash_on_delivery"] },
      paymentStatus: "paid",
      statusEvents: {
        some: {
          createdAt: { gte: SINCE },
          createdBy: null,
          status: { in: ["confirmed", "processing", "shipped", "delivered"] },
          publicMessage: { startsWith: "Paiement" },
        },
      },
    });
  });

  test("drapeau allumé : onlineCheckout = true, lu à chaque rapport", async () => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect((await buildDigest({ now: NOW })).onlineCheckout).toBe(true);

    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect((await buildDigest({ now: NOW })).onlineCheckout).toBe(false);
  });

  test("le résumé du cron est recopié tel quel", async () => {
    const cron: CronSummary = {
      reconcile: { checked: 1, paid: 1, failed: 0, stillPending: 0, errors: 0 },
      payouts: { stale: 0, reminded: 0 },
      manualOrders: { expired: 4, errors: 0 },
    };
    expect((await buildDigest({ now: NOW, cron })).cron).toEqual(cron);
  });
});

describe("sendDailyDigest", () => {
  test("sans ADMIN_EMAILS : rien ne part", async () => {
    expect(await sendDailyDigest({ now: NOW })).toEqual({ sent: 0, skipped: "no_recipient" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("un e-mail par adresse, clé d'idempotence par fenêtre et destinataire, rendu WhatsApp drapeau éteint", async () => {
    process.env.ADMIN_EMAILS = "a@bio-lien.test, B@bio-lien.test";
    _whatsappPaid = 2;

    expect(await sendDailyDigest({ now: NOW })).toEqual({ sent: 2, skipped: null });

    expect(mockSend).toHaveBeenCalledTimes(2);
    const first = mockSend.mock.calls[0][0];
    expect(first.to).toBe("a@bio-lien.test");
    expect(first.idempotencyKey).toBe(`ops-digest/${NOW.toISOString()}/a@bio-lien.test`);
    expect(first.text).toContain("- 2 commandes WhatsApp marquées payées.");
    expect(first.text).toContain("Résultat du cron indisponible.");
    expect(mockSend.mock.calls[1][0].to).toBe("b@bio-lien.test");
  });

  test("base en panne : construction impossible, pas d'exception, rien n'est envoyé", async () => {
    process.env.ADMIN_EMAILS = "a@bio-lien.test";
    mockPrisma.order.count.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));

    expect(await sendDailyDigest({ now: NOW })).toEqual({ sent: 0, skipped: "build_failed" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("Resend refuse une adresse : les autres partent, le compte le dit", async () => {
    process.env.ADMIN_EMAILS = "a@bio-lien.test,b@bio-lien.test";
    mockSend.mockRejectedValueOnce(new Error("validation_error"));

    expect(await sendDailyDigest({ now: NOW })).toEqual({ sent: 1, skipped: null });
  });
});
