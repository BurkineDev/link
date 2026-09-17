import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePlan } from "@/lib/subscription";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status — le plan du vendeur connecté, tel que la
 * facturation le voit. La page « Bienvenue » l'interroge toutes les
 * quelques secondes au retour de Stripe ou de Genius Pay : le webhook qui
 * crédite l'abonnement arrive après la redirection, parfois une minute
 * plus tard, et le vendeur ne doit pas croire qu'il a payé pour rien.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sub = await prisma.creatorSubscription.findUnique({
    where: { userId: user.id },
    select: { plan: true, status: true, provider: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });
  const current_period_end = sub?.currentPeriodEnd?.toISOString() ?? null;
  const effective_plan = getEffectivePlan(
    sub ? { plan: sub.plan, status: sub.status, provider: sub.provider, current_period_end } : null,
  );

  return NextResponse.json(
    {
      effective_plan,
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      provider: sub?.provider ?? null,
      current_period_end,
      cancel_at_period_end: sub?.cancelAtPeriodEnd ?? false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
