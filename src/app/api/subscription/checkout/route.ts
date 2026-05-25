import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  PRO_PLAN_CURRENCY,
  PRO_PLAN_INTERVAL,
  PRO_PLAN_PRICE_XOF,
} from "@/lib/subscription";

export const runtime = "nodejs";

/**
 * POST /api/subscription/checkout
 *
 * Creates (or reuses) a Stripe Customer for the authenticated user and
 * returns a Checkout Session URL for the LinkBoutik Pro subscription.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = getAdminClient();
  const { data: subscription } = await admin
    .from("creator_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    subscription?.plan === "pro" &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    return NextResponse.json(
      { error: "Tu es déjà abonné au plan Pro." },
      { status: 400 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[subscription/checkout] Stripe not configured:", err);
    return NextResponse.json(
      { error: "Le service de paiement n'est pas configuré." },
      { status: 500 },
    );
  }

  // Reuse the customer if one already exists for this user.
  let customerId = subscription?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await admin
      .from("creator_subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const priceId = process.env.STRIPE_PRO_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    locale: "fr",
    success_url: `${appUrl}/dashboard/profile?subscribed=1`,
    cancel_url: `${appUrl}/pricing?cancelled=1`,
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: PRO_PLAN_CURRENCY.toLowerCase(),
              unit_amount: PRO_PLAN_PRICE_XOF,
              recurring: { interval: PRO_PLAN_INTERVAL },
              product_data: {
                name: "LinkBoutik Pro",
                description:
                  "Produits illimités, 0% de commission, analytics avancés et support prioritaire.",
              },
            },
          },
    ],
    metadata: { userId: user.id, kind: "subscription" },
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Impossible d'initialiser le paiement." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
