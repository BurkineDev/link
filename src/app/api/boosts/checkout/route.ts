import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { BOOSTS, PLAN_CURRENCY } from "@/lib/subscription";
import type { BoostType } from "@/lib/types/database";

export const runtime = "nodejs";

const bodySchema = z.object({
  shopId: z.string().uuid(),
  type: z.enum(["featured_24h", "custom_domain", "premium_templates"]),
});

/**
 * POST /api/boosts/checkout
 *
 * Body: { shopId: uuid, type: BoostType }
 *
 * Creates a Stripe Checkout Session (mode=payment) for the requested
 * boost and a corresponding pending row in boost_purchases. The Stripe
 * webhook flips the row to 'paid' and applies the boost effects.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let parsed: { shopId: string; type: BoostType };
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Paramètres invalides." },
      { status: 400 },
    );
  }

  const boost = BOOSTS[parsed.type];
  if (!boost.available) {
    return NextResponse.json(
      { error: "Ce boost n'est pas encore disponible." },
      { status: 400 },
    );
  }

  // Verify the shop belongs to the caller.
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, owner_id, name")
    .eq("id", parsed.shopId)
    .maybeSingle();

  if (shopError || !shop || shop.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Boutique introuvable." },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[boosts/checkout] Stripe not configured:", err);
    return NextResponse.json(
      { error: "Le service de paiement n'est pas configuré." },
      { status: 500 },
    );
  }

  const admin = getAdminClient();

  // Create the pending boost row first so the webhook can find it by id.
  const { data: boostRow, error: insertError } = await admin
    .from("boost_purchases")
    .insert({
      shop_id: shop.id,
      user_id: user.id,
      type: boost.type,
      amount: boost.amount,
      currency: boost.currency,
      status: "pending",
      stripe_session_id: null,
      stripe_payment_intent_id: null,
      activated_at: null,
      expires_at: null,
      metadata: null,
    })
    .select("id")
    .single();

  if (insertError || !boostRow) {
    console.error("[boosts/checkout] insert error:", insertError);
    return NextResponse.json(
      { error: "Impossible de préparer le boost." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    customer_email: user.email ?? undefined,
    success_url: `${appUrl}/dashboard?boost=1`,
    cancel_url: `${appUrl}/dashboard?boost=cancelled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PLAN_CURRENCY.toLowerCase(),
          unit_amount: boost.amount,
          product_data: {
            name: boost.label,
            description: boost.description,
          },
        },
      },
    ],
    metadata: {
      userId: user.id,
      shopId: shop.id,
      kind: "boost",
      boostPurchaseId: boostRow.id,
      boostType: boost.type,
    },
    payment_intent_data: {
      metadata: {
        userId: user.id,
        shopId: shop.id,
        kind: "boost",
        boostPurchaseId: boostRow.id,
        boostType: boost.type,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Impossible d'initialiser le paiement." },
      { status: 502 },
    );
  }

  await admin
    .from("boost_purchases")
    .update({ stripe_session_id: session.id })
    .eq("id", boostRow.id);

  return NextResponse.json({ url: session.url, boostId: boostRow.id });
}
