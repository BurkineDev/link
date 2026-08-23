import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createPayment, isGeniusPayConfigured } from "@/lib/geniuspay";
import {
  PREPAID_CURRENCY,
  PREPAID_MONTHS,
  getPrepaidPrice,
  type PaidPlan,
  type PrepaidMonths,
} from "@/lib/subscription";
import type { SubscriptionPaymentInsert } from "@/lib/types/database";

export const runtime = "nodejs";

/**
 * POST /api/subscription/geniuspay — acheter une période d'abonnement.
 *
 * Le vendeur paie une durée d'avance en Mobile Money ; rien n'est récurrent.
 * Cette route ne fait que *demander* l'encaissement : elle crée le paiement
 * chez Genius Pay, enregistre la ligne correspondante en `pending`, et renvoie
 * l'URL de paiement. Le plan n'est crédité que par le webhook, une fois
 * l'argent réellement reçu — jamais ici, jamais sur la foi d'un retour de
 * navigateur, que n'importe qui peut rejouer.
 *
 * Le montant vient du barème serveur et jamais du corps de la requête : sinon
 * un abonnement Pro se paierait 1 franc.
 */

const bodySchema = z.object({
  plan: z.enum(["starter", "pro"]),
  months: z
    .number()
    .int()
    .refine(
      (m): m is PrepaidMonths => (PREPAID_MONTHS as readonly number[]).includes(m),
      "Durée non proposée",
    ),
});

export async function POST(request: NextRequest) {
  // L'authentification d'abord : l'état de configuration de nos prestataires
  // ne regarde pas un appelant anonyme.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isGeniusPayConfigured()) {
    return NextResponse.json(
      { error: "Le paiement Mobile Money n'est pas encore configuré." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 422 },
    );
  }

  const plan = parsed.data.plan as PaidPlan;
  const months = parsed.data.months as PrepaidMonths;
  const amount = getPrepaidPrice(plan, months);

  // Le numéro de la boutique sert à pré-remplir le paiement : sur mobile, un
  // champ de moins à saisir change le taux d'abandon.
  const { data: shop } = await supabase
    .from("shops")
    .select("name, whatsapp_number, contact_phone")
    .eq("owner_id", user.id)
    .maybeSingle();

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  let payment;
  try {
    payment = await createPayment({
      amount,
      currency: PREPAID_CURRENCY,
      description: `Bio-Lien ${plan === "pro" ? "Pro" : "Starter"} — ${months} mois`,
      customer: {
        name: shop?.name ?? undefined,
        email: user.email ?? undefined,
        phone: shop?.whatsapp_number ?? shop?.contact_phone ?? undefined,
      },
      success_url: `${appUrl}/dashboard/settings?abonnement=succes`,
      error_url: `${appUrl}/pricing?paiement=echec`,
      // Relu par le webhook pour savoir qu'il s'agit d'un abonnement et non
      // d'une commande acheteur.
      metadata: {
        kind: "subscription",
        userId: user.id,
        plan,
        months,
      },
    });
  } catch (error) {
    console.error("[subscription/geniuspay] createPayment", error);
    return NextResponse.json(
      { error: "Impossible d'initialiser le paiement. Réessaie." },
      { status: 502 },
    );
  }

  // Écrit avec la clé service : `subscription_payments` n'a aucune politique
  // d'écriture, et ne doit pas en avoir — un client capable d'insérer ici
  // s'offrirait un abonnement.
  const admin = getAdminClient();
  const row: SubscriptionPaymentInsert = {
    user_id: user.id,
    plan,
    months,
    amount,
    currency: PREPAID_CURRENCY,
    provider: "geniuspay",
    reference: payment.reference,
    status: "pending",
  };

  const { error: insertError } = await admin
    .from("subscription_payments")
    .insert(row);

  if (insertError) {
    // Le paiement existe chez Genius Pay mais pas chez nous : sans cette
    // ligne, le webhook ne saurait pas quoi créditer. Mieux vaut refuser
    // maintenant que d'encaisser un paiement qu'on ne pourra pas honorer.
    console.error("[subscription/geniuspay] insert", insertError);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le paiement. Réessaie." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: payment.checkout_url ?? payment.payment_url,
    reference: payment.reference,
    amount,
    currency: PREPAID_CURRENCY,
  });
}
