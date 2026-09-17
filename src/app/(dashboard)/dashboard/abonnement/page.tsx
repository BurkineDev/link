import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePlan, PLAN_LIMITS } from "@/lib/subscription";
import { planFeatures, planLabel } from "@/lib/plans/catalog";
import { parseExpectedPlan, parseVia } from "@/lib/plans/welcome";
import { SubscriptionWelcome } from "./subscription-welcome";

export const metadata = {
  title: "Ton abonnement",
};

/**
 * Page de retour après le paiement d'un abonnement (Stripe ou Genius Pay).
 *
 * Avant, Stripe renvoyait sur Profil et Genius Pay sur Réglages, sans un
 * mot : le vendeur qui venait de payer ne voyait rien changer et ne savait
 * pas si ça avait marché. Ici : ce qui vient d'être débloqué, la date de
 * fin, et — tant que le webhook n'est pas passé — une attente honnête au
 * lieu d'un écran muet.
 */
export default async function SubscriptionWelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const expected = parseExpectedPlan(params.plan);
  const via = parseVia(params.via);

  const [sub, shop, payment] = await Promise.all([
    prisma.creatorSubscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, provider: true, currentPeriodEnd: true },
    }),
    prisma.shop.findFirst({
      where: { ownerId: user.id },
      select: { _count: { select: { products: true } } },
    }),
    // La référence Genius Pay du paiement en attente : c'est ce que le
    // vendeur doit nous donner si rien ne s'active.
    via === "mobile-money"
      ? prisma.subscriptionPayment.findFirst({
          where: { userId: user.id, provider: "geniuspay", status: "pending" },
          orderBy: { createdAt: "desc" },
          select: { reference: true },
        })
      : null,
  ]);
  const current_period_end = sub?.currentPeriodEnd?.toISOString() ?? null;
  const effective = getEffectivePlan(
    sub ? { plan: sub.plan, status: sub.status, provider: sub.provider, current_period_end } : null,
  );

  // Arrivé ici sans achat en cours et sans plan payant : rien à attendre.
  if (!expected && effective === "free") redirect("/pricing");

  const plans = {
    starter: { label: planLabel("starter"), features: planFeatures("starter"), maxProducts: PLAN_LIMITS.starter.maxProducts },
    pro: { label: planLabel("pro"), features: planFeatures("pro"), maxProducts: PLAN_LIMITS.pro.maxProducts },
  };

  return (
    <SubscriptionWelcome
      expected={expected}
      via={via}
      initial={{ effective_plan: effective, provider: sub?.provider ?? null, current_period_end }}
      plans={plans}
      productCount={shop?._count.products ?? 0}
      reference={payment?.reference ?? null}
    />
  );
}
