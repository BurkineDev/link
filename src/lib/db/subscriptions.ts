import "server-only";

import { prisma } from "@/lib/prisma";
import { BOOSTS } from "@/lib/subscription";

/**
 * Port des fonctions Postgres `public.apply_subscription_payment` et
 * `public.apply_boost_payment` — les deux crédits Mobile Money.
 *
 * Genius Pay livre régulièrement deux fois le même événement. Chaque fonction
 * verrouille la ligne de paiement et vérifie son statut avant d'écrire, pour
 * qu'une seconde livraison retombe sur `already_applied` sans rien créditer
 * de plus. Le verrou passe par du SQL brut dans la transaction, Prisma
 * n'exposant pas `FOR UPDATE`.
 */

export type ApplySubscriptionResult =
  | { applied: false; reason: "unknown_reference" | "already_applied" }
  | {
      applied: true;
      plan: "free" | "starter" | "pro";
      months: number;
      period_end: Date;
    };

export async function applySubscriptionPayment(
  reference: string,
): Promise<ApplySubscriptionResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.subscription_payments
       where reference = ${reference} for update
    `;
    if (locked.length === 0) {
      return { applied: false, reason: "unknown_reference" } as const;
    }

    const payment = await tx.subscriptionPayment.findUniqueOrThrow({
      where: { id: locked[0].id },
    });
    if (payment.status === "paid") {
      return { applied: false, reason: "already_applied" } as const;
    }

    const current = await tx.creatorSubscription.findUnique({
      where: { userId: payment.userId },
      select: { provider: true, plan: true, currentPeriodEnd: true },
    });

    // Une période achetée alors que la précédente court encore s'enchaîne à
    // sa suite : les jours restants ont été payés, on ne les écrase pas.
    const now = new Date();
    const start =
      current &&
      current.provider === "geniuspay" &&
      current.plan === payment.plan &&
      current.currentPeriodEnd !== null &&
      current.currentPeriodEnd > now
        ? current.currentPeriodEnd
        : now;
    const end = addMonths(start, payment.months);

    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "paid", periodStart: start, periodEnd: end },
    });

    const values = {
      plan: payment.plan,
      status: "active" as const,
      provider: "geniuspay" as const,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    };
    await tx.creatorSubscription.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, ...values },
      update: values,
    });

    return {
      applied: true,
      plan: payment.plan,
      months: payment.months,
      period_end: end,
    } as const;
  });
}

export type ApplyBoostResult =
  | { applied: false; reason: "unknown_reference" | "already_applied" }
  | { applied: true; type: string; expires_at?: Date };

export async function applyBoostPayment(
  reference: string,
): Promise<ApplyBoostResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.boost_purchases
       where reference = ${reference} for update
    `;
    if (locked.length === 0) {
      return { applied: false, reason: "unknown_reference" } as const;
    }

    const boost = await tx.boostPurchase.findUniqueOrThrow({
      where: { id: locked[0].id },
      select: { id: true, type: true, status: true, shopId: true },
    });
    if (boost.status === "paid") {
      return { applied: false, reason: "already_applied" } as const;
    }

    const now = new Date();
    const durationHours = boostDurationHours(boost.type);

    // Les boosts sans échéance débloquent une fonctionnalité, pas une durée.
    if (durationHours === null) {
      await tx.boostPurchase.update({
        where: { id: boost.id },
        data: { status: "paid", activatedAt: now, expiresAt: null },
      });
      return { applied: true, type: boost.type } as const;
    }

    // Un boost encore actif se prolonge : les heures restantes sont payées.
    const shop = await tx.shop.findUnique({
      where: { id: boost.shopId },
      select: { featuredUntil: true },
    });
    const start =
      shop?.featuredUntil && shop.featuredUntil > now ? shop.featuredUntil : now;
    const expiresAt = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    await tx.boostPurchase.update({
      where: { id: boost.id },
      data: { status: "paid", activatedAt: now, expiresAt },
    });
    await tx.shop.update({
      where: { id: boost.shopId },
      data: { featuredUntil: expiresAt },
    });

    return { applied: true, type: boost.type, expires_at: expiresAt } as const;
  });
}

/**
 * La durée d'un boost vit dans `BOOSTS` (code), pas en base. La fonction SQL
 * ne connaissait que `featured_24h` → 24 h ; lire `BOOSTS` donne le même
 * résultat aujourd'hui et suivra les boosts ajoutés demain.
 */
function boostDurationHours(type: string): number | null {
  const known = (BOOSTS as Record<string, { durationHours: number | null }>)[type];
  return known?.durationHours ?? null;
}

/** `make_interval(months => n)` : arithmétique calendaire, pas 30 jours. */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
