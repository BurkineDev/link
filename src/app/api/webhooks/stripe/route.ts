import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { cancelUnpaidOrder, settlePaidOrder } from "@/lib/db/orders";
import { fromStripeAmount, getStripe } from "@/lib/stripe";
import { notifyPaidOrder } from "@/lib/order-notifications";
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
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Order checkout handlers
// ---------------------------------------------------------------------------

async function handleOrderCheckoutEvent(
  eventType: "checkout.session.completed" | "checkout.session.expired",
  session: Stripe.Checkout.Session,
) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.warn("[stripe-webhook] missing orderId metadata for session:", session.id);
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalAmount: true, currency: true, paymentStatus: true },
  });

  if (!order) {
    console.warn("[stripe-webhook] order not found for session:", session.id);
    return;
  }

  if (order.paymentStatus === "paid" || order.paymentStatus === "failed") {
    // Already processed — idempotent no-op.
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
      return;
    }

    // Verrou, contrôles d'état et écritures comptables sont dans
    // `settlePaidOrder` : un webhook rejoué retombe sur `already_paid`.
    const settlement = await settlePaidOrder(order.id, session.id, "stripe");

    if (settlement.settled) {
      notifyPaidOrder(order.id).catch((err) =>
        console.warn("[stripe-webhook] order notification failed", err),
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
