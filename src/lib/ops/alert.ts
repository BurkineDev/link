/**
 * Alertes fondateur — la partie pure, sans base ni serveur : vocabulaire
 * des événements, règles d'envoi, mise en forme des messages.
 *
 * Contexte : l'audit de septembre 2026 relevait « 115 console.* et rien
 * d'autre ». Un webhook rejeté, un paiement arrivé après annulation, une
 * réconciliation en panne ou un e-mail mort ne se voyaient que dans les
 * journaux Vercel, à rétention courte, que personne ne lit la nuit. Ici,
 * chaque anomalie devient une ligne `ops_events` et, si elle coûte de
 * l'argent, un e-mail immédiat au fondateur (`ADMIN_EMAILS`).
 *
 * Importable partout (e-mails, tests, client) : rien de serveur ici.
 */

export type OpsSeverity = "info" | "warning" | "critical";

/**
 * Les familles d'événements. Le préfixe dit où ça casse ; le suffixe, quoi.
 * Une chaîne libre reste acceptée (le type documente les cas connus).
 */
export type OpsKind =
  // Webhooks Genius Pay / Stripe (le canal)
  | "webhook.signature_rejected"
  | "webhook.order_not_found"
  | "webhook.unknown_reference"
  | "webhook.refund_not_recorded"
  | "webhook.dispute_opened"
  | "webhook.dispute_lost"
  | "webhook.handler_error"
  | "webhook.subscription_unresolved"
  | "webhook.payment_failed_unrecorded"
  // Paiements (le problème, quel que soit le canal qui l'a vu : webhook,
  // réconciliation ou page de succès — même clé, même famille)
  | "payment.amount_mismatch"
  | "payment.late_after_cancel"
  // Réconciliation et cron
  | "reconcile.db_error"
  | "reconcile.not_configured"
  | "reconcile.provider_errors"
  | "cron.run"
  | "cron.unauthorized"
  | "cron.not_configured"
  | "cron.step_failed"
  // Passage en caisse et règlement
  | "checkout.gateway_error"
  | "checkout.rollback_failed"
  | "order.stock_shortfall"
  // Notifications et canaux
  | "notification.failed"
  | "email.dead"
  | "email.rate_limited"
  // Reversements
  | "payout.requested"
  | "payout.reminder_failed"
  // Santé
  | "health.migration_drift"
  | "health.db_unreachable"
  // Sonde TikTok : le lien de bio a changé de côté (voir ./tiktok-link)
  | "tiktok.link_direct"
  | "tiktok.link_interstitial"
  | "tiktok.link_blocked"
  | (string & {});

export interface OpsEventInput {
  kind: OpsKind;
  severity: OpsSeverity;
  /** Une ligne, lisible dans un objet d'e-mail. */
  title: string;
  /** Le détail utile pour agir (deux ou trois phrases). */
  detail?: string | null;
  /** Identifiants et montants : affichés tels quels, jamais de secret. */
  context?: Record<string, unknown> | null;
  /**
   * Même clé = même problème : la ligne ouverte est incrémentée au lieu
   * d'être dupliquée, et l'e-mail immédiat n'est pas renvoyé avant
   * `ALERT_REPEAT_MS`. Par défaut, la famille (`kind`) sert de clé.
   */
  dedupeKey?: string | null;
}

/** Un e-mail immédiat par clé, puis silence sur cette clé pendant six heures. */
export const ALERT_REPEAT_MS = 6 * 60 * 60 * 1000;

/** Sans nouvelle du cron au-delà de cette durée, la santé passe au rouge. */
export const CRON_STALE_MS = 26 * 60 * 60 * 1000;

/** Sévérités qui déclenchent un e-mail tout de suite. */
export function notifiesImmediately(severity: OpsSeverity): boolean {
  return severity === "critical";
}

/** Faut-il renvoyer l'e-mail pour une ligne déjà ouverte ? */
export function shouldRenotify(notifiedAt: Date | null | undefined, now: Date): boolean {
  if (!notifiedAt) return true;
  return now.getTime() - notifiedAt.getTime() >= ALERT_REPEAT_MS;
}

export function effectiveDedupeKey(input: Pick<OpsEventInput, "kind" | "dedupeKey">): string {
  return input.dedupeKey && input.dedupeKey.trim().length > 0 ? input.dedupeKey.trim() : input.kind;
}

/** « 2026-09-14T03 » : la tranche horaire, pour une clé d'idempotence sans base. */
export function hourBucket(now: Date): string {
  return now.toISOString().slice(0, 13);
}

export const SEVERITY_LABELS: Record<OpsSeverity, string> = {
  info: "Info",
  warning: "À surveiller",
  critical: "Critique",
};

const SEVERITY_MARK: Record<OpsSeverity, string> = {
  info: "🔵",
  warning: "🟠",
  critical: "🔴",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function contextRows(context: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!context) return [];
  return Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]);
}

export interface AlertMessage {
  subject: string;
  text: string;
  html: string;
}

/**
 * L'e-mail immédiat : ce qui a cassé, où agir, et le lien vers l'écran
 * Santé pour marquer l'alerte traitée.
 */
export function formatAlertEmail(args: {
  event: OpsEventInput;
  occurrences?: number;
  adminUrl: string;
  environment?: string | null;
}): AlertMessage {
  const { event } = args;
  const mark = SEVERITY_MARK[event.severity];
  const env = args.environment && args.environment !== "production" ? ` [${args.environment}]` : "";
  const repeat = args.occurrences && args.occurrences > 1 ? ` (×${args.occurrences})` : "";
  const rows = contextRows(event.context);

  const text = [
    `${SEVERITY_LABELS[event.severity]} — ${event.title}${repeat}`,
    "",
    event.detail ?? "",
    rows.length ? "" : null,
    ...rows.map(([k, v]) => `${k} : ${v}`),
    "",
    `Famille : ${event.kind}`,
    `Écran Santé : ${args.adminUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><p style="font-size:13px;color:#5c5670">${mark} ${escapeHtml(SEVERITY_LABELS[event.severity])} · ${escapeHtml(event.kind)}${escapeHtml(env)}</p><h1 style="font-size:20px">${escapeHtml(event.title)}${escapeHtml(repeat)}</h1>${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ""}${rows.length ? `<table style="border-collapse:collapse;font-size:13px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5c5670">${escapeHtml(k)}</td><td style="padding:4px 0"><code>${escapeHtml(v)}</code></td></tr>`).join("")}</table>` : ""}<p><a href="${escapeHtml(args.adminUrl)}" style="display:inline-block;background:#D9F55C;color:#151020;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Ouvrir l'écran Santé</a></p><p style="color:#5c5670;font-size:12px">Tu reçois ce message parce que ton adresse est dans ADMIN_EMAILS. Même problème : au plus un e-mail toutes les six heures ; le reste attend le rapport quotidien.</p></div>`;

  return {
    subject: `${mark} Bio-Lien${env} : ${event.title}`,
    text,
    html,
  };
}

/** Corps JSON envoyé au webhook sortant optionnel (compatible Slack : champ `text`). */
export function formatAlertWebhook(args: {
  event: OpsEventInput;
  occurrences?: number;
  adminUrl: string;
  environment?: string | null;
}): Record<string, unknown> {
  const { event } = args;
  const mark = SEVERITY_MARK[event.severity];
  const env = args.environment && args.environment !== "production" ? ` [${args.environment}]` : "";
  const rows = contextRows(event.context).map(([k, v]) => `${k}: ${v}`);
  return {
    text: [`${mark} Bio-Lien${env} — ${event.title}`, event.detail ?? "", ...rows, args.adminUrl]
      .filter(Boolean)
      .join("\n"),
    kind: event.kind,
    severity: event.severity,
    title: event.title,
    occurrences: args.occurrences ?? 1,
    url: args.adminUrl,
  };
}

/**
 * Première ligne utile d'une erreur, bornée. Les erreurs Prisma commencent
 * par un saut de ligne (« \nInvalid `prisma.x()` invocation ») : la
 * première ligne non vide, et jamais une URL de connexion.
 */
export function summarizeError(error: unknown, max = 160): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  const line =
    message
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "erreur";
  const prefixed = typeof code === "string" && code.length > 0 ? `${code} ${line}` : line;
  return prefixed.replace(/postgres(ql)?:\/\/\S+/gi, "postgresql://…").slice(0, max);
}

/** Un identifiant fourni par un tiers ne rentre dans un e-mail que s'il a la forme attendue. */
export function safeToken(value: string | null | undefined, max = 60): string | null {
  if (!value) return null;
  return /^[\w.:-]{1,}$/.test(value) && value.length <= max ? value : "(valeur inattendue)";
}
