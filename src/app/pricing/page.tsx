import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePlan } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types/database";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import { PricingClient } from "./pricing-client";
import { mobileMoneyBlockedCountryForShop } from "@/lib/payments/mobile-money-coverage";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Tarifs",
  // Figée au build. Sans caisse, il n'y a pas de commission à réduire : on
  // vend ce que les plans payants apportent vraiment.
  description: isOnlineCheckoutEnabled()
    ? "Commence gratuitement avec Bio-Lien. Passe en Starter ou Pro pour plus de produits, des commissions réduites et des outils avancés."
    : "Commence gratuitement avec Bio-Lien. Passe en Starter ou Pro pour plus de produits, la rédaction assistée par IA et le badge masquable.",
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  let currentPlan: SubscriptionPlan = "free";
  // Le pays du numéro WhatsApp du vendeur : Genius Pay envoie le push Mobile
  // Money sur ce numéro, et il n'arrive jamais dans un pays non couvert (le
  // fondateur lui-même est resté trois fois devant « En attente de
  // confirmation… » avec son numéro burkinabè). On prévient avant, plutôt
  // que de laisser payer dans le vide.
  let mobileMoneyBlockedCountry: string | null = null;
  if (user) {
    const shop = await prisma.shop.findFirst({
      where: { ownerId: user.id },
      select: { whatsappNumber: true, contactPhone: true },
    });
    mobileMoneyBlockedCountry = mobileMoneyBlockedCountryForShop(shop);
    const sub = await prisma.creatorSubscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, provider: true, currentPeriodEnd: true },
    });
    currentPlan = getEffectivePlan(
      sub
        ? {
            plan: sub.plan,
            status: sub.status,
            provider: sub.provider,
            current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
    );
  }

  return (
    <PricingClient
      isAuthenticated={!!user}
      currentPlan={currentPlan}
      mobileMoneyBlockedCountry={mobileMoneyBlockedCountry}
    />
  );
}
