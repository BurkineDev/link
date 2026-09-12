import "server-only";

import { prisma } from "@/lib/prisma";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";
import { formatPrice } from "@/lib/utils/format";
import { adminEmails } from "@/lib/admin-emails";
import { OPEN_PAYOUT_STATUSES, PAYOUT_PROVIDER_LABELS, type PayoutProvider } from "./config";
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

/** « +226…3456 » / « CI93…9012 » : assez pour reconnaître son compte, pas pour le copier. */
export function maskIdentifier(identifier: string, phone: boolean): string {
  const clean = identifier.replace(/\s+/g, "");
  if (clean.length <= 6) return phone ? `+${clean}` : clean;
  const head = phone ? `+${clean.slice(0, 3)}` : clean.slice(0, 4);
  return `${head}…${clean.slice(-4)}`;
}

function destinationLine(destination: PayoutDestination | null, options: { masked: boolean }) {
  if (!destination) return "compte de reversement non renseigné";
  const phone = destination.provider !== "bank";
  const id = options.masked
    ? maskIdentifier(destination.accountIdentifier, phone)
    : phone
      ? `+${destination.accountIdentifier}`
      : destination.accountIdentifier;
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
  const destination = destinationLine(payout.destination, { masked: false });
  const maskedDestination = destinationLine(payout.destination, { masked: true });
  const admins = adminEmails();

  if (admins.length === 0) {
    console.error("[payouts] ADMIN_EMAILS non défini : personne ne recevra la demande", payoutId);
  }

  const freshAccount =
    payout.destination?.accountUpdatedAt &&
    Date.now() - new Date(payout.destination.accountUpdatedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  const accountNote = payout.destination?.isVerified
    ? "Compte déjà vérifié par un versement précédent."
    : freshAccount
      ? "ATTENTION : compte jamais vérifié, renseigné ou modifié il y a moins de 7 jours."
      : "Compte jamais vérifié : premier versement.";

  const adminBody =
    `<p><strong>${escapeEmailHtml(payout.shop.name)}</strong> (${escapeEmailHtml(payout.shop.slug)}) demande un reversement de <strong>${escapeEmailHtml(amount)}</strong>.</p>` +
    `<p>Destination : ${escapeEmailHtml(destination)}</p>` +
    `<p>${escapeEmailHtml(accountNote)}</p>` +
    `<p>Vendeur : ${escapeEmailHtml(payout.sellerEmail)}</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/admin/payouts"))}">Traiter la demande</a></p>`;
  const adminText =
    `${payout.shop.name} (${payout.shop.slug}) demande un reversement de ${amount}.\n` +
    `Destination : ${destination}\n${accountNote}\nVendeur : ${payout.sellerEmail}\n` +
    `Traiter : ${appUrl("/dashboard/admin/payouts")}`;

  const sellerBody =
    `<p>Bonjour, ta demande de reversement de <strong>${escapeEmailHtml(amount)}</strong> est bien enregistrée.</p>` +
    `<p>Elle sera versée sur : ${escapeEmailHtml(maskedDestination)}.</p>` +
    `<p>Tu recevras un e-mail dès que le transfert est effectué, en général sous 2 jours ouvrés.</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/payments"))}">Voir mes paiements</a></p>`;
  const sellerText =
    `Ta demande de reversement de ${amount} est bien enregistrée.\n` +
    `Elle sera versée sur : ${maskedDestination}.\n` +
    `Tu recevras un e-mail dès que le transfert est effectué, en général sous 2 jours ouvrés.`;

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
  const destination = destinationLine(payout.destination, { masked: true });
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

/** Transfert rejeté par l'opérateur après avoir été marqué versé : la somme redevient disponible. */
export async function notifyPayoutBounced(payoutId: string): Promise<void> {
  const payout = await loadPayout(payoutId);
  if (!payout) return;
  const amount = formatPrice(payout.amount, payout.currency);
  const destination = destinationLine(payout.destination, { masked: true });
  const body =
    `<p>Bonjour, le transfert de <strong>${escapeEmailHtml(amount)}</strong> vers ${escapeEmailHtml(destination)} a été rejeté par l'opérateur.</p>` +
    (payout.note ? `<p>Motif : ${escapeEmailHtml(payout.note)}</p>` : "") +
    `<p>La somme est de nouveau disponible : vérifie ton compte de reversement, puis refais une demande.</p>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/payments"))}">Voir mes paiements</a></p>`;
  const text =
    `Le transfert de ${amount} vers ${destination} a été rejeté par l'opérateur.\n` +
    (payout.note ? `Motif : ${payout.note}\n` : "") +
    `La somme est de nouveau disponible : vérifie ton compte de reversement, puis refais une demande.`;

  await sendTransactionalEmail({
    to: payout.sellerEmail,
    subject: `Transfert rejeté — ${amount}`,
    html: wrap("Transfert rejeté", body),
    text,
    idempotencyKey: `payout-bounced/${payoutId}`,
  }).catch((error) => console.warn("[payouts] bounced e-mail failed", error));
}

/**
 * Le compte de reversement a changé : alerte à l'adresse de connexion (pas
 * l'adresse de contact de la boutique, qui pourrait avoir été modifiée dans
 * le même geste), avec les identifiants masqués.
 */
export async function notifyPayoutAccountChanged(input: {
  loginEmail: string;
  shopName: string;
  previous: { provider: string; accountIdentifier: string } | null;
  next: { provider: string; accountIdentifier: string };
}): Promise<void> {
  const line = (account: { provider: string; accountIdentifier: string }) =>
    `${providerLabel(account.provider)} ${maskIdentifier(account.accountIdentifier, account.provider !== "bank")}`;
  const body =
    `<p>Bonjour, le compte de reversement de <strong>${escapeEmailHtml(input.shopName)}</strong> vient d'être ${input.previous ? "modifié" : "enregistré"}.</p>` +
    (input.previous ? `<p>Avant : ${escapeEmailHtml(line(input.previous))}</p>` : "") +
    `<p>Maintenant : ${escapeEmailHtml(line(input.next))}</p>` +
    `<p>Si ce n'est pas toi, change ton mot de passe tout de suite et réponds à cet e-mail : aucun versement ne partira vers ce compte sans vérification.</p>`;
  const text =
    `Le compte de reversement de ${input.shopName} vient d'être ${input.previous ? "modifié" : "enregistré"}.\n` +
    (input.previous ? `Avant : ${line(input.previous)}\n` : "") +
    `Maintenant : ${line(input.next)}\n` +
    `Si ce n'est pas toi, change ton mot de passe tout de suite et réponds à cet e-mail.`;

  await sendTransactionalEmail({
    to: input.loginEmail,
    subject: `Compte de reversement ${input.previous ? "modifié" : "enregistré"} — ${input.shopName}`,
    html: wrap(`Compte de reversement ${input.previous ? "modifié" : "enregistré"}`, body),
    text,
  }).catch((error) => console.warn("[payouts] account-changed e-mail failed", error));
}

/**
 * Relance quotidienne (cron) : toute demande encore ouverte après deux jours
 * est renvoyée à l'équipe, une fois par jour et par demande. Rien ne dépend
 * de la seule boîte mail du jour de la demande.
 */
export async function remindStalePayouts(
  now: Date = new Date(),
): Promise<{ stale: number; reminded: number }> {
  const admins = adminEmails();
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const stale = await prisma.payout.findMany({
    where: { status: { in: [...OPEN_PAYOUT_STATUSES] }, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      amount: true,
      currency: true,
      createdAt: true,
      shop: { select: { name: true, slug: true } },
    },
  });
  if (stale.length === 0) return { stale: 0, reminded: 0 };

  if (admins.length === 0) {
    console.error("[payouts] ADMIN_EMAILS non défini :", stale.length, "demande(s) en attente sans destinataire");
    return { stale: stale.length, reminded: 0 };
  }

  const day = now.toISOString().slice(0, 10);
  const lines = stale.map(
    (payout) =>
      `${payout.shop.name} (${payout.shop.slug}) — ${formatPrice(Number(payout.amount), payout.currency)} — demandé le ${payout.createdAt.toLocaleDateString("fr-FR")}`,
  );
  const body =
    `<p>${stale.length} demande(s) de reversement attendent depuis plus de deux jours :</p>` +
    `<ul>${lines.map((line) => `<li>${escapeEmailHtml(line)}</li>`).join("")}</ul>` +
    `<p><a href="${escapeEmailHtml(appUrl("/dashboard/admin/payouts"))}">Traiter les demandes</a></p>`;
  const text = `${stale.length} demande(s) de reversement attendent depuis plus de deux jours :\n${lines.join("\n")}\nTraiter : ${appUrl("/dashboard/admin/payouts")}`;

  const results = await Promise.allSettled(
    admins.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `${stale.length} reversement(s) en attente depuis plus de 2 jours`,
        html: wrap("Reversements en retard", body),
        text,
        idempotencyKey: `payout-reminder/${day}/${to}`,
      }),
    ),
  );
  const reminded = results.filter((r) => r.status === "fulfilled").length;
  results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .forEach((r) => console.warn("[payouts] reminder e-mail failed", r.reason));
  return { stale: stale.length, reminded };
}
