import "server-only";

import { prisma } from "@/lib/prisma";
import { getEffectivePlan } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types/database";

/**
 * Plan effectif d'un vendeur, tel que la facturation et les privilèges le
 * voient : un abonnement échu (prépayé Mobile Money dépassé, Stripe
 * annulé) redevient Découverte. La conversion Prisma → `getEffectivePlan`
 * vivait recopiée dans chaque route ; une règle d'expiration critique ne se
 * maintient pas à sept endroits.
 */
export async function getEffectivePlanForUser(userId: string): Promise<SubscriptionPlan> {
  const sub = await prisma.creatorSubscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, provider: true, currentPeriodEnd: true },
  });
  return getEffectivePlan(
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
