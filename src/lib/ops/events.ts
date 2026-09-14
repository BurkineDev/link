import "server-only";

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { adminEmails } from "@/lib/admin-emails";
import { scheduleAfterResponse } from "@/lib/after-response";
import {
  effectiveDedupeKey,
  formatAlertEmail,
  formatAlertWebhook,
  hourBucket,
  notifiesImmediately,
  shouldRenotify,
  type OpsEventInput,
  type OpsSeverity,
} from "./alert";

/**
 * Enregistrer un événement d'exploitation et, s'il est critique, prévenir
 * le fondateur tout de suite.
 *
 * Trois règles, parce que cette fonction est appelée depuis les endroits
 * qui sont justement en train de casser :
 * 1. Elle ne lève JAMAIS : une alerte qui échoue ne doit pas aggraver un
 *    webhook ou un passage en caisse.
 * 2. Si la base est injoignable, l'e-mail part quand même (clé
 *    d'idempotence par tranche horaire, pour ne pas mitrailler).
 * 3. Si l'e-mail est mort, le webhook sortant optionnel prend le relais ;
 *    et l'écran Santé / `/api/health` montrent la ligne dès que la base
 *    répond.
 */

export interface RecordResult {
  /** Identifiant de la ligne (nouvelle ou incrémentée), null si la base n'a pas répondu. */
  id: string | null;
  persisted: boolean;
  occurrences: number;
  notified: boolean;
}

function adminUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/dashboard/admin/ops`;
}

function environment(): string | null {
  return process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
}

export async function recordOpsEvent(
  raw: OpsEventInput,
  options: { now?: Date } = {},
): Promise<RecordResult> {
  const now = options.now ?? new Date();
  const input: OpsEventInput = { ...raw, context: boundContext(raw.context) };
  const dedupeKey = effectiveDedupeKey(input);

  let persisted = false;
  let id: string | null = null;
  let occurrences = 1;
  let notifiedAt: Date | null = null;

  try {
    const existing = await prisma.opsEvent.findFirst({
      where: { dedupeKey, acknowledgedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, occurrences: true, notifiedAt: true, severity: true },
    });
    const bump = async (row: { id: string; severity: OpsSeverity }) => {
      const updated = await prisma.opsEvent.update({
        where: { id: row.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: now,
          // La dernière occurrence fait foi : famille, titre, détail et
          // contexte les plus récents (un montant, une référence à jour).
          kind: input.kind,
          title: input.title,
          detail: input.detail ?? null,
          context: (input.context ?? undefined) as never,
          // Une même clé peut monter en gravité (warning → critical), jamais redescendre.
          severity: maxSeverity(input.severity, row.severity),
        },
        select: { id: true, occurrences: true, notifiedAt: true },
      });
      id = updated.id;
      occurrences = updated.occurrences;
      notifiedAt = updated.notifiedAt;
    };

    if (existing) {
      await bump(existing);
    } else {
      try {
        const created = await prisma.opsEvent.create({
          data: {
            kind: input.kind,
            severity: input.severity,
            title: input.title,
            detail: input.detail ?? null,
            context: (input.context ?? undefined) as never,
            dedupeKey,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          select: { id: true },
        });
        id = created.id;
      } catch (error) {
        // Course perdue : un autre appel vient d'ouvrir la ligne (index
        // unique partiel sur la clé). On l'incrémente au lieu de la doubler.
        if (!isUniqueViolation(error)) throw error;
        const winner = await prisma.opsEvent.findFirst({
          where: { dedupeKey, acknowledgedAt: null },
          select: { id: true, severity: true, occurrences: true, notifiedAt: true },
        });
        if (!winner) throw error;
        await bump(winner);
      }
    }
    persisted = true;
  } catch (error) {
    console.error("[ops] impossible d'enregistrer l'événement", input.kind, error);
  }

  // Toujours une trace dans les journaux, au niveau qui convient.
  const line = `[ops] ${input.severity} ${input.kind}: ${input.title}`;
  if (input.severity === "critical") console.error(line, input.context ?? "");
  else if (input.severity === "warning") console.warn(line, input.context ?? "");
  else console.info(line);

  let notified = false;
  if (notifiesImmediately(input.severity) && (!persisted || shouldRenotify(notifiedAt, now))) {
    // La TENTATIVE est datée avant l'envoi, pas le succès : un Resend en
    // panne ne doit pas être resollicité à chaque occurrence (auto-congestion).
    if (persisted && id) {
      await prisma.opsEvent
        .update({ where: { id }, data: { notifiedAt: now } })
        .catch((error) => console.error("[ops] notifiedAt non enregistré", error));
    }
    notified = await notifyFounder(input, { occurrences, persisted, dedupeKey, now });
  }

  return { id, persisted, occurrences, notified };
}

/**
 * Le contexte finit dans un e-mail et une colonne JSON : chaque valeur est
 * bornée (une chaîne venue d'un tiers ne fait pas 50 Ko), et le tout aussi.
 */
export function boundContext(
  context: Record<string, unknown> | null | undefined,
  maxValue = 200,
  maxTotal = 4000,
): Record<string, unknown> | null {
  if (!context) return null;
  const out: Record<string, unknown> = {};
  let total = 0;
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    let bounded: unknown = value;
    if (typeof value === "string" && value.length > maxValue) bounded = `${value.slice(0, maxValue)}…`;
    else if (typeof value === "object" && value !== null) {
      const json = JSON.stringify(value);
      if (json.length > maxValue * 4) bounded = `${json.slice(0, maxValue * 4)}…`;
    }
    const size = typeof bounded === "string" ? bounded.length : JSON.stringify(bounded ?? null).length;
    if (total + size > maxTotal) break;
    total += size;
    out[key.slice(0, 60)] = bounded;
  }
  return out;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

const SEVERITY_RANK: Record<OpsSeverity, number> = { info: 0, warning: 1, critical: 2 };

function maxSeverity(next: OpsSeverity, existing: OpsSeverity): OpsSeverity {
  return SEVERITY_RANK[next] >= SEVERITY_RANK[existing] ? next : existing;
}

/**
 * Sans base, l'accélérateur de six heures n'existe pas : cette mémoire
 * d'instance évite de mitrailler Resend et le webhook pendant une panne
 * (une instance qui redémarre repart de zéro, ce qui reste borné par la
 * clé d'idempotence horaire côté Resend).
 */
const lastSentWithoutDb = new Map<string, number>();
const LOCAL_REPEAT_MS = 60 * 60 * 1000;

async function notifyFounder(
  input: OpsEventInput,
  meta: { occurrences: number; persisted: boolean; dedupeKey: string; now: Date },
): Promise<boolean> {
  if (!meta.persisted) {
    const last = lastSentWithoutDb.get(meta.dedupeKey);
    if (last !== undefined && meta.now.getTime() - last < LOCAL_REPEAT_MS) return false;
    lastSentWithoutDb.set(meta.dedupeKey, meta.now.getTime());
    if (lastSentWithoutDb.size > 500) lastSentWithoutDb.clear();
  }
  const admins = adminEmails();
  const url = adminUrl();
  const env = environment();
  let delivered = false;

  if (admins.length === 0) {
    console.error("[ops] ADMIN_EMAILS vide : alerte critique sans destinataire —", input.title);
  } else {
    const message = formatAlertEmail({ event: input, occurrences: meta.occurrences, adminUrl: url, environment: env });
    // Sans base, la clé d'idempotence borne l'envoi à un par clé et par heure.
    const idempotency = meta.persisted
      ? `ops-alert/${meta.dedupeKey}/${meta.now.getTime()}`
      : `ops-alert/${meta.dedupeKey}/${hourBucket(meta.now)}`;
    const results = await Promise.allSettled(
      admins.map((to) =>
        sendTransactionalEmail({ to, ...message, idempotencyKey: `${idempotency}/${to}` }),
      ),
    );
    delivered = results.some((r) => r.status === "fulfilled");
    for (const r of results) {
      if (r.status === "rejected") console.error("[ops] e-mail d'alerte non envoyé", r.reason);
    }
  }

  // Canal de secours : un webhook sortant (Slack, Discord via passerelle,
  // ntfy…) qui ne dépend ni de Resend ni de la base.
  const webhook = process.env.OPS_ALERT_WEBHOOK_URL;
  if (webhook) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          formatAlertWebhook({ event: input, occurrences: meta.occurrences, adminUrl: url, environment: env }),
        ),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) delivered = true;
      else console.error("[ops] webhook d'alerte a répondu", res.status);
    } catch (error) {
      console.error("[ops] webhook d'alerte injoignable", error);
    }
  }

  return delivered;
}

/**
 * Enregistrer APRÈS la réponse : dans un webhook ou un passage en caisse,
 * le prestataire ou l'acheteur n'attend pas l'e-mail d'alerte. Hors
 * contexte de requête (tests, scripts), s'exécute tout de suite.
 */
export function recordOpsEventAfterResponse(input: OpsEventInput): void {
  scheduleAfterResponse(
    () => recordOpsEvent(input),
    (error) => console.error("[ops] enregistrement différé en échec", error),
  );
}

/** Raccourcis lisibles sur les sites d'appel (différés : la réponse part d'abord). */
export const ops = {
  critical: (input: Omit<OpsEventInput, "severity">) =>
    recordOpsEventAfterResponse({ ...input, severity: "critical" }),
  warning: (input: Omit<OpsEventInput, "severity">) =>
    recordOpsEventAfterResponse({ ...input, severity: "warning" }),
  info: (input: Omit<OpsEventInput, "severity">) =>
    recordOpsEventAfterResponse({ ...input, severity: "info" }),
};

/** Marquer une ligne traitée (écran Santé). */
export async function acknowledgeOpsEvent(id: string, by: string): Promise<boolean> {
  const { count } = await prisma.opsEvent.updateMany({
    where: { id, acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), acknowledgedBy: by },
  });
  return count > 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ménage : lignes traitées depuis plus de 90 jours, traces (info) et
 * battements de cœur de plus de 60 jours. Les alertes ouvertes restent.
 */
export async function purgeOpsEvents(now: Date = new Date()): Promise<number> {
  const [acknowledged, traces] = await Promise.all([
    prisma.opsEvent.deleteMany({ where: { acknowledgedAt: { lt: new Date(now.getTime() - 90 * DAY_MS) } } }),
    prisma.opsEvent.deleteMany({
      where: { severity: "info", lastSeenAt: { lt: new Date(now.getTime() - 60 * DAY_MS) } },
    }),
  ]);
  return acknowledged.count + traces.count;
}
