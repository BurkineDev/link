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
    // Un refus d'adresse (validation_error) n'est pas une panne du canal ;
    // une clé invalide, un quota atteint ou une panne Resend, si.
    if (outcome.error.name !== "validation_error") {
      reportDeadChannel(message, `${outcome.error.name} : ${outcome.error.message}`);
    }
    throw new Error(outcome.error.message);
  }
  return { skipped: false as const, id: outcome.data?.id };
}

/**
 * Le canal e-mail est mort : tous les envois (commandes, reversements,
 * vérification de compte) échouent en silence chez leurs appelants. On le
 * note dans le journal d'exploitation — sans boucler : l'alerte elle-même
 * passe par cette fonction et ne se signale pas.
 */
function reportDeadChannel(message: TransactionalEmail, reason: string): void {
  if (message.idempotencyKey?.startsWith("ops-")) return;
  // Import différé : le module d'alertes envoie des e-mails, un import
  // statique ferait un cycle.
  void import("@/lib/ops/events")
    .then(({ recordOpsEvent }) =>
      recordOpsEvent({
        kind: "email.dead",
        severity: "critical",
        title: "Envoi d'e-mail en échec (Resend)",
        detail: `${reason.slice(0, 200)} — commandes, reversements et vérifications de compte n'arrivent plus. Vérifie la clé Resend, le quota du plan et le domaine d'envoi.`,
        context: { subject: message.subject.slice(0, 120), to: message.to.replace(/^(.).*(@.*)$/, "$1…$2") },
        dedupeKey: "email.dead",
      }),
    )
    .catch((error) => console.error("[email] impossible de signaler le canal mort", error));
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
