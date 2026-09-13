import type { SubscriptionPlan } from "@/lib/types/database";

/**
 * Le badge « Crée ta page sur Bio-Lien » au pied des pages publiques est la
 * contrepartie du plan gratuit — c'est lui qui amène les prochains vendeurs.
 * Les plans payants peuvent le retirer, depuis les réglages d'apparence.
 * Un plan échu redevient gratuit (`getEffectivePlan`) : le badge revient de
 * lui-même, quel que soit le réglage.
 */
export function canHideBadge(plan: SubscriptionPlan): boolean {
  return plan !== "free";
}

export function showBioLienBadge(plan: SubscriptionPlan, shopWantsBadge: boolean): boolean {
  return shopWantsBadge || !canHideBadge(plan);
}
