import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  cancelUnpaidOrder,
  recordOrderRefund,
  reverseChargeback,
  settlePaidOrder,
} from "@/lib/db/orders";
import { fromStripeAmount, getStripe } from "@/lib/stripe";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";
import { ops } from "@/lib/ops/events";
import { summarizeError } from "@/lib/ops/alert";
import { BOOSTS } from "@/lib/subscription";
import type {
  BillingInterval,
  BoostType,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/types/database";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// Configure in Stripe dashboard:
//   https://<your-domain>/api/webhooks/stripe
// Events handled:
//   • Order checkout:
//       checkout.session.completed   (mode=payment)
//       checkout.session.expired
//   • Creator subscription:
//       checkout.session.completed   (mode=subscription)
//       customer.subscription.updated
//       customer.subscription.deleted
//       invoice.payment_failed
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.warn("[stripe-webhook] missing signature or webhook secret");
    // Sans secret, chaque événement Stripe (commandes, abonnements, boosts,
    // remboursements, litiges) est refusé : toute la chaîne carte s'arrête.
    // Une requête sans en-tête n'est pas Stripe (robot) : une trace, pas
    // un réveil.
    ops[webhookSecret ? "warning" : "critical"]({
      kind: "webhook.signature_rejected",
      title: webhookSecret ? "Requête sans signature sur le webhook Stripe" : "STRIPE_WEBHOOK_SECRET absent : webhooks Stripe refusés",
      detail: webhookSecret
        ? "Probablement un robot : aucun en-tête stripe-signature. Rien à faire si ça reste isolé."
        : "Aucun événement Stripe ne peut être accepté tant que le secret n'est pas posé sur Vercel.",
      context: { provider: "stripe", hasSignature: Boolean(signature), hasSecret: Boolean(webhookSecret) },
      dedupeKey: webhookSecret ? "webhook.signature_rejected:stripe:unsigned" : "webhook.signature_rejected:stripe",
    });
    return new NextResponse(null, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn(
      "[stripe-webhook] invalid signature:",
      err instanceof Error ? err.message : err,
    );
    ops.critical({
      kind: "webhook.signature_rejected",
      title: "Webhook Stripe rejeté (signature invalide)",
      detail: "Secret tourné côté Stripe sans mise à jour sur Vercel, ou requête forgée. Si ça se répète, compare le secret de l'endpoint Stripe et STRIPE_WEBHOOK_SECRET.",
      context: { provider: "stripe", error: err instanceof Error ? err.message.slice(0, 160) : String(err) },
      dedupeKey: "webhook.signature_rejected:stripe",
    });
    return new NextResponse(null, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.expired": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
        } else if (session.metadata?.kind === "boost") {
          await handleBoostCheckoutEvent(event.type, session);
        } else {
          await handleOrderCheckoutEvent(event.type, session);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoicePaymentFailed(event.data.object);
        break;
      }
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object);
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        await handleDispute(event.type, event.data.object, stripe);
        break;
      }
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    ops.critical({
      kind: "webhook.handler_error",
      title: `Webhook Stripe en erreur (${event.type})`,
      detail: `${summarizeError(err)}. Stripe réessaiera pendant trois jours ; si ça persiste, les paiements carte ne sont plus confirmés.`,
      context: { provider: "stripe", eventType: event.type, eventId: event.id },
      dedupeKey: `webhook.handler_error:stripe:${event.type}`,
    });
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}


// ---------------------------------------------------------------------------
// Remboursements et litiges : contre-passation du net vendeur
// ---------------------------------------------------------------------------

/**
 * `charge.refunded` arrive à chaque remboursement, avec `amount_refunded`
 * cumulé. L'identifiant de commande vient des métadonnées du PaymentIntent,
 * copiées sur la charge (`payment_intent_data.metadata` au checkout).
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId = charge.metadata?.orderId;
  if (!orderId) {
    console.warn("[stripe-webhook] refund without orderId metadata:", charge.id);
    return;
  }
  const refundedTotal = fromStripeAmount(charge.amount_refunded, charge.currency);
  if (refundedTotal === null || refundedTotal <= 0) return;

  const result = await recordOrderRefund(orderId, {
    amount: refundedTotal,
    cumulative: true,
    reference: `${charge.id}:refund:${charge.amount_refunded}`,
    provider: "stripe",
  });
  console.info("[stripe-webhook] refund on order", orderId, result);
  if (!result.recorded && result.reason !== "already_recorded") {
    ops.critical({
      kind: "webhook.refund_not_recorded",
      title: `Remboursement Stripe non contre-passé — commande #${orderId.slice(0, 8).toUpperCase()}`,
      detail: `recordOrderRefund a répondu « ${result.reason} » : le net vendeur de cette commande peut rester disponible au reversement alors que Stripe a remboursé. Vérifie le registre de la boutique avant tout reversement.`,
      context: { provider: "stripe", orderId, chargeId: charge.id, refundedTotal, reason: result.reason },
      dedupeKey: `webhook.refund_not_recorded:${orderId}`,
    });
  }
}

/**
 * Litige carte : le montant contesté est retenu sur le net vendeur dès
 * l'ouverture ; s'il est gagné, la retenue est annulée.
 */
async function handleDispute(
  eventType: "charge.dispute.created" | "charge.dispute.closed",
  dispute: Stripe.Dispute,
  stripe: ReturnType<typeof getStripe>,
) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  const charge =
    typeof dispute.charge === "string" ? await stripe.charges.retrieve(chargeId) : dispute.charge;
  const orderId = charge.metadata?.orderId;
  if (!orderId) {
    console.warn("[stripe-webhook] dispute without orderId metadata:", dispute.id);
    return;
  }

  if (eventType === "charge.dispute.created") {
    const amount = fromStripeAmount(dispute.amount, dispute.currency);
    if (amount === null || amount <= 0) return;
    const result = await recordOrderRefund(orderId, {
      amount,
      reference: dispute.id,
      provider: "stripe",
      kind: "chargeback",
    });
    console.info("[stripe-webhook] dispute opened on order", orderId, result);
    // Un litige a une date limite de réponse chez Stripe : le fondateur
    // doit le voir tout de suite, avec ou sans retenue enregistrée.
    ops.critical({
      kind: "webhook.dispute_opened",
      title: `Litige carte ouvert — commande #${orderId.slice(0, 8).toUpperCase()}`,
      detail: `L'acheteur conteste ${amount} ${dispute.currency.toUpperCase()}. Réponds dans Stripe avant la date limite ; la retenue sur le net vendeur ${result.recorded ? "est enregistrée" : `n'a PAS été enregistrée (${result.reason})`}.`,
      context: { provider: "stripe", orderId, disputeId: dispute.id, amount, currency: dispute.currency, reason: dispute.reason, recorded: result.recorded },
      dedupeKey: `webhook.dispute:${dispute.id}`,
    });
    return;
  }

  if (dispute.status === "won") {
    const result = await reverseChargeback(orderId, { reference: dispute.id, provider: "stripe" });
    console.info("[stripe-webhook] dispute won on order", orderId, result);
    return;
  }

  if (dispute.status === "lost") {
    ops.critical({
      kind: "webhook.dispute_lost",
      title: `Litige carte perdu — commande #${orderId.slice(0, 8).toUpperCase()}`,
      detail: "Stripe a tranché en faveur de l'acheteur : montant et frais de litige sont débités du compte Bio-Lien ; la retenue sur le net vendeur reste acquise.",
      context: { provider: "stripe", orderId, disputeId: dispute.id, amount: fromStripeAmount(dispute.amount, dispute.currency), currency: dispute.currency },
      dedupeKey: `webhook.dispute_lost:${dispute.id}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Order checkout handlers
// ---------------------------------------------------------------------------

async function handleOrderCheckoutEvent(
  eventType: "checkout.session.completed" | "checkout.session.expired",
  session: Stripe.Checkout.Session,
) {
  const orderId = session.metadata?.orderId;
  const completedAndPaid = eventType === "checkout.session.completed" && session.payment_status === "paid";
  if (!orderId) {
    console.warn("[stripe-webhook] missing orderId metadata for session:", session.id);
    if (completedAndPaid) {
      // Stripe a encaissé, aucune commande n'est désignée, et Stripe n'a
      // pas de réconciliation serveur : à rapprocher à la main.
      ops.critical({
        kind: "webhook.order_not_found",
        title: "Paiement Stripe encaissé sans identifiant de commande",
        detail: "La session Stripe est payée mais ne porte pas d'orderId : aucune commande ne sera réglée. Retrouve la session dans Stripe et rembourse l'acheteur depuis là.",
        context: { provider: "stripe", sessionId: session.id, amount: stripeMajor(session), currency: session.currency?.toUpperCase() },
        dedupeKey: `webhook.order_not_found:stripe:${session.id}`,
      });
    }
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalAmount: true, currency: true, paymentStatus: true },
  });

  if (!order) {
    console.warn("[stripe-webhook] order not found for session:", session.id);
    if (completedAndPaid) {
      ops.critical({
        kind: "webhook.order_not_found",
        title: "Paiement Stripe encaissé pour une commande introuvable",
        detail: "La session est payée mais la commande n'existe pas en base : retrouve la session dans Stripe et rembourse l'acheteur depuis là.",
        context: { provider: "stripe", sessionId: session.id, orderId, amount: stripeMajor(session), currency: session.currency?.toUpperCase() },
        dedupeKey: `webhook.order_not_found:stripe:${orderId}`,
      });
    }
    return;
  }

  if (order.paymentStatus === "paid" || order.paymentStatus === "failed") {
    // Already processed — idempotent no-op… sauf un paiement qui arrive
    // après l'annulation de la commande : l'acheteur a été débité, rien ne
    // sera livré, le fondateur doit trancher.
    if (completedAndPaid && order.paymentStatus === "failed") {
      ops.critical({
        kind: "payment.late_after_cancel",
        title: `Paiement Stripe reçu sur une commande annulée — #${order.id.slice(0, 8).toUpperCase()}`,
        detail: "La session a été payée après l'annulation de la commande (expirée ou échouée) : rien n'est réservé, personne ne livrera. Rembourse depuis Stripe, ou préviens le vendeur pour qu'il livre et marque la commande payée depuis ses Commandes.",
        context: { provider: "stripe", orderId: order.id, sessionId: session.id, amount: stripeMajor(session), currency: session.currency?.toUpperCase() },
        dedupeKey: `payment.late_after_cancel:${order.id}`,
      });
    }
    return;
  }

  if (eventType === "checkout.session.completed") {
    const paidAmount = fromStripeAmount(session.amount_total, order.currency);
    const amountOk = paidAmount !== null && paidAmount >= Number(order.totalAmount);
    const currencyOk =
      session.currency?.toUpperCase() === order.currency.toUpperCase();

    if (session.payment_status !== "paid" || !amountOk || !currencyOk) {
      console.warn(
        "[stripe-webhook] unpaid or mismatched session for order:",
        order.id,
      );
      if (session.payment_status === "paid") {
        ops.critical({
          kind: "payment.amount_mismatch",
          title: `Paiement Stripe d'un montant inattendu — commande #${order.id.slice(0, 8).toUpperCase()}`,
          detail: `Stripe confirme ${paidAmount ?? "?"} ${session.currency?.toUpperCase() ?? ""} pour une commande de ${Number(order.totalAmount)} ${order.currency}. La commande reste en attente : rembourse depuis Stripe, ou demande au vendeur de la marquer payée depuis ses Commandes s'il accepte ce montant.`,
          context: { provider: "stripe", orderId: order.id, sessionId: session.id, received: paidAmount, receivedCurrency: session.currency, expected: Number(order.totalAmount), expectedCurrency: order.currency },
          dedupeKey: `payment.amount_mismatch:${order.id}`,
        });
      }
      return;
    }

    // Verrou, contrôles d'état et écritures comptables sont dans
    // `settlePaidOrder` : un webhook rejoué retombe sur `already_paid`.
    const settlement = await settlePaidOrder(order.id, session.id, "stripe");

    if (settlement.settled) {
      scheduleAfterResponse(
        () => notifyPaidOrder(order.id),
        (err) => console.warn("[stripe-webhook] order notification failed", err),
      );
    }

    console.info(`[stripe-webhook] order ${order.id} confirmed. session=${session.id}`);
    return;
  }

  // session.expired — release stock and promo exactly once, even when the
  // browser verification callback races this webhook.
  await cancelUnpaidOrder(order.id, session.id, "stripe");

  console.info(`[stripe-webhook] order ${order.id} expired. session=${session.id}`);
}

// ---------------------------------------------------------------------------
// Subscription handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn(
      "[stripe-webhook] subscription session missing userId metadata:",
      session.id,
    );
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.warn("[stripe-webhook] subscription id missing on session:", session.id);
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  await upsertSubscriptionFromStripe(userId, sub);
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  if (userId) {
    await upsertSubscriptionFromStripe(userId, sub);
    return;
  }

  // Fall back to looking up the user via customer_id.
  const existing = await prisma.creatorSubscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });

  if (existing?.userId) {
    await upsertSubscriptionFromStripe(existing.userId, sub);
  } else {
    console.warn(
      "[stripe-webhook] could not resolve user for subscription:",
      sub.id,
    );
    // Une résiliation, un impayé ou un changement de plan qui ne trouve
    // pas son vendeur : le plan en base ne bougera pas.
    ops.warning({
      kind: "webhook.subscription_unresolved",
      title: "Changement d'abonnement Stripe sans vendeur connu",
      detail: `L'événement ${sub.status} sur l'abonnement ${sub.id} ne porte ni userId ni client connu : le plan du vendeur n'a pas été mis à jour.`,
      context: { provider: "stripe", subscriptionId: sub.id, customerId, status: sub.status },
      dedupeKey: `webhook.subscription_unresolved:${sub.id}`,
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  try {
    await prisma.creatorSubscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: "past_due" },
    });
  } catch (error) {
    console.error("[stripe-webhook] failed to mark subscription past_due:", error);
    // 200 quand même (Stripe ne rejoue pas) : l'abonné impayé garde son
    // plan tant que personne ne corrige.
    ops.critical({
      kind: "webhook.payment_failed_unrecorded",
      title: "Impayé d'abonnement Stripe non enregistré",
      detail: `Le passage en « past_due » a échoué (${summarizeError(error)}) : ce vendeur garde son plan payant sans avoir payé.`,
      context: { provider: "stripe", customerId, invoiceId: invoice.id },
      dedupeKey: `webhook.payment_failed_unrecorded:${customerId}`,
    });
  }
}

async function upsertSubscriptionFromStripe(
  userId: string,
  sub: Stripe.Subscription,
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Stripe's TS types occasionally hide current_period_end on the parent
  // (it lives on each subscription item in v2024+). Read defensively.
  const subAsRecord = sub as unknown as { current_period_end?: number };
  const periodEndUnix =
    subAsRecord.current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null;

  const isInactive =
    sub.status === "canceled" || sub.status === "incomplete_expired";

  const { plan, interval } = isInactive
    ? { plan: "free" as SubscriptionPlan, interval: null as BillingInterval | null }
    : resolvePlanFromSubscription(sub);

  const values = {
    plan,
    status: mapStripeStatus(sub.status),
    billingInterval: interval,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    // Un événement Stripe ne concerne qu'un abonnement géré par Stripe : on
    // l'affirme, plutôt que de laisser un ancien `geniuspay` en place.
    provider: "stripe" as const,
  };

  await prisma.creatorSubscription.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
}

/**
 * Determines the LinkBoutik plan + interval from a Stripe Subscription.
 *
 * Strategy, in order of preference:
 *   1. Read `metadata.plan` and `metadata.interval` (we set these on
 *      checkout creation — most reliable);
 *   2. Match the Price ID against env vars (covers Stripe Dashboard
 *      portal upgrades that don't go through our checkout API);
 *   3. Fall back to ('pro', 'month') so paying customers never get
 *      silently downgraded to 'free'.
 */
function resolvePlanFromSubscription(sub: Stripe.Subscription): {
  plan: SubscriptionPlan;
  interval: BillingInterval | null;
} {
  const metaPlan = sub.metadata?.plan;
  const metaInterval = sub.metadata?.interval;

  if (
    (metaPlan === "starter" || metaPlan === "pro") &&
    (metaInterval === "month" || metaInterval === "year")
  ) {
    return { plan: metaPlan, interval: metaInterval };
  }

  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  const intervalFromPrice = (item?.price?.recurring?.interval ?? null) as
    | BillingInterval
    | null;

  if (priceId) {
    const map: Record<string, SubscriptionPlan> = {
      [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? ""]: "starter",
      [process.env.STRIPE_STARTER_YEARLY_PRICE_ID ?? ""]: "starter",
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? ""]: "pro",
      [process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? ""]: "pro",
      [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro", // legacy single-Price config
    };
    delete map[""]; // env vars not set → don't accept an empty-key match.
    const matched = map[priceId];
    if (matched) {
      return { plan: matched, interval: intervalFromPrice };
    }
  }

  return { plan: "pro", interval: intervalFromPrice ?? "month" };
}

// ---------------------------------------------------------------------------
// Boost checkout handlers
// ---------------------------------------------------------------------------

async function handleBoostCheckoutEvent(
  eventType: "checkout.session.completed" | "checkout.session.expired",
  session: Stripe.Checkout.Session,
) {
  const boostPurchaseId = session.metadata?.boostPurchaseId;
  const boostType = session.metadata?.boostType as BoostType | undefined;
  const shopId = session.metadata?.shopId;

  if (!boostPurchaseId || !boostType || !shopId) {
    console.warn(
      "[stripe-webhook] boost session missing required metadata:",
      session.id,
    );
    return;
  }

  if (eventType === "checkout.session.expired") {
    await prisma.boostPurchase.updateMany({
      where: { id: boostPurchaseId, status: "pending" },
      data: { status: "expired" },
    });
    return;
  }

  if (session.payment_status !== "paid") {
    console.warn(
      "[stripe-webhook] boost session completed but not paid:",
      session.id,
    );
    return;
  }

  const boost = BOOSTS[boostType];
  const now = new Date();
  const expiresAt =
    boost.durationHours !== null
      ? new Date(now.getTime() + boost.durationHours * 60 * 60 * 1000)
      : null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // L'activation du boost et son effet sur la boutique vont ensemble.
  await prisma.$transaction(async (tx) => {
    await tx.boostPurchase.update({
      where: { id: boostPurchaseId },
      data: {
        status: "paid",
        stripePaymentIntentId: paymentIntentId,
        activatedAt: now,
        expiresAt,
      },
    });

    if (boostType === "featured_24h" && expiresAt) {
      await tx.shop.update({
        where: { id: shopId },
        data: { featuredUntil: expiresAt },
      });
    }
  });

  console.info(
    `[stripe-webhook] boost ${boostType} activated for shop ${shopId} (purchase=${boostPurchaseId})`,
  );
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
    case "paused":
    default:
      return "incomplete";
  }
}

/** Montant d'une session dans l'unité de la devise (Stripe compte en centimes). */
function stripeMajor(session: Stripe.Checkout.Session): number | null {
  if (session.amount_total === null || !session.currency) return null;
  return fromStripeAmount(session.amount_total, session.currency);
}
