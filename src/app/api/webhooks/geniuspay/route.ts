import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelUnpaidOrder, settlePaidOrder } from "@/lib/db/orders";
import { applyBoostPayment, applySubscriptionPayment } from "@/lib/db/subscriptions";
import {
  mapStatusToPaymentStatus,
  verifyWebhookSignature,
  type GeniusPayStatus,
} from "@/lib/geniuspay";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/webhooks/geniuspay
// ---------------------------------------------------------------------------
// Genius Pay POSTs lifecycle events here:
//   payment.initiated | payment.success | payment.failed |
//   payment.cancelled | payment.expired | payment.refunded
//
// The signature is HMAC-SHA256(timestamp + "." + rawJson, webhookSecret).
// We restore reserved stock when a payment fails / expires, and mark
// the order as paid + confirmed on success.
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

  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const event = request.headers.get("x-webhook-event") ?? "";

  if (!verifyWebhookSignature({ rawBody, signature, timestamp })) {
    console.warn("[geniuspay-webhook] invalid signature or stale timestamp");
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
    console.warn(
      "[geniuspay-webhook] missing orderId metadata for reference:",
      data.reference,
    );
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
    return new NextResponse(null, { status: 500 });
  }

  if (!order) {
    console.warn(
      "[geniuspay-webhook] order not found for reference:",
      data.reference,
    );
    return new NextResponse(null, { status: 200 });
  }

  // Idempotent — once we've already settled the order, ack and stop.
  if (
    order.paymentStatus === "paid" ||
    order.paymentStatus === "refunded" ||
    order.paymentStatus === "failed"
  ) {
    return new NextResponse(null, { status: 200 });
  }

  const incomingStatus = data.status ?? "pending";
  const nextPaymentStatus = mapStatusToPaymentStatus(incomingStatus);

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
  } catch (error) {
    console.error("[geniuspay-webhook] apply_boost_payment", error);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
