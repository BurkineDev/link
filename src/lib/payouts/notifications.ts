import "server-only";

import { prisma } from "@/lib/prisma";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";
import { formatPrice } from "@/lib/utils/format";
import { adminEmails } from "@/lib/admin";
import { PAYOUT_PROVIDER_LABELS, type PayoutProvider } from "./config";
import type { PayoutDestination } from "./requests";

/**
 * E-mails du cycle de reversement. Jamais bloquants : un échec d'envoi se
 * journalise, la demande ou le versement reste enregistré.
 */

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function providerLabel(provider: string) {
  return PAYOUT_PROVIDER_LABELS[provider as PayoutProvider] ?? provider;
}

function destinationLine(destination: PayoutDestination | null) {
  if (!destination) return "compte de reversement non renseigné";
  const id =
    destination.provider === "bank"
      ? destination.accountIdentifier
      : `+${destination.accountIdentifier}`;
  return `${providerLabel(destination.provider)} — ${destination.accountName} — ${id}`;
}

async function loadPayout(payoutId: string) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      provider: true,
      reference: true,
      note: true,
      destination: true,
      createdAt: true,
      shop: {
        select: {
          name: true,
          slug: true,
          contactEmail: true,
          owner: { select: { user: { select: { email: true, name: true } } } },
        },
      },
    },
  });
  if (!payout) return null;
  return {
    ...payout,
    amount: Number(payout.amount),
    destination: (payout.destination as unknown as PayoutDestination | null) ?? null,
    sellerEmail: payout.shop.contactEmail || payout.shop.owner.user.email,
  };
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>${escapeEmailHtml(title)}</h1>${body}</div>`;

/** Nouvelle demande : l'équipe reçoit de quoi exécuter le transfert, le vendeur un accusé. */
export async function notifyPayoutRequested(payoutId: string): Promise<void> {
  const payout = await loadPayout(payoutId);
  if (!payout) return;
  const amount = formatPrice(payout.amount, payout.currency);
  const destination = destinationLine(payout.destination);
  const admins = adminEmails();

  if (admins.length === 0) {
    console.warn("[payouts] ADMIN_EMAILS non défini : personne ne recevra la demande", payoutId);
  }

  const adminBody =
    `<p><strong>${escapeEmailHtml(payout.shop.name)}</strong> (${escapeEmailHtml(payout.shop.slug)}) demande un reversement de <strong>${escapeEmailHtml(amount)}</strong>.</p>` +
    `<p>Destination : ${escapeEmailHtml(destination)}</p>` +
    `<p>Vendeur : ${escapeEmailHtml(payout.sellerEmail)}</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/admin/payouts"))}">Traiter la demande</a></p>`;
  const adminText =
    `${payout.shop.name} (${payout.shop.slug}) demande un reversement de ${amount}.\n` +
    `Destination : ${destination}\nVendeur : ${payout.sellerEmail}\n` +
    `Traiter : ${appUrl("/dashboard/admin/payouts")}`;

  const sellerBody =
    `<p>Bonjour, ta demande de reversement de <strong>${escapeEmailHtml(amount)}</strong> est bien enregistrée.</p>` +
    `<p>Elle sera versée sur : ${escapeEmailHtml(destination)}.</p>` +
    `<p>Tu recevras un e-mail dès que le transfert est effectué, en général sous 2 jours ouvrés.</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/payments"))}">Voir mes paiements</a></p>`;
  const sellerText =
    `Ta demande de reversement de ${amount} est bien enregistrée.\n` +
    `Elle sera versée sur : ${destination}.\n` +
    `Tu recevras un e-mail dès que le transfert est effectué.`;

  await Promise.allSettled([
    ...admins.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `Reversement à exécuter — ${payout.shop.name} — ${amount}`,
        html: wrap("Reversement à exécuter", adminBody),
        text: adminText,
        idempotencyKey: `payout-requested-admin/${payoutId}/${to}`,
      }).catch((error) => console.warn("[payouts] admin e-mail failed", error)),
    ),
    sendTransactionalEmail({
      to: payout.sellerEmail,
      subject: `Demande de reversement reçue — ${amount}`,
      html: wrap("Demande de reversement reçue", sellerBody),
      text: sellerText,
      idempotencyKey: `payout-requested-seller/${payoutId}`,
    }).catch((error) => console.warn("[payouts] seller e-mail failed", error)),
  ]);
}

/** Transfert exécuté : le vendeur reçoit la référence. */
export async function notifyPayoutPaid(payoutId: string): Promise<void> {
  const payout = await loadPayout(payoutId);
  if (!payout) return;
  const amount = formatPrice(payout.amount, payout.currency);
  const destination = destinationLine(payout.destination);
  const body =
    `<p>Bonjour, <strong>${escapeEmailHtml(amount)}</strong> ont été versés sur : ${escapeEmailHtml(destination)}.</p>` +
    (payout.reference ? `<p>Référence du transfert : <strong>${escapeEmailHtml(payout.reference)}</strong></p>` : "") +
    (payout.note ? `<p>${escapeEmailHtml(payout.note)}</p>` : "") +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/payments"))}">Voir mes paiements</a></p>`;
  const text =
    `${amount} ont été versés sur : ${destination}.\n` +
    (payout.reference ? `Référence du transfert : ${payout.reference}\n` : "") +
    (payout.note ? `${payout.note}\n` : "");

  await sendTransactionalEmail({
    to: payout.sellerEmail,
    subject: `Reversement effectué — ${amount}`,
    html: wrap("Reversement effectué", body),
    text,
    idempotencyKey: `payout-paid/${payoutId}`,
  }).catch((error) => console.warn("[payouts] paid e-mail failed", error));
}

/** Refus motivé : le vendeur sait quoi corriger, la somme reste disponible. */
export async function notifyPayoutFailed(payoutId: string): Promise<void> {
  const payout = await loadPayout(payoutId);
  if (!payout) return;
  const amount = formatPrice(payout.amount, payout.currency);
  const body =
    `<p>Bonjour, nous n'avons pas pu effectuer ton reversement de <strong>${escapeEmailHtml(amount)}</strong>.</p>` +
    (payout.note ? `<p>Motif : ${escapeEmailHtml(payout.note)}</p>` : "") +
    `<p>La somme reste disponible : vérifie ton compte de reversement puis refais une demande.</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/payments"))}">Voir mes paiements</a></p>`;
  const text =
    `Nous n'avons pas pu effectuer ton reversement de ${amount}.\n` +
    (payout.note ? `Motif : ${payout.note}\n` : "") +
    `La somme reste disponible : vérifie ton compte de reversement puis refais une demande.`;

  await sendTransactionalEmail({
    to: payout.sellerEmail,
    subject: `Reversement non effectué — ${amount}`,
    html: wrap("Reversement non effectué", body),
    text,
    idempotencyKey: `payout-failed/${payoutId}`,
  }).catch((error) => console.warn("[payouts] failed e-mail failed", error));
}
