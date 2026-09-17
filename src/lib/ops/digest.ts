import "server-only";

import { prisma } from "@/lib/prisma";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";
import { adminEmails } from "@/lib/admin-emails";
import { formatPrice } from "@/lib/utils/format";
import { OPEN_PAYOUT_STATUSES } from "@/lib/payouts/config";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import type { OpsSeverity } from "./alert";
import { getHealth, type HealthSnapshot } from "./health";
import { describeTikTokLinkProbe, type TikTokLinkProbe } from "./tiktok-link";

/**
 * Le rapport quotidien du fondateur, envoyé à la fin du cron de 03:00.
 *
 * C'est le battement de cœur : s'il n'arrive pas, c'est que le cron n'a
 * pas tourné, ou que Resend est mort — dans les deux cas /api/health
 * répond 503 (cron muet, canal e-mail marqué mort).
 * Il résume ce qui s'est passé en 24 h, ce qui reste à traiter, et ce que
 * le cron vient de faire.
 *
 * Deux rendus, tranchés par `onlineCheckout` (le drapeau du mode « En
 * ligne », recopié dans les données par `buildDigest` pour que
 * `formatDigestEmail` reste pure) : drapeau éteint, les ventes sont les
 * commandes WhatsApp que le vendeur a marquées payées et le grand livre ne
 * s'affiche que s'il a bougé ; drapeau allumé, le rendu historique.
 */

export interface CronSummary {
  reconcile: { checked: number; paid: number; failed: number; stillPending: number; errors: number };
  payouts: { stale: number; reminded: number };
  manualOrders: { expired: number; errors: number };
  /** La sonde du lien de bio TikTok (absente sur les passages antérieurs à la sonde). */
  tiktok?: TikTokLinkProbe | null;
}

export interface DigestData {
  date: string;
  window: { from: string; to: string };
  health: HealthSnapshot;
  cron: CronSummary | null;
  openEvents: Array<{
    id: string;
    kind: string;
    severity: OpsSeverity;
    title: string;
    occurrences: number;
    lastSeenAt: string;
  }>;
  newEventsByKind: Array<{ kind: string; severity: OpsSeverity; count: number }>;
  /** Le mode « En ligne » (caisse Bio-Lien) est-il allumé ? Décide du rendu. */
  onlineCheckout: boolean;
  /** Ventes passées par la caisse Bio-Lien : la ligne « gross » du grand livre. */
  sales: { paidOrders: number; byCurrency: Array<{ currency: string; total: number }> };
  /** Commandes WhatsApp (ou à la livraison) que le vendeur a marquées payées dans la fenêtre. */
  whatsappPaid: number;
  ordersCreated: number;
  offlineAwaiting: { count: number; expiringSoon: number };
  payoutsOpen: { count: number; oldestDays: number | null };
  stockShortfalls: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildDigest(
  options: { now?: Date; cron?: CronSummary | null } = {},
): Promise<DigestData> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - DAY_MS);

  const [health, openRows, newRows, paidRows, whatsappPaid, ordersCreated, offlinePending, offlineExpiring, payoutRows, shortfalls] =
    await Promise.all([
      getHealth({ now }),
      prisma.opsEvent.findMany({
        where: { acknowledgedAt: null, severity: { in: ["critical", "warning"] } },
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
        take: 30,
        select: { id: true, kind: true, severity: true, title: true, occurrences: true, lastSeenAt: true },
      }),
      prisma.opsEvent.groupBy({
        by: ["kind", "severity"],
        where: { lastSeenAt: { gte: since }, kind: { not: "cron.run" } },
        _count: { _all: true },
      }),
      // Les ventes réglées dans la fenêtre : la ligne « gross » du registre,
      // écrite au règlement (updated_at bougerait à chaque changement de statut).
      prisma.transactionLedger.groupBy({
        by: ["currency"],
        where: { type: "gross", createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Les ventes WhatsApp marquées payées par le vendeur : rien au grand
      // livre (Bio-Lien n'a touché aucun argent) et pas de colonne paidAt,
      // donc on lit l'événement de statut que `settlePaidOrder` écrit au
      // règlement (statut « confirmée » ou au-delà, message public
      // « Paiement … », sans acteur : un changement de statut tapé par le
      // vendeur porte son identifiant, même s'il commence par « Paiement »).
      // Compté par commande, pas par événement : une commande marquée payée
      // = une vente, même si elle a bougé depuis.
      prisma.order.count({
        where: {
          paymentProvider: { in: ["manual", "cash_on_delivery"] },
          paymentStatus: "paid",
          statusEvents: {
            some: {
              createdAt: { gte: since },
              createdBy: null,
              status: { in: ["confirmed", "processing", "shipped", "delivered"] },
              publicMessage: { startsWith: "Paiement" },
            },
          },
        },
      }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({
        where: { paymentProvider: { in: ["manual", "cash_on_delivery"] }, status: "pending", paymentStatus: "pending" },
      }),
      prisma.order.count({
        where: {
          paymentProvider: { in: ["manual", "cash_on_delivery"] },
          status: "pending",
          paymentStatus: "pending",
          createdAt: { lt: new Date(now.getTime() - 5 * DAY_MS) },
        },
      }),
      prisma.payout.findMany({
        where: { status: { in: [...OPEN_PAYOUT_STATUSES] } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      }).then(async (oldest) => ({
        count: await prisma.payout.count({ where: { status: { in: [...OPEN_PAYOUT_STATUSES] } } }),
        oldest: oldest[0]?.createdAt ?? null,
      })),
      // Manques de stock signalés au règlement dans la fenêtre.
      prisma.opsEvent.count({ where: { kind: "order.stock_shortfall", firstSeenAt: { gte: since } } }),
    ]);

  return {
    date: now.toISOString().slice(0, 10),
    window: { from: since.toISOString(), to: now.toISOString() },
    health,
    cron: options.cron ?? null,
    openEvents: openRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      severity: row.severity as OpsSeverity,
      title: row.title,
      occurrences: row.occurrences,
      lastSeenAt: row.lastSeenAt.toISOString(),
    })),
    newEventsByKind: newRows
      .map((row) => ({ kind: row.kind, severity: row.severity as OpsSeverity, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    // Lu ici, à chaque rapport, jamais dans la mise en forme.
    onlineCheckout: isOnlineCheckoutEnabled(),
    sales: {
      paidOrders: paidRows.reduce((sum, row) => sum + row._count._all, 0),
      byCurrency: paidRows.map((row) => ({ currency: row.currency, total: Number(row._sum.amount ?? 0) })),
    },
    whatsappPaid,
    ordersCreated,
    offlineAwaiting: { count: offlinePending, expiringSoon: offlineExpiring },
    payoutsOpen: {
      count: payoutRows.count,
      oldestDays: payoutRows.oldest ? Math.floor((now.getTime() - payoutRows.oldest.getTime()) / DAY_MS) : null,
    },
    stockShortfalls: shortfalls,
  };
}

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

const MARK: Record<OpsSeverity, string> = { info: "🔵", warning: "🟠", critical: "🔴" };

/** « 14 sept. » plutôt que 2026-09-14 dans un objet lu sur téléphone. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Sujet et corps du rapport ; pur, testable. */
export function formatDigestEmail(data: DigestData): { subject: string; text: string; html: string } {
  const critical = data.openEvents.filter((e) => e.severity === "critical").length;
  const warning = data.openEvents.filter((e) => e.severity === "warning").length;
  const healthy = data.health.ok;

  const headline = !healthy
    ? "⚠️ Santé : problème détecté"
    : critical > 0
      ? `🔴 ${critical} alerte${critical > 1 ? "s" : ""} critique${critical > 1 ? "s" : ""} à traiter`
      : warning > 0
        ? `🟠 ${warning} point${warning > 1 ? "s" : ""} à surveiller`
        : "✅ Tout va bien";

  const ledgerLine =
    data.sales.paidOrders === 0
      ? "Aucune vente réglée."
      : `${data.sales.paidOrders} vente${data.sales.paidOrders > 1 ? "s" : ""} réglée${data.sales.paidOrders > 1 ? "s" : ""} : ${data.sales.byCurrency.map((c) => formatPrice(c.total, c.currency)).join(", ")}.`;
  const whatsappPaidLine =
    data.whatsappPaid === 0
      ? "Aucune commande WhatsApp marquée payée."
      : `${data.whatsappPaid} commande${data.whatsappPaid > 1 ? "s" : ""} WhatsApp marquée${data.whatsappPaid > 1 ? "s" : ""} payée${data.whatsappPaid > 1 ? "s" : ""}.`;
  // Mode « En ligne » masqué : la vente, c'est la commande WhatsApp que le
  // vendeur a marquée payée ; le grand livre ne bouge plus que pour les
  // commandes historiques, on ne le montre que s'il a bougé.
  const salesLines = data.onlineCheckout
    ? [ledgerLine]
    : [whatsappPaidLine, ...(data.sales.paidOrders > 0 ? [ledgerLine] : [])];

  const healthLines = [
    `Base : ${data.health.database.ok ? `ok (${data.health.database.latencyMs} ms)` : `KO — ${data.health.database.error ?? "?"}`}`,
    `Migrations : ${data.health.migrations.ok ? "à jour" : `EN RETARD — ${data.health.migrations.pending.join(", ")}`}`,
    `E-mail : ${data.health.email.configured ? "configuré" : "NON configuré"}`,
    data.health.version ? `Version : ${data.health.version}` : null,
  ].filter(Boolean) as string[];

  let cronLines: string[];
  if (!data.cron) {
    cronLines = ["Résultat du cron indisponible."];
  } else {
    const { reconcile, manualOrders, payouts } = data.cron;
    const reconcileLine = `Réconciliation Mobile Money : ${reconcile.checked} vérifiée(s), ${reconcile.paid} réglée(s), ${reconcile.failed} annulée(s), ${reconcile.stillPending} encore en attente${reconcile.errors ? `, ${reconcile.errors} en erreur` : ""}.`;
    const expiredCount = `${manualOrders.expired < 0 ? "étape en échec" : manualOrders.expired}${manualOrders.errors ? ` (${manualOrders.errors} erreur(s))` : ""}.`;
    const payoutsLine = `Reversements en retard : ${payouts.stale < 0 ? "étape en échec" : `${payouts.stale} (${payouts.reminded} relance(s) envoyée(s))`}.`;
    cronLines = data.onlineCheckout
      ? [reconcileLine, `Commandes hors ligne expirées : ${expiredCount}`, payoutsLine]
      : [
          // Sans caisse Bio-Lien, l'expiration des commandes WhatsApp est
          // l'étape qui compte ; la réconciliation ne s'affiche que si elle
          // a eu quelque chose à faire (commandes Mobile Money en vol) ou
          // si elle a échoué.
          `Commandes WhatsApp expirées : ${expiredCount}`,
          ...(reconcile.checked > 0 || reconcile.errors > 0 ? [reconcileLine] : []),
          payoutsLine,
        ];
    // La sonde TikTok, quand le passage l'a exécutée : une ligne chaque
    // jour, pour voir le statut sans attendre l'alerte du jour où il change.
    if (data.cron.tiktok) cronLines.push(describeTikTokLinkProbe(data.cron.tiktok));
  }

  const todoLines = [
    data.payoutsOpen.count > 0
      ? `${data.payoutsOpen.count} reversement${data.payoutsOpen.count > 1 ? "s" : ""} à exécuter${data.payoutsOpen.oldestDays !== null ? ` (le plus ancien : ${data.payoutsOpen.oldestDays} j)` : ""}.`
      : null,
    data.offlineAwaiting.count > 0
      ? `${data.offlineAwaiting.count} commande${data.offlineAwaiting.count > 1 ? "s" : ""} ${data.onlineCheckout ? "WhatsApp / à la livraison" : "WhatsApp"} en attente chez les vendeurs${data.offlineAwaiting.expiringSoon ? `, dont ${data.offlineAwaiting.expiringSoon} qui expire${data.offlineAwaiting.expiringSoon > 1 ? "nt" : ""} sous 48 h` : ""}.`
      : null,
    data.stockShortfalls > 0
      ? `${data.stockShortfalls} commande${data.stockShortfalls > 1 ? "s" : ""} réglée${data.stockShortfalls > 1 ? "s" : ""} avec un manque de stock : ${data.onlineCheckout ? "remboursement possible à prévoir" : "à voir avec le vendeur"}.`
      : null,
  ].filter(Boolean) as string[];

  const eventLines = data.openEvents.map(
    (e) => `${MARK[e.severity]} ${e.title}${e.occurrences > 1 ? ` (×${e.occurrences})` : ""} — ${e.kind}`,
  );
  const newLines = data.newEventsByKind.map((e) => `${MARK[e.severity]} ${e.kind} : ${e.count}`);

  const adminUrl = appUrl("/dashboard/admin/ops");

  const text = [
    `Rapport Bio-Lien du ${data.date} — ${headline}`,
    "",
    "Santé",
    ...healthLines.map((l) => `- ${l}`),
    "",
    "Dernières 24 h",
    ...salesLines.map((l) => `- ${l}`),
    `- ${data.ordersCreated} commande${data.ordersCreated > 1 ? "s" : ""} créée${data.ordersCreated > 1 ? "s" : ""}.`,
    ...newLines.map((l) => `- ${l}`),
    "",
    "À faire",
    ...(todoLines.length ? todoLines.map((l) => `- ${l}`) : ["- Rien en attente."]),
    "",
    "Alertes ouvertes",
    ...(eventLines.length ? eventLines.map((l) => `- ${l}`) : ["- Aucune."]),
    "",
    "Passage du cron",
    ...cronLines.map((l) => `- ${l}`),
    "",
    `Écran Santé : ${adminUrl}`,
  ].join("\n");

  const section = (title: string, lines: string[]) =>
    `<h2 style="font-size:15px;margin:20px 0 6px">${escapeEmailHtml(title)}</h2><ul style="margin:0;padding-left:18px">${lines.map((l) => `<li>${escapeEmailHtml(l)}</li>`).join("")}</ul>`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><p style="font-size:13px;color:#5c5670">Rapport quotidien · ${escapeEmailHtml(data.date)}</p><h1 style="font-size:20px">${escapeEmailHtml(headline)}</h1>${section("Santé", healthLines)}${section("Dernières 24 h", [...salesLines, `${data.ordersCreated} commande(s) créée(s).`, ...newLines])}${section("À faire", todoLines.length ? todoLines : ["Rien en attente."])}${section("Alertes ouvertes", eventLines.length ? eventLines : ["Aucune."])}${section("Passage du cron", cronLines)}<p style="margin-top:24px"><a href="${escapeEmailHtml(adminUrl)}" style="display:inline-block;background:#D9F55C;color:#151020;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Ouvrir l'écran Santé</a></p><p style="color:#5c5670;font-size:12px">Ce rapport part chaque nuit à la fin du cron. S'il n'arrive pas, c'est que le cron n'a pas tourné ou que l'e-mail est en panne : /api/health le dit.</p></div>`;

  return {
    subject: `${headline} — rapport Bio-Lien du ${shortDate(data.date)}`,
    text,
    html,
  };
}

/** Construit et envoie le rapport à ADMIN_EMAILS ; ne lève jamais. */
export async function sendDailyDigest(
  options: { now?: Date; cron?: CronSummary | null } = {},
): Promise<{ sent: number; skipped: string | null }> {
  const admins = adminEmails();
  if (admins.length === 0) {
    console.error("[ops] ADMIN_EMAILS vide : pas de rapport quotidien");
    return { sent: 0, skipped: "no_recipient" };
  }
  let data: DigestData;
  try {
    data = await buildDigest(options);
  } catch (error) {
    console.error("[ops] rapport quotidien : construction impossible", error);
    return { sent: 0, skipped: "build_failed" };
  }
  const message = formatDigestEmail(data);
  const results = await Promise.allSettled(
    admins.map((to) =>
      sendTransactionalEmail({ to, ...message, idempotencyKey: `ops-digest/${data.window.to}/${to}` }),
    ),
  );
  let sent = 0;
  for (const result of results) {
    if (result.status === "fulfilled") sent += 1;
    else console.error("[ops] rapport quotidien non envoyé", result.reason);
  }
  return { sent, skipped: null };
}
