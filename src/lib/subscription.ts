/**
 * Subscription plan limits, pricing, and helpers.
 *
 * Tiers:
 *   • Découverte (free)   — 5 produits, 5% commission, gratuit
 *   • Starter             — 20 produits, 3% commission, 2 000 XOF/mois
 *   • Pro                 — illimité, 0% commission, 5 000 XOF/mois or 30 000 XOF/an
 *
 * All prices are stored in the smallest unit of XOF (zero-decimal — so 1 XOF = 1).
 */

import type {
  BillingInterval,
  BoostType,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  free: {
    maxProducts: 5,
    commissionRate: 0.05,
    label: "Découverte",
  },
  starter: {
    maxProducts: 20,
    commissionRate: 0.03,
    label: "Starter",
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

// ---------------------------------------------------------------------------
// Subscription pricing
// ---------------------------------------------------------------------------

/** Pricing in the smallest unit of XOF (zero-decimal). */
export const PLAN_PRICES = {
  free: { month: 0, year: 0 },
  starter: { month: 2_000, year: 20_000 },
  pro: { month: 5_000, year: 30_000 },
} as const satisfies Record<SubscriptionPlan, Record<BillingInterval, number>>;

export const PLAN_CURRENCY = "XOF" as const;

/**
 * Resolves the Stripe Price ID for a paid plan + interval.
 * Falls back to null when the env var is not configured (the checkout API
 * then synthesises a Stripe Price inline using `price_data`).
 */
export function getStripePriceId(
  plan: Exclude<SubscriptionPlan, "free">,
  interval: BillingInterval,
): string | null {
  const envKey = `STRIPE_${plan.toUpperCase()}_${interval.toUpperCase()}LY_PRICE_ID` as const;
  return process.env[envKey] ?? null;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/** Subscription statuses that grant the paid tier's privileges. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

export function getEffectivePlan(
  subscription:
    | {
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
      }
    | null
    | undefined,
): SubscriptionPlan {
  if (!subscription) return "free";
  if (subscription.plan === "free") return "free";
  if (ACTIVE_STATUSES.includes(subscription.status)) {
    return subscription.plan;
  }
  return "free";
}

export function getPlanLimits(plan: SubscriptionPlan) {
  return PLAN_LIMITS[plan];
}

// ---------------------------------------------------------------------------
// Plan ordering
// ---------------------------------------------------------------------------

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

export function isUpgrade(from: SubscriptionPlan, to: SubscriptionPlan): boolean {
  return PLAN_RANK[to] > PLAN_RANK[from];
}

// ---------------------------------------------------------------------------
// Boost catalogue (one-shot Stripe payments)
// ---------------------------------------------------------------------------

export interface BoostDefinition {
  type: BoostType;
  label: string;
  description: string;
  /** Price in the smallest unit of XOF. */
  amount: number;
  currency: typeof PLAN_CURRENCY;
  /** Duration the boost stays active. Null = permanent unlock. */
  durationHours: number | null;
  /** Hide from the dashboard UI when the feature isn't shipped yet. */
  available: boolean;
}

export const BOOSTS = {
  featured_24h: {
    type: "featured_24h",
    label: "Mise en avant 24h",
    description: "Ta boutique apparaît en tête de l'explore pendant 24 heures.",
    amount: 500,
    currency: PLAN_CURRENCY,
    durationHours: 24,
    available: true,
  },
  custom_domain: {
    type: "custom_domain",
    label: "Domaine personnalisé",
    description: "Connecte ton propre domaine (ex. maboutique.ci).",
    amount: 1_000,
    currency: PLAN_CURRENCY,
    durationHours: null,
    available: false,
  },
  premium_templates: {
    type: "premium_templates",
    label: "Pack templates premium",
    description: "Débloque 5 templates exclusifs pour ta boutique.",
    amount: 10_000,
    currency: PLAN_CURRENCY,
    durationHours: null,
    available: false,
  },
} as const satisfies Record<BoostType, BoostDefinition>;

export function getBoost(type: BoostType): BoostDefinition {
  return BOOSTS[type];
}

// ---------------------------------------------------------------------------
// Legacy exports — kept so we don't break older callers.
// ---------------------------------------------------------------------------

/** @deprecated Use PLAN_PRICES.pro.month instead. */
export const PRO_PLAN_PRICE_XOF = PLAN_PRICES.pro.month;
/** @deprecated Use PLAN_CURRENCY instead. */
export const PRO_PLAN_CURRENCY = PLAN_CURRENCY;
/** @deprecated Use the explicit interval argument on getStripePriceId. */
export const PRO_PLAN_INTERVAL = "month" as const;
