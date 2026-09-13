import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  PLAN_CURRENCY,
  PLAN_LIMITS,
  PLAN_PRICES,
  getStripePriceId,
} from "@/lib/subscription";
import { featureSentence } from "@/lib/plans/catalog";
import type { BillingInterval, SubscriptionPlan } from "@/lib/types/database";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["starter", "pro"]).default("pro"),
  interval: z.enum(["month", "year"]).default("month"),
});

/**
 * POST /api/subscription/checkout
 *
 * Body: { plan: "starter" | "pro", interval: "month" | "year" }
 *
 * Creates (or reuses) a Stripe Customer for the authenticated user and
 * returns a Checkout Session URL for the requested subscription tier.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Body is optional — keep the legacy zero-body call working (defaults to pro+month).
  let parsed: { plan: SubscriptionPlan & ("starter" | "pro"); interval: BillingInterval };
  try {
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    parsed = bodySchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Paramètres invalides." },
      { status: 400 },
    );
  }

  const subscription = await prisma.creatorSubscription.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true, status: true, plan: true },
  });

  // Block re-subscribing to the exact same active plan.
  if (
    subscription?.plan === parsed.plan &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    return NextResponse.json(
      { error: `Tu es déjà abonné au plan ${parsed.plan === "pro" ? "Pro" : "Starter"}.` },
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
  let customerId = subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    // La ligne est créée si elle n'existe pas encore (plan gratuit par
    // défaut) : le webhook retrouve l'utilisateur par ce customer id quand
    // les métadonnées Stripe manquent.
    await prisma.creatorSubscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const priceId = getStripePriceId(parsed.plan, parsed.interval);

  // Ce que Stripe affiche sur sa page de paiement : le même catalogue que
  // la page Tarifs, pas une troisième version.
  const planLabel = `Bio-Lien ${PLAN_LIMITS[parsed.plan].label}`;
  const sentence = featureSentence(parsed.plan);
  const planDescription = `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;

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
              currency: PLAN_CURRENCY.toLowerCase(),
              unit_amount: PLAN_PRICES[parsed.plan][parsed.interval],
              recurring: { interval: parsed.interval },
              product_data: {
                name: planLabel,
                description: planDescription,
              },
            },
          },
    ],
    metadata: {
      userId: user.id,
      kind: "subscription",
      plan: parsed.plan,
      interval: parsed.interval,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: parsed.plan,
        interval: parsed.interval,
      },
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
