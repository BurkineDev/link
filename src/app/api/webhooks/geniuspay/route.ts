import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelUnpaidOrder, recordOrderRefund, settlePaidOrder } from "@/lib/db/orders";
import { applyBoostPayment, applySubscriptionPayment } from "@/lib/db/subscriptions";
import {
  mapStatusToPaymentStatus,
  verifyWebhookSignature,
  probeWebhookSignatureScheme,
  type GeniusPayStatus,
} from "@/lib/geniuspay";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";
import { ops } from "@/lib/ops/events";
import { safeToken, summarizeError } from "@/lib/ops/alert";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/webhooks/geniuspay
// ---------------------------------------------------------------------------
// Genius Pay POSTs lifecycle events here:
//   payment.initiated | payment.success | payment.failed |
//   payment.cancelled | payment.expired | payment.refunded
//
// Signature : voir verifyWebhookSignature (corps brut selon la doc actuelle,
// ancien schéma timestamp.corps accepté aussi ; en-têtes X-GeniusPay-* ou
// X-Webhook-*). We restore reserved stock when a payment fails / expires,
// and mark the order as paid + confirmed on success.
// ---------------------------------------------------------------------------

interface WebhookData {
  reference?: string;
  status?: GeniusPayStatus;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string | number | null> | null;
}

interface WebhookPayload {
  id?: string;
  event?: string;
  timestamp?: number;
  data?: WebhookData;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Deux familles d'en-têtes selon la version de Genius Pay.
  // (`||` : un en-tête présent mais vide replie sur l'autre famille.)
  const signature =
    request.headers.get("x-geniuspay-signature") || request.headers.get("x-webhook-signature");
  const timestamp =
    request.headers.get("x-geniuspay-timestamp") || request.headers.get("x-webhook-timestamp");
  const event =
    request.headers.get("x-geniuspay-event") || request.headers.get("x-webhook-event") || "";

  if (!verifyWebhookSignature({ rawBody, signature, timestamp })) {
    // Secret absent ou tourné, horloge en dérive : le fondateur doit le
    // savoir — un secret mal collé arrête les abonnements et boosts Mobile
    // Money, et les ventes si le mode En ligne est actif, sans autre
    // symptôme. Une requête sans en-têtes du tout n'est pas Genius Pay
    // (robot, scanner) : une trace, pas un réveil.
    // Une signature seule suffit désormais (la doc n'impose pas d'horodatage).
    const signed = Boolean(signature);
    const secretMissing = !process.env.GENIUSPAY_WEBHOOK_SECRET;
    ops[signed || secretMissing ? "critical" : "warning"]({
      kind: "webhook.signature_rejected",
      title: secretMissing
        ? "GENIUSPAY_WEBHOOK_SECRET absent : webhooks Genius Pay refusés"
        : signed
          ? "Webhook Genius Pay rejeté (signature invalide)"
          : "Requête sans signature sur le webhook Genius Pay",
      detail: secretMissing
        ? "Aucun webhook Genius Pay ne peut être accepté tant que le secret n'est pas posé sur Vercel."
        : signed
          ? "Signature invalide ou horodatage hors des 300 s. Si ça se répète, compare le secret du webhook « bio-lien » chez Genius Pay et GENIUSPAY_WEBHOOK_SECRET dans Infisical."
          : "Probablement un robot : aucune signature ni horodatage. Rien à faire si ça reste isolé.",
      // La forme de ce qui a été reçu (jamais la valeur) : c'est ce qui
      // permet de distinguer « mauvais secret » de « autre encodage » sans
      // capturer la requête — hex de 64 = HMAC-SHA256 attendu.
      context: {
        event: safeToken(event),
        hasSignature: Boolean(signature),
        hasTimestamp: Boolean(timestamp),
        signatureLength: signature?.length ?? 0,
        signatureHex: Boolean(signature && /^[0-9a-f]+$/i.test(signature.trim())),
        timestampDigits: timestamp?.replace(/\D/g, "").length ?? 0,
        bodyBytes: Buffer.byteLength(rawBody),
        // Quel schéma connu aurait accepté la requête (nom seulement) : null
        // avec une signature hex de 64 = le secret configuré n'est pas le bon.
        matchedScheme: probeWebhookSignatureScheme({ rawBody, signature, timestamp }),
      },
      dedupeKey: `webhook.signature_rejected:geniuspay${signed || secretMissing ? "" : ":unsigned"}`,
    });
    return new NextResponse(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Test events have no transaction reference — ack and move on.
  if (event === "webhook.test" || !payload.data?.reference) {
    return new NextResponse(null, { status: 200 });
  }

  const data = payload.data;

  // ── Abonnement vendeur ────────────────────────────────────────────────
  // Trois flux arrivent sur cette même URL : les commandes d'acheteurs, les
  // périodes d'abonnement et les boosts ponctuels. Sans cet aiguillage, un
  // paiement d'abonnement irait chercher une commande qui n'existe pas,
  // repartirait en 200, et le vendeur aurait payé pour rien.
  if (data.metadata?.kind === "subscription") {
    return handleSubscriptionEvent(data);
  }

  if (data.metadata?.kind === "boost") {
    return handleBoostEvent(data);
  }

  const orderId =
    typeof data.metadata?.orderId === "string"
      ? data.metadata.orderId
      : typeof data.metadata?.order_id === "string"
        ? data.metadata.order_id
        : null;

  if (!orderId) {
    // Un paiement réel sans commande désignée : rattrapable par la page de
    // succès ou le cron (via paymentRef), mais à regarder.
    ops.warning({
      kind: "webhook.order_not_found",
      title: "Paiement Genius Pay sans identifiant de commande",
      detail: "Les métadonnées ne portent pas d'orderId. La commande sera rattrapée par sa référence (page de succès, cron) si elle existe.",
      context: { provider: "geniuspay", reference: data.reference, status: data.status, amount: data.amount, currency: data.currency },
      dedupeKey: `webhook.order_not_found:geniuspay:${data.reference}`,
    });
    return new NextResponse(null, { status: 200 });
  }

  let order: {
    id: string;
    totalAmount: unknown;
    currency: string;
    paymentStatus: string;
  } | null;
  try {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalAmount: true, currency: true, paymentStatus: true },
    });
  } catch (error) {
    console.error("[geniuspay-webhook] DB read error:", error);
    ops.critical({
      kind: "webhook.handler_error",
      title: "Webhook Genius Pay : base injoignable",
      detail: `La lecture de la commande a échoué (${summarizeError(error)}). Genius Pay réessaiera ; si ça persiste, les paiements ne sont plus confirmés.`,
      context: { provider: "geniuspay", reference: data.reference, orderId },
      dedupeKey: "webhook.handler_error:geniuspay",
    });
    return new NextResponse(null, { status: 500 });
  }

  if (!order) {
    // Argent encaissé chez Genius Pay pour une commande que la base ne
    // connaît pas : le cron ne peut rien, il part des commandes.
    const paid = mapStatusToPaymentStatus(data.status ?? "pending") === "paid";
    ops[paid ? "critical" : "warning"]({
      kind: "webhook.order_not_found",
      title: paid
        ? "Paiement Genius Pay encaissé pour une commande introuvable"
        : "Webhook Genius Pay pour une commande introuvable",
      detail: paid
        ? "Le paiement est confirmé côté Genius Pay mais aucune commande ne porte cet identifiant : retrouve la transaction dans Genius Pay et rembourse l'acheteur depuis là."
        : "Aucune commande ne porte cet identifiant.",
      context: { provider: "geniuspay", reference: data.reference, orderId, status: data.status, amount: data.amount, currency: data.currency },
      dedupeKey: `webhook.order_not_found:geniuspay:${orderId}`,
    });
    return new NextResponse(null, { status: 200 });
  }

  const incomingStatus = data.status ?? "pending";
  const nextPaymentStatus = mapStatusToPaymentStatus(incomingStatus);

  // Remboursement d'une commande payée : la part du net vendeur est
  // contre-passée dans le registre, sinon le vendeur pourrait se faire
  // verser une vente que Bio-Lien a déjà remboursée. Idempotent sur la
  // référence.
  if (
    nextPaymentStatus === "refunded" &&
    (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded")
  ) {
    try {
      const result = await recordOrderRefund(order.id, {
        amount: typeof data.amount === "number" ? data.amount : Number(order.totalAmount),
        reference: `${data.reference}:refund`,
        provider: "geniuspay",
      });
      console.info("[geniuspay-webhook] refund on order", order.id, result);
      if (!result.recorded && result.reason !== "already_recorded") {
        // Un remboursement réel non contre-passé laisse le net vendeur
        // « disponible » au reversement. (Un rejeu du même événement
        // répond already_recorded : rien à signaler.)
        ops.critical({
          kind: "webhook.refund_not_recorded",
          title: `Remboursement Genius Pay non contre-passé — commande #${order.id.slice(0, 8).toUpperCase()}`,
          detail: `recordOrderRefund a répondu « ${result.reason} » : vérifie le registre de cette boutique (Équipe → Reversements) avant d'exécuter un reversement.`,
          context: { provider: "geniuspay", orderId: order.id, reference: data.reference, amount: data.amount, reason: result.reason },
          dedupeKey: `webhook.refund_not_recorded:${order.id}`,
        });
      }
    } catch (error) {
      console.error("[geniuspay-webhook] refund error:", error);
      ops.critical({
        kind: "webhook.handler_error",
        title: "Webhook Genius Pay : remboursement en erreur",
        detail: summarizeError(error),
        context: { provider: "geniuspay", orderId: order.id, reference: data.reference },
        dedupeKey: `webhook.handler_error:geniuspay:refund:${order.id}`,
      });
      return new NextResponse(null, { status: 500 });
    }
    return new NextResponse(null, { status: 200 });
  }

  // Idempotent — once we've already settled the order, ack and stop.
  if (
    order.paymentStatus === "paid" ||
    order.paymentStatus === "refunded" ||
    order.paymentStatus === "partially_refunded" ||
    order.paymentStatus === "failed"
  ) {
    // Sauf un cas qui n'a rien d'idempotent : le paiement arrive APRÈS
    // que la commande a été annulée (réconciliation à 2 h, webhook
    // « failed » antérieur). L'acheteur a été débité, le stock est rendu,
    // personne ne livre. On n'écrit rien (la commande est close) mais le
    // fondateur doit rembourser ou rappeler l'acheteur.
    if (nextPaymentStatus === "paid" && order.paymentStatus === "failed") {
      ops.critical({
        kind: "payment.late_after_cancel",
        title: `Paiement Genius Pay reçu sur une commande annulée — #${order.id.slice(0, 8).toUpperCase()}`,
        detail: "L'acheteur a payé après l'annulation de sa commande (expirée ou marquée échouée) : rien n'est réservé, personne ne livrera. Rembourse la transaction depuis Genius Pay, ou préviens le vendeur pour qu'il livre et marque la commande payée depuis ses Commandes.",
        context: { provider: "geniuspay", orderId: order.id, reference: data.reference, amount: data.amount, currency: data.currency },
        dedupeKey: `payment.late_after_cancel:${order.id}`,
      });
    }
    return new NextResponse(null, { status: 200 });
  }

  if (nextPaymentStatus === "paid") {
    // Sanity check on amount + currency.
    const amountOk =
      typeof data.amount === "number" && data.amount >= Number(order.totalAmount);
    const currencyOk =
      !data.currency ||
      data.currency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn(
        "[geniuspay-webhook] amount/currency mismatch for order:",
        order.id,
      );
      // L'acheteur a été débité d'un autre montant (ou dans une autre
      // devise) : la commande restera « en attente » tant que quelqu'un
      // n'a pas tranché.
      ops.critical({
        kind: "payment.amount_mismatch",
        title: `Paiement Genius Pay d'un montant inattendu — commande #${order.id.slice(0, 8).toUpperCase()}`,
        detail: `Genius Pay confirme ${data.amount ?? "?"} ${data.currency ?? ""} pour une commande de ${Number(order.totalAmount)} ${order.currency}. La commande reste en attente : rembourse la transaction depuis Genius Pay, ou demande au vendeur de la marquer payée depuis ses Commandes s'il accepte ce montant.`,
        context: { provider: "geniuspay", orderId: order.id, reference: data.reference, received: data.amount, receivedCurrency: data.currency, expected: Number(order.totalAmount), expectedCurrency: order.currency },
        dedupeKey: `payment.amount_mismatch:${order.id}`,
      });
      return new NextResponse(null, { status: 200 });
    }

    try {
      const settlement = await settlePaidOrder(order.id, data.reference!, "geniuspay");
      if (settlement.settled) {
        // Après la réponse : Vercel garde l'invocation vivante jusqu'à la
        // fin de l'envoi, alors qu'une promesse détachée pouvait être gelée
        // dès le 200 renvoyé à Genius Pay.
        scheduleAfterResponse(
          () => notifyPaidOrder(order.id),
          (err) => console.warn("[geniuspay-webhook] order notification failed", err),
        );
      }
    } catch (error) {
      // 500 : Genius Pay réessaiera, et le règlement est idempotent.
      console.error("[geniuspay-webhook] update error:", error);
      ops.critical({
        kind: "webhook.handler_error",
        title: "Webhook Genius Pay : règlement en erreur",
        detail: `settlePaidOrder a levé (${summarizeError(error)}). Genius Pay réessaiera ; si ça persiste, l'acheteur a payé et la commande reste en attente.`,
        context: { provider: "geniuspay", orderId: order.id, reference: data.reference },
        dedupeKey: `webhook.handler_error:geniuspay:settle:${order.id}`,
      });
      return new NextResponse(null, { status: 500 });
    }

    console.info(
      `[geniuspay-webhook] order ${order.id} confirmed via Genius Pay (${data.reference})`,
    );
    return new NextResponse(null, { status: 200 });
  }

  if (nextPaymentStatus === "failed") {
    try {
      await cancelUnpaidOrder(order.id, data.reference ?? null, "geniuspay");
    } catch (error) {
      console.error("[geniuspay-webhook] update error:", error);
      return new NextResponse(null, { status: 500 });
    }

    console.info(
      `[geniuspay-webhook] order ${order.id} marked failed (${incomingStatus})`,
    );
    return new NextResponse(null, { status: 200 });
  }

  // pending / processing → just record the reference + provider.
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRef: data.reference, paymentProvider: "geniuspay" },
  });

  return new NextResponse(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Abonnements payés d'avance
// ---------------------------------------------------------------------------

/**
 * Crédite (ou non) la période achetée.
 *
 * Tout le travail est fait par `applySubscriptionPayment`, sous verrou :
 * c'est la seule façon d'être à la fois atomique et idempotent quand Genius
 * Pay livre deux fois le même événement, ce qu'un prestataire de paiement
 * fait régulièrement et légitimement.
 *
 * Un échec, une annulation ou une expiration ne fait que marquer la ligne :
 * il n'y a rien à rendre, puisque rien n'a été crédité tant que le paiement
 * n'était pas confirmé.
 */
async function handleSubscriptionEvent(data: WebhookData) {
  const reference = data.reference;
  if (!reference) return new NextResponse(null, { status: 200 });

  const status = mapStatusToPaymentStatus(data.status ?? "pending");

  if (status !== "paid") {
    if (status === "failed") {
      try {
        await prisma.subscriptionPayment.updateMany({
          where: { reference, status: "pending" },
          data: { status },
        });
      } catch (error) {
        console.error("[geniuspay-webhook] subscription status update", error);
        return new NextResponse(null, { status: 500 });
      }
    }
    return new NextResponse(null, { status: 200 });
  }

  try {
    const applied = await applySubscriptionPayment(reference);
    console.info("[geniuspay-webhook] subscription", reference, applied);
    if (!applied.applied && applied.reason === "unknown_reference") {
      // Le vendeur a payé sa période, aucune ligne ne porte la référence :
      // la période ne sera jamais créditée sans intervention.
      ops.critical({
        kind: "webhook.unknown_reference",
        title: "Abonnement Mobile Money payé sur une référence inconnue",
        detail: "Genius Pay confirme un paiement d'abonnement qu'aucune ligne subscription_payments ne porte. Le vendeur a payé sans être crédité : retrouve la transaction dans Genius Pay (métadonnées) et rembourse-le, ou écris-lui pour recommencer.",
        context: { provider: "geniuspay", kind: "subscription", reference, amount: data.amount, currency: data.currency },
        dedupeKey: `webhook.unknown_reference:subscription:${reference}`,
      });
    }
  } catch (error) {
    // 500 : Genius Pay réessaiera, et l'opération est idempotente — une
    // nouvelle tentative ne peut pas créditer deux périodes.
    console.error("[geniuspay-webhook] apply_subscription_payment", error);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}

/**
 * Active (ou non) le boost acheté.
 *
 * Même contrat que les abonnements : c'est `applyBoostPayment` qui décide,
 * en une transaction, parce que Genius Pay peut livrer deux fois le même
 * événement. La fonction prolonge un boost encore en cours plutôt que de
 * l'écraser — les heures restantes ont été payées.
 */
async function handleBoostEvent(data: WebhookData) {
  const reference = data.reference;
  if (!reference) return new NextResponse(null, { status: 200 });

  const status = mapStatusToPaymentStatus(data.status ?? "pending");

  if (status !== "paid") {
    if (status === "failed") {
      try {
        await prisma.boostPurchase.updateMany({
          where: { reference, status: "pending" },
          data: { status: "failed" },
        });
      } catch (error) {
        console.error("[geniuspay-webhook] boost status update", error);
        return new NextResponse(null, { status: 500 });
      }
    }
    return new NextResponse(null, { status: 200 });
  }

  try {
    const applied = await applyBoostPayment(reference);
    console.info("[geniuspay-webhook] boost", reference, applied);
    if (!applied.applied && applied.reason === "unknown_reference") {
      ops.critical({
        kind: "webhook.unknown_reference",
        title: "Boost Mobile Money payé sur une référence inconnue",
        detail: "Genius Pay confirme un paiement de boost qu'aucune ligne boost_purchases ne porte : le vendeur a payé sans que sa boutique soit mise en avant.",
        context: { provider: "geniuspay", kind: "boost", reference, amount: data.amount, currency: data.currency },
        dedupeKey: `webhook.unknown_reference:boost:${reference}`,
      });
    }
  } catch (error) {
    console.error("[geniuspay-webhook] apply_boost_payment", error);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
