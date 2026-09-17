import type { SubscriptionPlan } from "@/lib/types/database";

/** Ce que la page « Bienvenue » attend et ce qu'elle voit. */
export type ExpectedPlan = "starter" | "pro";
export type PaymentVia = "carte" | "mobile-money";

const RANK: Record<SubscriptionPlan, number> = { free: 0, starter: 1, pro: 2 };

/** Le plan attendu est-il servi (ou dépassé) par le plan effectif ? */
export function planArrived(expected: ExpectedPlan, effective: SubscriptionPlan): boolean {
  return RANK[effective] >= RANK[expected];
}

/** `plan` de l'URL de retour : seuls starter et pro sont des achats. */
export function parseExpectedPlan(value: string | string[] | undefined): ExpectedPlan | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "starter" || v === "pro" ? v : null;
}

export function parseVia(value: string | string[] | undefined): PaymentVia {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "carte" ? "carte" : "mobile-money";
}

/**
 * Combien de temps on attend le webhook avant d'arrêter d'interroger :
 * Stripe répond en général en quelques secondes, Genius Pay peut mettre
 * une bonne minute après la confirmation sur le téléphone.
 */
export const WELCOME_POLL_MS = 3_000;
export const WELCOME_TIMEOUT_MS = 120_000;
