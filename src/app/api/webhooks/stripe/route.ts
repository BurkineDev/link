import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromStripeAmount, getStripe } from "@/lib/stripe";
import { notifySellerOfPaidOrder } from "@/lib/order-notifications";
import type {
  OrderItem,
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

  const supabase = getAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status, items")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("[stripe-webhook] DB read error:", orderError);
    throw orderError;
  }

  if (!order) {
    console.warn("[stripe-webhook] order not found for session:", session.id);
    return;
  }

  if (order.payment_status === "paid" || order.payment_status === "failed") {
    // Already processed — idempotent no-op.
    return;
  }

  if (eventType === "checkout.session.completed") {
    const paidAmount = fromStripeAmount(session.amount_total, order.currency);
    const amountOk = paidAmount !== null && paidAmount >= order.total_amount;
    const currencyOk =
      session.currency?.toUpperCase() === order.currency.toUpperCase();

    if (session.payment_status !== "paid" || !amountOk || !currencyOk) {
      console.warn(
        "[stripe-webhook] unpaid or mismatched session for order:",
        order.id,
      );
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_ref: session.id,
      })
      .eq("id", order.id);

    if (error) {
      console.error("[stripe-webhook] DB update error:", error);
      throw error;
    }

    // Best-effort seller notification — never blocks order confirmation.
    notifySellerOfPaidOrder(order.id).catch((err) =>
      console.warn("[stripe-webhook] notify seller failed", err),
    );

    console.info(`[stripe-webhook] order ${order.id} confirmed. session=${session.id}`);
    return;
  }

  // session.expired — release reserved stock back to inventory.
  const items = order.items as OrderItem[];
  if (items?.length) {
    const payload = items.map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      quantity: it.quantity,
    }));
    const { error: releaseError } = await supabase.rpc("release_stock", {
      items: payload,
    });
    if (releaseError) {
      console.error("[stripe-webhook] release_stock error:", releaseError);
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      status: "cancelled",
      payment_ref: session.id,
    })
    .eq("id", order.id);

  if (error) {
    console.error("[stripe-webhook] DB update error:", error);
    throw error;
  }

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
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("creator_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (data?.user_id) {
    await upsertSubscriptionFromStripe(data.user_id, sub);
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

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("creator_subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);

  if (error) {
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

  const plan: "free" | "pro" =
    sub.status === "canceled" || sub.status === "incomplete_expired"
      ? "free"
      : "pro";

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("creator_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status: mapStripeStatus(sub.status),
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        current_period_end: periodEndUnix
          ? new Date(periodEndUnix * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[stripe-webhook] subscription upsert error:", error);
    throw error;
  }
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
