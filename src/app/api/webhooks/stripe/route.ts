import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromStripeAmount, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// Configure in Stripe dashboard:
//   https://<your-domain>/api/webhooks/stripe
// Events:
//   checkout.session.completed
//   checkout.session.expired
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
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn(
      "[stripe-webhook] invalid signature:",
      err instanceof Error ? err.message : err,
    );
    return new NextResponse(null, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.expired"
  ) {
    return new NextResponse(null, { status: 200 });
  }

  const session = event.data.object;
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    console.warn("[stripe-webhook] missing orderId metadata for session:", session.id);
    return new NextResponse(null, { status: 200 });
  }

  const supabase = getAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("[stripe-webhook] DB read error:", orderError);
    return new NextResponse(null, { status: 500 });
  }

  if (!order) {
    console.warn("[stripe-webhook] order not found for session:", session.id);
    return new NextResponse(null, { status: 200 });
  }

  if (order.payment_status === "paid") {
    return new NextResponse(null, { status: 200 });
  }

  if (event.type === "checkout.session.completed") {
    const paidAmount = fromStripeAmount(session.amount_total, order.currency);
    const amountOk = paidAmount !== null && paidAmount >= order.total_amount;
    const currencyOk =
      session.currency?.toUpperCase() === order.currency.toUpperCase();

    if (session.payment_status !== "paid" || !amountOk || !currencyOk) {
      console.warn("[stripe-webhook] unpaid or mismatched session for order:", order.id);
      return new NextResponse(null, { status: 200 });
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
      return new NextResponse(null, { status: 500 });
    }

    console.info(`[stripe-webhook] order ${order.id} confirmed. session=${session.id}`);
  } else if (event.type === "checkout.session.expired") {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "failed", payment_ref: session.id })
      .eq("id", order.id);

    if (error) {
      console.error("[stripe-webhook] DB update error:", error);
      return new NextResponse(null, { status: 500 });
    }

    console.info(`[stripe-webhook] order ${order.id} session expired. session=${session.id}`);
  }

  return new NextResponse(null, { status: 200 });
}
