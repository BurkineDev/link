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
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production.");
    }
    console.info(`[email] skipped ${message.subject} -> ${message.to}`);
    return { skipped: true as const };
  }

  const { data, error } = await client.emails.send(
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

  if (error) throw new Error(error.message);
  return { skipped: false as const, id: data?.id };
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
