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
  SubscriptionProvider,
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
    // Chaque génération coûte un appel à un modèle facturé. Un vendeur qui ne
    // paie rien ne peut pas décider de cette dépense à notre place.
    aiWriting: false,
  },
  starter: {
    maxProducts: 20,
    commissionRate: 0.03,
    label: "Starter",
    aiWriting: false,
  },
  pro: {
    maxProducts: Infinity,
    commissionRate: 0,
    label: "Pro",
    aiWriting: true,
  },
} as const satisfies Record<
  SubscriptionPlan,
  {
    maxProducts: number;
    commissionRate: number;
    label: string;
    /** Rédaction assistée réservée aux plans payants (voir /api/outils/bio). */
    aiWriting: boolean;
  }
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

// ---------------------------------------------------------------------------
// Périodes payées d'avance (Mobile Money)
// ---------------------------------------------------------------------------
/**
 * Le prélèvement récurrent suppose une carte et un mandat qu'on peut révoquer.
 * En Mobile Money, aucun des deux : le vendeur paie une période, elle court,
 * elle s'arrête. C'est aussi plus honnête — personne ne se fait débiter un
 * mois qu'il n'a pas voulu.
 *
 * Conséquence, à ne jamais perdre de vue : rien d'externe ne vient éteindre un
 * abonnement expiré. C'est `getEffectivePlan` qui doit refuser un privilège
 * dont la période est passée (voir plus bas).
 */

export const PREPAID_CURRENCY = "XOF" as const;

/** Durées achetables, en mois. */
export const PREPAID_MONTHS = [1, 3, 12] as const;

export type PrepaidMonths = (typeof PREPAID_MONTHS)[number];

export type PaidPlan = Exclude<SubscriptionPlan, "free">;

/**
 * Prix en FCFA (XOF est une devise sans décimale : le montant est le montant).
 *
 * ⚠ À confirmer par le métier — ces montants suivent grossièrement la grille
 * CAD existante (4,99 CAD ≈ 2 200 F, 9,99 CAD ≈ 4 400 F) arrondie à des
 * sommes qu'on manipule vraiment en Mobile Money. Les remises longues durées
 * sont là pour encaisser d'avance plutôt que de courir après chaque mois.
 */
export const PREPAID_PRICES: Record<PaidPlan, Record<PrepaidMonths, number>> = {
  starter: { 1: 2_000, 3: 5_000, 12: 18_000 },
  pro: { 1: 4_000, 3: 10_000, 12: 36_000 },
};

export function isPrepaidMonths(value: unknown): value is PrepaidMonths {
  return (
    typeof value === "number" &&
    (PREPAID_MONTHS as readonly number[]).includes(value)
  );
}

export function getPrepaidPrice(plan: PaidPlan, months: PrepaidMonths): number {
  return PREPAID_PRICES[plan][months];
}

/**
 * Économie d'une durée par rapport au même nombre de mois achetés un par un.
 * Renvoie un entier en pourcentage, 0 s'il n'y a pas de remise.
 */
export function prepaidSavingsPercent(
  plan: PaidPlan,
  months: PrepaidMonths,
): number {
  const monthly = PREPAID_PRICES[plan][1] * months;
  const actual = PREPAID_PRICES[plan][months];
  if (monthly <= 0 || actual >= monthly) return 0;
  return Math.round((1 - actual / monthly) * 100);
}

/**
 * Affiche un tarif de plan tel que la page Tarifs l'écrit : « 4,99 $CA ».
 *
 * Les montants sont stockés en cents ; les recopier à la main dans chaque
 * écran, c'est se garantir qu'un jour l'un d'eux annoncera l'ancien prix.
 */
export function formatPlanPrice(
  cents: number,
  currency: string = PLAN_CURRENCY,
): string {
  const amount = cents / 100;
  // Pas de décimales inutiles : « 49 $CA », pas « 49,00 $CA ».
  const digits = Number.isInteger(amount) ? 0 : 2;
  const value = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value} $${currency === "CAD" ? "CA" : currency}`;
}

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

export interface EffectivePlanInput {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** Fin de la période en cours. Décisif pour un abonnement payé d'avance. */
  current_period_end?: string | null;
  /** Qui encaisse. Absent = héritage Stripe. */
  provider?: SubscriptionProvider | null;
}

/**
 * Le plan dont l'utilisateur bénéficie réellement, maintenant.
 *
 * Deux régimes cohabitent, et la différence est la raison d'être de ce code :
 *
 *  • **Stripe** renouvelle tout seul et prévient par webhook. Le statut fait
 *    foi ; on ne regarde pas la date, parce qu'un webhook de renouvellement
 *    en retard de quelques secondes ferait clignoter le plan d'un client à
 *    jour de ses paiements.
 *
 *  • **Payé d'avance** (Mobile Money) : personne ne renouvelle, personne ne
 *    prévient. Si on ne comparait pas `current_period_end` à l'heure qu'il
 *    est, un vendeur achèterait un mois et garderait Pro pour toujours. La
 *    date fait donc foi, et elle seule.
 *
 * `now` est un paramètre pour que les tests soient déterministes.
 */
export function getEffectivePlan(
  subscription: EffectivePlanInput | null | undefined,
  now: Date = new Date(),
): SubscriptionPlan {
  if (!subscription) return "free";
  if (subscription.plan === "free") return "free";
  if (!ACTIVE_STATUSES.includes(subscription.status)) return "free";

  if (subscription.provider === "geniuspay") {
    const end = subscription.current_period_end;
    // Pas de date sur un abonnement prépayé = rien n'a jamais été encaissé.
    if (!end) return "free";
    const endsAt = new Date(end);
    if (Number.isNaN(endsAt.getTime())) return "free";
    if (endsAt.getTime() <= now.getTime()) return "free";
  }

  return subscription.plan;
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
  /** Prix en centimes de CAD, pour le paiement par carte. 199 = 1,99 CAD. */
  amount: number;
  currency: typeof PLAN_CURRENCY;
  /**
   * Prix en FCFA — la voie principale, en Mobile Money. XOF n'a pas de
   * décimale : le montant est le montant, pas des centimes.
   */
  amountXof: number;
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
    amountXof: 1_000,
    durationHours: 24,
    available: true,
  },
  custom_domain: {
    type: "custom_domain",
    label: "Domaine personnalisé",
    description: "Connecte ton propre domaine (ex. maboutique.ci).",
    amount: 299,
    currency: PLAN_CURRENCY,
    amountXof: 5_000,
    durationHours: null,
    available: false,
  },
  premium_templates: {
    type: "premium_templates",
    label: "Pack templates premium",
    description: "Débloque 5 templates exclusifs pour ta boutique.",
    amount: 2_499,
    currency: PLAN_CURRENCY,
    amountXof: 10_000,
    durationHours: null,
    available: false,
  },
} as const satisfies Record<BoostType, BoostDefinition>;

export function getBoost(type: BoostType): BoostDefinition {
  return BOOSTS[type];
}

