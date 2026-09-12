/**
 * E-mails de reversement : jamais bloquants, identifiants masqués côté
 * vendeur, relance quotidienne des demandes en souffrance.
 */

const mockSend = jest.fn<Promise<{ skipped: false; id: string }>, [unknown]>(async () => ({ skipped: false as const, id: "email_1" }));
jest.mock("@/lib/email", () => ({
  sendTransactionalEmail: (message: unknown) => mockSend(message),
  escapeEmailHtml: (value: string) => value,
}));

let _payout: Record<string, unknown> | null = null;
let _stale: Array<Record<string, unknown>> = [];
jest.mock("@/lib/prisma", () => ({
  prisma: {
    payout: {
      findUnique: jest.fn(async () => _payout),
      findMany: jest.fn(async () => _stale),
    },
  },
}));

import {
  maskIdentifier,
  notifyPayoutAccountChanged,
  notifyPayoutPaid,
  notifyPayoutRequested,
  remindStalePayouts,
} from "@/lib/payouts/notifications";

const sent = () => mockSend.mock.calls.map((call) => call[0] as { to: string; subject: string; text: string; html: string; idempotencyKey?: string });

beforeEach(() => {
  mockSend.mockClear();
  mockSend.mockImplementation(async () => ({ skipped: false as const, id: "email_1" }));
  process.env.ADMIN_EMAILS = "equipe@bio-lien.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.bio-lien.com";
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  _payout = {
    id: "p1",
    amount: 12_000,
    currency: "XOF",
    status: "requested",
    provider: "wave",
    reference: null,
    note: null,
    destination: { provider: "wave", accountName: "Awa", accountIdentifier: "22670123456", country: "BF", isVerified: false, accountUpdatedAt: new Date().toISOString() },
    createdAt: new Date(),
    shop: { name: "Wax & Co", slug: "wax", contactEmail: null, owner: { user: { email: "awa@example.com", name: "Awa" } } },
  };
  _stale = [];
});

afterEach(() => jest.restoreAllMocks());

describe("maskIdentifier", () => {
  test("montre l'indicatif et les 4 derniers chiffres, ou le début et la fin d'un IBAN", () => {
    expect(maskIdentifier("22670123456", true)).toBe("+226…3456");
    expect(maskIdentifier("CI93CI00123456789012", false)).toBe("CI93…9012");
    expect(maskIdentifier("1234", true)).toBe("+1234");
  });
});

describe("notifyPayoutRequested", () => {
  test("l'équipe reçoit l'identifiant complet et l'alerte « compte récent », le vendeur un identifiant masqué", async () => {
    await notifyPayoutRequested("p1");
    const [admin, seller] = sent();
    expect(admin.to).toBe("equipe@bio-lien.com");
    expect(admin.text).toContain("+22670123456");
    expect(admin.text).toMatch(/jamais vérifié/);
    expect(seller.to).toBe("awa@example.com");
    expect(seller.text).toContain("+226…3456");
    expect(seller.text).not.toContain("22670123456");
  });

  test("un envoi qui échoue ne fait pas échouer la demande ; ADMIN_EMAILS vide est journalisé en erreur", async () => {
    mockSend.mockImplementation(async () => {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production.");
    });
    await expect(notifyPayoutRequested("p1")).resolves.toBeUndefined();

    delete process.env.ADMIN_EMAILS;
    mockSend.mockClear();
    await notifyPayoutRequested("p1");
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_EMAILS/), "p1");
    expect(sent().map((m) => m.to)).toEqual(["awa@example.com"]);
  });
});

describe("notifyPayoutPaid / notifyPayoutAccountChanged", () => {
  test("le vendeur reçoit la référence et un identifiant masqué", async () => {
    _payout = { ..._payout!, status: "paid", reference: "WAVE-1" };
    await notifyPayoutPaid("p1");
    const [mail] = sent();
    expect(mail.text).toContain("WAVE-1");
    expect(mail.text).toContain("+226…3456");
  });

  test("changement de compte : alerte à l'adresse de connexion, avant/après masqués", async () => {
    await notifyPayoutAccountChanged({
      loginEmail: "login@example.com",
      shopName: "Wax & Co",
      previous: { provider: "wave", accountIdentifier: "22670123456" },
      next: { provider: "bank", accountIdentifier: "CI93CI00123456789012" },
    });
    const [mail] = sent();
    expect(mail.to).toBe("login@example.com");
    expect(mail.text).toContain("Avant : Wave +226…3456");
    expect(mail.text).toContain("Maintenant : Virement bancaire CI93…9012");
    expect(mail.text).not.toContain("22670123456");
  });
});

describe("remindStalePayouts", () => {
  test("rien à relancer → aucun envoi", async () => {
    expect(await remindStalePayouts()).toEqual({ stale: 0, reminded: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("demandes de plus de deux jours → un e-mail par admin, idempotent par jour", async () => {
    _stale = [
      { id: "p1", amount: 12_000, currency: "XOF", createdAt: new Date("2026-09-08T10:00:00Z"), shop: { name: "Wax & Co", slug: "wax" } },
      { id: "p2", amount: 7_500, currency: "XOF", createdAt: new Date("2026-09-09T10:00:00Z"), shop: { name: "Bissap", slug: "bissap" } },
    ];
    const now = new Date("2026-09-12T03:00:00Z");
    expect(await remindStalePayouts(now)).toEqual({ stale: 2, reminded: 1 });
    const [mail] = sent();
    expect(mail.subject).toMatch(/^2 reversement/);
    expect(mail.text).toContain("Wax & Co (wax)");
    expect(mail.idempotencyKey).toBe("payout-reminder/2026-09-12/equipe@bio-lien.com");
  });

  test("sans ADMIN_EMAILS : compte les retards, journalise en erreur, n'envoie rien", async () => {
    delete process.env.ADMIN_EMAILS;
    _stale = [{ id: "p1", amount: 12_000, currency: "XOF", createdAt: new Date("2026-09-08T10:00:00Z"), shop: { name: "Wax & Co", slug: "wax" } }];
    expect(await remindStalePayouts()).toEqual({ stale: 1, reminded: 0 });
    expect(console.error).toHaveBeenCalled();
  });
});
