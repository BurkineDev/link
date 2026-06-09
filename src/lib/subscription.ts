/**
 * Subscription plan limits, pricing, and helpers.
 *
 * Tiers (creator-facing subscriptions, billed via the Canadian Stripe
 * account in CAD):
 *   • Découverte (free)   — 5 produits, 5% commission, gratuit
 *   • Starter             — 20 produits, 3% commission, 4,99 CAD/mois
 *   • Pro                 — illimité, 0% commission, 9,99 CAD/mois or 59 CAD/an
 *
 * All prices are stored in the smallest unit of CAD (cents — CAD is a
 * 2-decimal currency), so 4,99 CAD = 499 cents.
 *
 * Note: this currency is the *creator subscription* currency. Buyer-side
 * product checkouts stay in XOF — Stripe handles the conversion.
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

/** Pricing in the smallest unit of CAD (cents). 499 = 4,99 CAD. */
export const PLAN_PRICES = {
  free: { month: 0, year: 0 },
  starter: { month: 499, year: 4_900 },
  pro: { month: 999, year: 5_900 },
} as const satisfies Record<SubscriptionPlan, Record<BillingInterval, number>>;

export const PLAN_CURRENCY = "CAD" as const;

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
// Boost catalogue (one-shot Stripe payments, billed in CAD)
// ---------------------------------------------------------------------------

export interface BoostDefinition {
  type: BoostType;
  label: string;
  description: string;
  /** Price in the smallest unit of CAD (cents). 199 = 1,99 CAD. */
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
    amount: 199,
    currency: PLAN_CURRENCY,
    durationHours: 24,
    available: true,
  },
  custom_domain: {
    type: "custom_domain",
    label: "Domaine personnalisé",
    description: "Connecte ton propre domaine (ex. maboutique.ci).",
    amount: 299,
    currency: PLAN_CURRENCY,
    durationHours: null,
    available: false,
  },
  premium_templates: {
    type: "premium_templates",
    label: "Pack templates premium",
    description: "Débloque 5 templates exclusifs pour ta boutique.",
    amount: 2_499,
    currency: PLAN_CURRENCY,
    durationHours: null,
    available: false,
  },
} as const satisfies Record<BoostType, BoostDefinition>;

export function getBoost(type: BoostType): BoostDefinition {
  return BOOSTS[type];
}

