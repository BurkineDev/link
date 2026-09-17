/**
 * Alertes fondateur — la partie pure : règles d'envoi, mise en forme,
 * aides de santé et rapport quotidien.
 */

// Les modules de santé et de rapport importent le client Prisma (non
// chargeable sous Jest) : on ne teste ici que leurs fonctions pures.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/email", () => {
  const actual = jest.requireActual("@/lib/email") as { classifyResendError: unknown };
  return { sendTransactionalEmail: jest.fn(), escapeEmailHtml: (v: string) => v, classifyResendError: actual.classifyResendError };
});

import {
  ALERT_REPEAT_MS,
  effectiveDedupeKey,
  formatAlertEmail,
  formatAlertWebhook,
  hourBucket,
  notifiesImmediately,
  shouldRenotify,
} from "@/lib/ops/alert";
import { embeddedMigrations, isCronStale, pendingMigrations } from "@/lib/ops/health";
import { formatDigestEmail, type DigestData } from "@/lib/ops/digest";

describe("règles d'envoi", () => {
  test("seul le critique part tout de suite ; le reste attend le rapport", () => {
    expect(notifiesImmediately("critical")).toBe(true);
    expect(notifiesImmediately("warning")).toBe(false);
    expect(notifiesImmediately("info")).toBe(false);
  });

  test("une même clé ne renvoie pas d'e-mail avant six heures", () => {
    const now = new Date("2026-09-14T03:00:00Z");
    expect(shouldRenotify(null, now)).toBe(true);
    expect(shouldRenotify(new Date(now.getTime() - ALERT_REPEAT_MS + 1000), now)).toBe(false);
    expect(shouldRenotify(new Date(now.getTime() - ALERT_REPEAT_MS), now)).toBe(true);
  });

  test("la famille sert de clé par défaut", () => {
    expect(effectiveDedupeKey({ kind: "email.dead" })).toBe("email.dead");
    expect(effectiveDedupeKey({ kind: "email.dead", dedupeKey: "  " })).toBe("email.dead");
    expect(effectiveDedupeKey({ kind: "payment.late_after_cancel", dedupeKey: "payment.late_after_cancel:o1" })).toBe("payment.late_after_cancel:o1");
    expect(hourBucket(new Date("2026-09-14T03:59:59Z"))).toBe("2026-09-14T03");
  });
});

describe("formatAlertEmail", () => {
  const event = {
    kind: "payment.late_after_cancel" as const,
    severity: "critical" as const,
    title: "Paiement reçu sur une commande annulée",
    detail: "Rembourse l'acheteur <script>.",
    context: { orderId: "o1", amount: 6500, currency: "XOF", empty: null },
  };

  test("sujet marqué, corps texte et HTML avec le contexte, lien vers l'écran Santé", () => {
    const mail = formatAlertEmail({ event, occurrences: 3, adminUrl: "https://www.bio-lien.com/dashboard/admin/ops" });
    expect(mail.subject).toBe("🔴 Bio-Lien : Paiement reçu sur une commande annulée");
    expect(mail.text).toContain("(×3)");
    expect(mail.text).toContain("orderId : o1");
    expect(mail.text).toContain("amount : 6500");
    expect(mail.text).not.toContain("empty");
    expect(mail.text).toContain("https://www.bio-lien.com/dashboard/admin/ops");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
  });

  test("l'environnement hors production est nommé dans le sujet", () => {
    const mail = formatAlertEmail({ event, adminUrl: "x", environment: "preview" });
    expect(mail.subject).toContain("[preview]");
    expect(formatAlertEmail({ event, adminUrl: "x", environment: "production" }).subject).not.toContain("[");
  });

  test("le webhook sortant porte un champ text compatible Slack", () => {
    const body = formatAlertWebhook({ event, adminUrl: "https://x/ops" });
    expect(typeof body.text).toBe("string");
    expect(body.text as string).toContain("Paiement reçu");
    expect(body.text as string).toContain("orderId: o1");
    expect(body.severity).toBe("critical");
  });
});

describe("santé", () => {
  test("migrations en retard = embarquées mais absentes, non terminées ou annulées", () => {
    const embedded = ["20260901_init", "20260913230000_delivery_cod", "20260914020000_ops_events"];
    expect(
      pendingMigrations(embedded, [
        { name: "20260901_init", finished: true, rolledBack: false },
        { name: "20260913230000_delivery_cod", finished: true, rolledBack: false },
      ]),
    ).toEqual(["20260914020000_ops_events"]);
    expect(
      pendingMigrations(embedded, [
        { name: "20260901_init", finished: true, rolledBack: false },
        { name: "20260913230000_delivery_cod", finished: false, rolledBack: false },
        { name: "20260914020000_ops_events", finished: true, rolledBack: true },
      ]),
    ).toEqual(["20260913230000_delivery_cod", "20260914020000_ops_events"]);
    expect(pendingMigrations(embedded, embedded.map((name) => ({ name, finished: true, rolledBack: false })))).toEqual([]);
  });

  test("la liste embarquée vient du build ; absente = inconnue, pas vide", () => {
    expect(embeddedMigrations(undefined)).toBeNull();
    expect(embeddedMigrations("a, b,,c")).toEqual(["a", "b", "c"]);
  });

  test("le cron est en retard au-delà de 26 h, jamais quand il n'a jamais tourné", () => {
    const now = new Date("2026-09-14T03:00:00Z");
    expect(isCronStale(null, now)).toBe(false);
    expect(isCronStale(new Date("2026-09-13T04:00:00Z"), now)).toBe(false);
    expect(isCronStale(new Date("2026-09-13T00:00:00Z"), now)).toBe(true);
  });
});

describe("formatDigestEmail", () => {
  const base: DigestData = {
    date: "2026-09-14",
    window: { from: "2026-09-13T03:00:00Z", to: "2026-09-14T03:00:00Z" },
    health: {
      ok: true,
      checkedAt: "2026-09-14T03:00:00Z",
      version: "31cd26f",
      environment: "production",
      database: { ok: true, latencyMs: 40, error: null },
      migrations: { ok: true, pending: [], latest: "20260914020000_ops_events", embedded: 6 },
      cron: { lastRunAt: null, stale: false, enforced: true },
      alerts: { openCritical: 0, openWarning: 0 },
      email: { configured: true, dead: false },
    },
    cron: {
      reconcile: { checked: 3, paid: 1, failed: 1, stillPending: 1, errors: 0 },
      payouts: { stale: 0, reminded: 0 },
      manualOrders: { expired: 2, errors: 0 },
    },
    openEvents: [],
    newEventsByKind: [],
    // Mode « En ligne » allumé : le rendu historique (voir plus bas pour le drapeau éteint).
    onlineCheckout: true,
    sales: { paidOrders: 2, byCurrency: [{ currency: "XOF", total: 17_500 }] },
    whatsappPaid: 0,
    ordersCreated: 4,
    offlineAwaiting: { count: 3, expiringSoon: 1 },
    payoutsOpen: { count: 1, oldestDays: 3 },
    stockShortfalls: 0,
  };

  test("tout va bien : le sujet le dit, les chiffres sont là", () => {
    const mail = formatDigestEmail(base);
    expect(mail.subject).toBe("✅ Tout va bien — rapport Bio-Lien du 14 sept.");
    expect(mail.text).toContain("2 ventes réglées : 17");
    expect(mail.text).toContain("4 commandes créées");
    expect(mail.text).toContain("1 reversement à exécuter (le plus ancien : 3 j)");
    expect(mail.text).toContain("3 commandes WhatsApp / à la livraison en attente chez les vendeurs, dont 1 qui expire sous 48 h");
    expect(mail.text).toContain("Réconciliation Mobile Money : 3 vérifiée(s), 1 réglée(s), 1 annulée(s), 1 encore en attente.");
    expect(mail.text).toContain("Commandes hors ligne expirées : 2.");
    expect(mail.text).toContain("Migrations : à jour");
    expect(mail.text).toContain("Version : 31cd26f");
    // Drapeau allumé : les ventes WhatsApp marquées payées ne s'affichent pas à part.
    expect(mail.text).not.toContain("marquée");
    expect(formatDigestEmail({ ...base, stockShortfalls: 1 }).text).toContain(
      "1 commande réglée avec un manque de stock : remboursement possible à prévoir.",
    );
  });

  describe("mode « En ligne » masqué (drapeau éteint)", () => {
    const offline: DigestData = {
      ...base,
      onlineCheckout: false,
      whatsappPaid: 3,
      sales: { paidOrders: 0, byCurrency: [] },
      cron: { ...base.cron!, reconcile: { checked: 0, paid: 0, failed: 0, stillPending: 0, errors: 0 } },
      stockShortfalls: 1,
    };

    test("les commandes WhatsApp marquées payées remplacent les ventes ; le grand livre ne s'affiche que s'il a bougé", () => {
      const mail = formatDigestEmail(offline);
      expect(mail.text).toContain("- 3 commandes WhatsApp marquées payées.");
      expect(mail.text).not.toContain("vente");
      expect(mail.html).toContain("3 commandes WhatsApp marquées payées.");
      expect(formatDigestEmail({ ...offline, whatsappPaid: 1 }).text).toContain("- 1 commande WhatsApp marquée payée.");
      expect(formatDigestEmail({ ...offline, whatsappPaid: 0 }).text).toContain("- Aucune commande WhatsApp marquée payée.");

      // Une commande historique réglée par la caisse : la ligne du grand livre réapparaît, après.
      const withLedger = formatDigestEmail({ ...offline, sales: base.sales }).text;
      expect(withLedger).toContain("- 3 commandes WhatsApp marquées payées.");
      expect(withLedger).toContain("2 ventes réglées : 17");
      expect(withLedger.indexOf("marquées payées")).toBeLessThan(withLedger.indexOf("ventes réglées"));
    });

    test("passage du cron : les commandes WhatsApp expirées d'abord, la réconciliation seulement si elle a travaillé ou échoué", () => {
      const mail = formatDigestEmail(offline);
      expect(mail.text).toContain("- Commandes WhatsApp expirées : 2.");
      expect(mail.text).not.toContain("hors ligne");
      expect(mail.text).not.toContain("Réconciliation Mobile Money");
      expect(mail.text).toContain("Reversements en retard : 0 (0 relance(s) envoyée(s)).");
      expect(mail.text.indexOf("Commandes WhatsApp expirées")).toBeLessThan(mail.text.indexOf("Reversements en retard"));

      const worked = formatDigestEmail({
        ...offline,
        cron: { ...offline.cron!, reconcile: { checked: 2, paid: 1, failed: 0, stillPending: 1, errors: 0 } },
      }).text;
      expect(worked).toContain("Réconciliation Mobile Money : 2 vérifiée(s), 1 réglée(s), 0 annulée(s), 1 encore en attente.");
      expect(worked.indexOf("Commandes WhatsApp expirées")).toBeLessThan(worked.indexOf("Réconciliation Mobile Money"));

      const failed = formatDigestEmail({
        ...offline,
        cron: { ...offline.cron!, reconcile: { checked: 0, paid: 0, failed: 0, stillPending: 0, errors: 1 } },
      }).text;
      expect(failed).toContain("Réconciliation Mobile Money : 0 vérifiée(s), 0 réglée(s), 0 annulée(s), 0 encore en attente, 1 en erreur.");

      const stepFailed = formatDigestEmail({ ...offline, cron: { ...offline.cron!, manualOrders: { expired: -1, errors: 1 } } }).text;
      expect(stepFailed).toContain("Commandes WhatsApp expirées : étape en échec (1 erreur(s)).");
    });

    test("passage du cron : la sonde TikTok s'affiche quand le passage l'a exécutée", () => {
      const probe = { status: "interstitial" as const, target: "https://www.bio-lien.com/", httpStatus: 200, location: null, error: null };
      expect(formatDigestEmail(offline).text).not.toContain("Lien TikTok");
      const withProbe = formatDigestEmail({ ...offline, cron: { ...offline.cron!, tiktok: probe } }).text;
      expect(withProbe).toContain("- Lien TikTok : encore l'écran « Ouvrir quand même »");
      expect(withProbe.indexOf("Reversements en retard")).toBeLessThan(withProbe.indexOf("Lien TikTok"));
      const direct = formatDigestEmail({
        ...base,
        cron: { ...base.cron!, tiktok: { ...probe, status: "direct", httpStatus: 302, location: probe.target } },
      }).text;
      expect(direct).toContain("- Lien TikTok : bio-lien.com s'ouvre directement dans TikTok (302)");
      const blocked = formatDigestEmail({ ...offline, cron: { ...offline.cron!, tiktok: { ...probe, status: "blocked" } } }).text;
      expect(blocked).toContain("- Lien TikTok : BLOQUÉ");
      const failed = formatDigestEmail({
        ...offline,
        cron: { ...offline.cron!, tiktok: { ...probe, status: "unknown", httpStatus: null, error: "fetch failed — ENOTFOUND" } },
      }).text;
      expect(failed).toContain("- Lien TikTok : sonde impossible (fetch failed — ENOTFOUND).");
    });

    test("à faire : commandes WhatsApp en attente (sans « à la livraison »), manque de stock à voir avec le vendeur", () => {
      const mail = formatDigestEmail(offline);
      expect(mail.text).toContain("3 commandes WhatsApp en attente chez les vendeurs, dont 1 qui expire sous 48 h.");
      expect(mail.text).not.toContain("à la livraison");
      expect(mail.text).toContain("1 commande réglée avec un manque de stock : à voir avec le vendeur.");
      expect(mail.text).not.toContain("remboursement");
    });
  });

  test("alertes ouvertes et santé dégradée passent en tête", () => {
    const mail = formatDigestEmail({
      ...base,
      health: { ...base.health, ok: false, migrations: { ok: false, pending: ["20260914020000_ops_events"], latest: "x", embedded: 6 } },
      openEvents: [
        { id: "1", kind: "payment.late_after_cancel", severity: "critical", title: "Paiement tardif", occurrences: 2, lastSeenAt: base.window.to },
        { id: "2", kind: "notification.failed", severity: "warning", title: "Vendeur non prévenu", occurrences: 1, lastSeenAt: base.window.to },
      ],
      cron: { ...base.cron!, payouts: { stale: -1, reminded: 0 } },
    });
    expect(mail.subject).toMatch(/^⚠️ Santé : problème détecté — rapport/);
    expect(mail.text).toContain("Migrations : EN RETARD — 20260914020000_ops_events");
    expect(mail.text).toContain("🔴 Paiement tardif (×2) — payment.late_after_cancel");
    expect(mail.text).toContain("🟠 Vendeur non prévenu — notification.failed");
    expect(mail.text).toContain("Reversements en retard : étape en échec");

    const critical = formatDigestEmail({
      ...base,
      openEvents: [{ id: "1", kind: "x", severity: "critical", title: "T", occurrences: 1, lastSeenAt: base.window.to }],
    });
    expect(critical.subject).toContain("1 alerte critique à traiter");
  });
});

describe("classifyResendError", () => {
  test("seules les pannes du canal comptent comme « mort » ; adresse refusée, idempotence, débit : non", async () => {
    const { classifyResendError } = await import("@/lib/email");
    expect(classifyResendError("validation_error")).toBe("single");
    expect(classifyResendError("invalid_idempotent_request")).toBe("single");
    expect(classifyResendError("concurrent_idempotent_requests")).toBe("single");
    expect(classifyResendError("rate_limit_exceeded")).toBe("rate_limited");
    expect(classifyResendError("invalid_api_key")).toBe("dead");
    expect(classifyResendError("daily_quota_exceeded")).toBe("dead");
    expect(classifyResendError("internal_server_error")).toBe("dead");
    expect(classifyResendError(undefined)).toBe("dead");
  });
});

describe("summarizeError / safeToken", () => {
  test("première ligne utile, code Prisma en tête, URL de connexion masquée", async () => {
    const { summarizeError, safeToken } = await import("@/lib/ops/alert");
    expect(summarizeError(Object.assign(new Error("\nInvalid `prisma.order.findUnique()` invocation\n\ncolumn missing"), { code: "P2022" }))).toBe(
      "P2022 Invalid `prisma.order.findUnique()` invocation",
    );
    expect(summarizeError(new Error("can't reach postgresql://user:pw@ep-x.neon.tech/db"))).toBe("can't reach postgresql://…");
    expect(summarizeError("x".repeat(500)).length).toBe(160);
    expect(safeToken("payment.success")).toBe("payment.success");
    expect(safeToken("<script>alert(1)</script>")).toBe("(valeur inattendue)");
    expect(safeToken(null)).toBeNull();
  });
});
