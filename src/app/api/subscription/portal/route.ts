import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * POST /api/subscription/portal
 *
 * Opens a Stripe Billing Portal session so the user can update their
 * payment method, view invoices, or cancel their subscription.
 */
export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const subscription = await prisma.creatorSubscription.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Aucun abonnement actif." },
      { status: 400 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[subscription/portal] Stripe not configured:", err);
    return NextResponse.json(
      { error: "Le service de paiement n'est pas configuré." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/dashboard/profile`,
  });

  return NextResponse.json({ url: session.url });
}
