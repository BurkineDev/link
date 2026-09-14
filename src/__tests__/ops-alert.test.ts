/**
 * Alertes fondateur — la partie pure : règles d'envoi, mise en forme,
 * aides de santé et rapport quotidien.
 */

// Les modules de santé et de rapport importent le client Prisma (non
// chargeable sous Jest) : on ne teste ici que leurs fonctions pures.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/email", () => ({ sendTransactionalEmail: jest.fn(), escapeEmailHtml: (v: string) => v }));

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
    expect(effectiveDedupeKey({ kind: "webhook.late_payment", dedupeKey: "webhook.late_payment:o1" })).toBe("webhook.late_payment:o1");
    expect(hourBucket(new Date("2026-09-14T03:59:59Z"))).toBe("2026-09-14T03");
  });
});

describe("formatAlertEmail", () => {
  const event = {
    kind: "webhook.late_payment" as const,
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
      email: { configured: true },
    },
    cron: {
      reconcile: { checked: 3, paid: 1, failed: 1, stillPending: 1, errors: 0 },
      payouts: { stale: 0, reminded: 0 },
      manualOrders: { expired: 2, errors: 0 },
    },
    openEvents: [],
    newEventsByKind: [],
    sales: { paidOrders: 2, byCurrency: [{ currency: "XOF", total: 17_500 }] },
    ordersCreated: 4,
    offlineAwaiting: { count: 3, expiringSoon: 1 },
    payoutsOpen: { count: 1, oldestDays: 3 },
    stockShortfalls: 0,
  };

  test("tout va bien : le sujet le dit, les chiffres sont là", () => {
    const mail = formatDigestEmail(base);
    expect(mail.subject).toBe("Bio-Lien — rapport du 2026-09-14 : Tout va bien");
    expect(mail.text).toContain("2 ventes réglées : 17");
    expect(mail.text).toContain("4 commandes créées");
    expect(mail.text).toContain("1 reversement à exécuter (le plus ancien : 3 j)");
    expect(mail.text).toContain("3 commandes WhatsApp / à la livraison en attente chez les vendeurs, dont 1 qui expire sous 48 h");
    expect(mail.text).toContain("Réconciliation Mobile Money : 3 vérifiée(s), 1 réglée(s), 1 annulée(s), 1 encore en attente.");
    expect(mail.text).toContain("Migrations : à jour");
    expect(mail.text).toContain("Version : 31cd26f");
  });

  test("alertes ouvertes et santé dégradée passent en tête", () => {
    const mail = formatDigestEmail({
      ...base,
      health: { ...base.health, ok: false, migrations: { ok: false, pending: ["20260914020000_ops_events"], latest: "x", embedded: 6 } },
      openEvents: [
        { id: "1", kind: "webhook.late_payment", severity: "critical", title: "Paiement tardif", occurrences: 2, lastSeenAt: base.window.to },
        { id: "2", kind: "notification.failed", severity: "warning", title: "Vendeur non prévenu", occurrences: 1, lastSeenAt: base.window.to },
      ],
      cron: { ...base.cron!, payouts: { stale: -1, reminded: 0 } },
    });
    expect(mail.subject).toContain("Santé : problème détecté");
    expect(mail.text).toContain("Migrations : EN RETARD — 20260914020000_ops_events");
    expect(mail.text).toContain("🔴 Paiement tardif (×2) — webhook.late_payment");
    expect(mail.text).toContain("🟠 Vendeur non prévenu — notification.failed");
    expect(mail.text).toContain("Reversements en retard : étape en échec");

    const critical = formatDigestEmail({
      ...base,
      openEvents: [{ id: "1", kind: "x", severity: "critical", title: "T", occurrences: 1, lastSeenAt: base.window.to }],
    });
    expect(critical.subject).toContain("1 alerte critique à traiter");
  });
});
