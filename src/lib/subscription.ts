/**
 * Subscription plan limits and helpers.
 *
 * The Free plan caps product count and applies a platform commission.
 * The Pro plan is unlimited and commission-free.
 */

import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/types/database";

export const PLAN_LIMITS = {
  free: {
    maxProducts: 5,
    /** Platform commission as a fraction of the sale (5%). */
    commissionRate: 0.05,
    label: "Gratuit",
  },
  pro: {
    maxProducts: Infinity,
    commissionRate: 0,
    label: "Pro",
  },
} as const satisfies Record<
  SubscriptionPlan,
  { maxProducts: number; commissionRate: number; label: string }
>;

/** Pro plan price, in the smallest unit of XOF (which is zero-decimal, so just FCFA). */
export const PRO_PLAN_PRICE_XOF = 5000;
export const PRO_PLAN_CURRENCY = "XOF" as const;
export const PRO_PLAN_INTERVAL = "month" as const;

/** A subscription that grants Pro-tier privileges right now. */
const PRO_GRANTING_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

export function getEffectivePlan(subscription: {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
} | null | undefined): SubscriptionPlan {
  if (!subscription) return "free";
  if (subscription.plan === "pro" && PRO_GRANTING_STATUSES.includes(subscription.status)) {
    return "pro";
  }
  return "free";
}

export function getPlanLimits(plan: SubscriptionPlan) {
  return PLAN_LIMITS[plan];
}
