import "server-only";

import { Resend } from "resend";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

let resend: Resend | undefined;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const client = getResend();
  const from = process.env.EMAIL_FROM;

  if (!client || !from) {
    if (process.env.NODE_ENV === "production") {
      reportDeadChannel(message, "RESEND_API_KEY ou EMAIL_FROM manque en production.");
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production.");
    }
    console.info(`[email] skipped ${message.subject} -> ${message.to}`);
    return { skipped: true as const };
  }

  let outcome: Awaited<ReturnType<typeof client.emails.send>>;
  try {
    outcome = await client.emails.send(
      {
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      message.idempotencyKey
        ? { idempotencyKey: message.idempotencyKey }
        : undefined,
    );
  } catch (error) {
    reportDeadChannel(message, error instanceof Error ? error.message : String(error));
    throw error;
  }

  if (outcome.error) {
    const verdict = classifyResendError(outcome.error.name);
    if (verdict === "dead") reportDeadChannel(message, `${outcome.error.name} : ${outcome.error.message}`);
    else if (verdict === "rate_limited") reportRateLimited(message, outcome.error.message);
    throw new Error(outcome.error.message);
  }
  return { skipped: false as const, id: outcome.data?.id };
}

/**
 * Tous les refus de Resend ne sont pas une panne du canal : une adresse
 * refusée ou une clé d'idempotence réutilisée ne concernent que cet envoi ;
 * un dépassement de débit passe ; une clé invalide, un quota atteint, une
 * panne chez Resend, si.
 */
export function classifyResendError(name: string | undefined): "dead" | "rate_limited" | "single" {
  switch (name) {
    case "validation_error":
    case "missing_required_field":
    case "invalid_parameter":
    case "not_found":
    case "method_not_allowed":
    case "invalid_idempotency_key":
    case "invalid_idempotent_request":
    case "concurrent_idempotent_requests":
      return "single";
    case "rate_limit_exceeded":
      return "rate_limited";
    default:
      return "dead";
  }
}

/**
 * Le canal e-mail est mort : tous les envois (commandes, reversements,
 * vérification de compte) échouent en silence chez leurs appelants. On le
 * note dans le journal d'exploitation — sans boucler : l'alerte elle-même
 * passe par cette fonction et ne se signale pas.
 */
function reportDeadChannel(message: TransactionalEmail, reason: string): void {
  if (message.idempotencyKey?.startsWith("ops-")) return;
  reportViaOps({
    kind: "email.dead",
    severity: "critical",
    title: "Envoi d'e-mail en échec (Resend)",
    detail: `${reason.slice(0, 200)} — commandes, reversements et vérifications de compte n'arrivent plus. Vérifie la clé Resend, le quota du plan et le domaine d'envoi.`,
    context: { subject: message.subject.slice(0, 120), to: message.to.replace(/^(.).*(@.*)$/, "$1…$2") },
    dedupeKey: "email.dead",
  });
}

function reportRateLimited(message: TransactionalEmail, reason: string): void {
  if (message.idempotencyKey?.startsWith("ops-")) return;
  reportViaOps({
    kind: "email.rate_limited",
    severity: "warning",
    title: "Resend limite le débit : un e-mail n'est pas parti",
    detail: `${reason.slice(0, 200)} — envois trop rapprochés (ou plafond du plan). Si ça se répète, espace les envois ou passe au plan supérieur.`,
    context: { subject: message.subject.slice(0, 120) },
    dedupeKey: "email.rate_limited",
  });
}

function reportViaOps(input: {
  kind: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  context: Record<string, unknown>;
  dedupeKey: string;
}): void {
  // Import différé (le module d'alertes envoie des e-mails : un import
  // statique ferait un cycle) et exécution après la réponse : une promesse
  // simplement détachée peut être gelée par Vercel dès le 200 renvoyé.
  Promise.all([import("@/lib/ops/events"), import("@/lib/after-response")])
    .then(([{ recordOpsEvent }, { scheduleAfterResponse }]) =>
      scheduleAfterResponse(
        () => recordOpsEvent(input),
        (error) => console.error("[email] impossible de signaler le canal", error),
      ),
    )
    .catch((error) => console.error("[email] impossible de signaler le canal", error));
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character];
  });
}
