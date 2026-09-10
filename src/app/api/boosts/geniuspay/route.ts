import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPayment, isGeniusPayConfigured } from "@/lib/geniuspay";
import { BOOSTS, PREPAID_CURRENCY } from "@/lib/subscription";
import type { BoostType } from "@/lib/types/database";

export const runtime = "nodejs";

/**
 * POST /api/boosts/geniuspay — acheter un boost en Mobile Money.
 *
 * Jumeau de la route d'abonnement : elle demande l'encaissement, enregistre
 * l'achat en `pending`, et rend la main. Le boost n'est activé que par le
 * webhook, une fois l'argent reçu — jamais ici.
 *
 * Le montant vient du catalogue serveur, jamais du corps de la requête.
 */

const bodySchema = z.object({
  shopId: z.string().uuid(),
  type: z.enum(["featured_24h", "custom_domain", "premium_templates"]),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isGeniusPayConfigured()) {
    return NextResponse.json(
      { error: "Le paiement Mobile Money n'est pas encore configuré." },
      { status: 503 },
    );
  }

  let parsed: { shopId: string; type: BoostType };
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const boost = BOOSTS[parsed.type];
  if (!boost.available) {
    return NextResponse.json(
      { error: "Ce boost n'est pas encore disponible." },
      { status: 400 },
    );
  }

  // La boutique doit appartenir à l'appelant : sans ce contrôle, on pourrait
  // mettre en avant la boutique d'un autre — ou la lui faire payer.
  const shop = await prisma.shop.findFirst({
    where: { id: parsed.shopId, ownerId: user.id },
    select: { id: true, name: true, whatsappNumber: true, contactPhone: true },
  });

  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  let payment;
  try {
    payment = await createPayment({
      amount: boost.amountXof,
      currency: PREPAID_CURRENCY,
      description: `Bio-Lien — ${boost.label}`,
      customer: {
        name: shop.name,
        email: user.email ?? undefined,
        phone: shop.whatsappNumber ?? shop.contactPhone ?? undefined,
      },
      success_url: `${appUrl}/dashboard?boost=1`,
      error_url: `${appUrl}/dashboard?boost=echec`,
      metadata: {
        kind: "boost",
        userId: user.id,
        shopId: shop.id,
        boostType: boost.type,
      },
    });
  } catch (error) {
    console.error("[boosts/geniuspay] createPayment", error);
    return NextResponse.json(
      { error: "Impossible d'initialiser le paiement. Réessaie." },
      { status: 502 },
    );
  }

  try {
    await prisma.boostPurchase.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        type: boost.type,
        amount: boost.amountXof,
        currency: PREPAID_CURRENCY,
        status: "pending",
        provider: "geniuspay",
        reference: payment.reference,
      },
    });
  } catch (insertError) {
    // Sans cette ligne, le webhook ne saurait pas quel boost activer : mieux
    // vaut refuser que d'encaisser sans pouvoir honorer.
    console.error("[boosts/geniuspay] insert", insertError);
    return NextResponse.json(
      { error: "Impossible de préparer le boost. Réessaie." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: payment.checkout_url ?? payment.payment_url,
    reference: payment.reference,
    amount: boost.amountXof,
    currency: PREPAID_CURRENCY,
  });
}
