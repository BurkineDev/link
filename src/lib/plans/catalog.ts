import {
  PLAN_CURRENCY,
  PLAN_LIMITS,
  PLAN_PRICES,
  PREPAID_PRICES,
  formatPlanPrice,
  prepaidSavingsPercent,
  type PaidPlan,
} from "@/lib/subscription";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import type { BillingInterval, SubscriptionPlan } from "@/lib/types/database";
import { formatPrice } from "@/lib/utils/format";

/**
 * Ce que chaque plan promet — une seule fois.
 *
 * La page d'accueil, la page Tarifs, les conditions d'utilisation et l'offre
 * à l'inscription racontaient chacune leur version : le Pro annuel était
 * affiché « 59 $CA » sur Tarifs alors que Stripe facturait 99 ; Starter
 * promettait la suppression du badge que personne n'avait codée ; Pro
 * vendait des « templates premium » qui n'existent pas. Ici, les chiffres
 * viennent des constantes qui facturent (PLAN_LIMITS, PLAN_PRICES,
 * PREPAID_PRICES) et la liste ne contient que ce que le produit fait.
 *
 * Deux modes, un seul catalogue (voir src/lib/payments/online-checkout.ts).
 * PLAN_FEATURES et PLAN_TAGLINES restent le catalogue complet, celui de la
 * caisse Bio-Lien (mode « En ligne » : Mobile Money, carte, commission).
 * Les fonctions planFeatures(), planTagline() et commissionNote() lisent le
 * drapeau à chaque appel — jamais en constante de module — et, caisse
 * masquée, retirent tout ce qui parle d'argent encaissé par Bio-Lien : la
 * commande arrive sur WhatsApp, aucune commission. Les pages passent par ces
 * fonctions, pas par les constantes.
 *
 * Aucune dépendance serveur : importable depuis une page, un composant
 * client ou un e-mail.
 */

function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

function fcfa(amount: number): string {
  return formatPrice(amount, "XOF");
}

// Les lignes qui n'ont de sens que caisse allumée, nommées pour que le
// catalogue WhatsApp les retire par identité et pas par une regex fragile.
const ONLINE_PAYMENTS = "Paiements Mobile Money et carte bancaire";
const STARTER_COMMISSION = `Commission réduite à ${percent(PLAN_LIMITS.starter.commissionRate)}`;
const PRO_COMMISSION = `${percent(PLAN_LIMITS.pro.commissionRate)} de commission sur les ventes`;
/** Ce qui remplace le paiement en ligne quand la commande part sur WhatsApp. */
const WHATSAPP_ORDERS = "Commandes reçues sur WhatsApp";

/** Ce que le plan comprend, dans l'ordre où on le lit — catalogue complet (mode En ligne). */
export const PLAN_FEATURES: Record<SubscriptionPlan, readonly string[]> = {
  free: [
    `Jusqu'à ${PLAN_LIMITS.free.maxProducts} produits`,
    "Ton lien @pseudo et ta page de liens",
    ONLINE_PAYMENTS,
    "Tous les thèmes",
    "Statistiques de la boutique",
  ],
  starter: [
    `Jusqu'à ${PLAN_LIMITS.starter.maxProducts} produits`,
    STARTER_COMMISSION,
    "Badge Bio-Lien masquable",
    "Support par e-mail",
  ],
  pro: [
    "Produits illimités",
    PRO_COMMISSION,
    "Rédaction assistée par IA",
    "Badge Bio-Lien masquable",
    "Support prioritaire",
  ],
};

/**
 * Le même catalogue, caisse masquée. Dérivé de PLAN_FEATURES pour qu'une
 * ligne ajoutée là-haut apparaisse ici aussi sans qu'on y pense.
 */
const WHATSAPP_PLAN_FEATURES: Record<SubscriptionPlan, readonly string[]> = {
  free: PLAN_FEATURES.free.map((f) => (f === ONLINE_PAYMENTS ? WHATSAPP_ORDERS : f)),
  starter: PLAN_FEATURES.starter.filter((f) => f !== STARTER_COMMISSION),
  pro: PLAN_FEATURES.pro.filter((f) => f !== PRO_COMMISSION),
};

/** Ce que le plan comprend, selon le mode en vigueur. C'est par ici que passent les pages. */
export function planFeatures(plan: SubscriptionPlan): readonly string[] {
  return isOnlineCheckoutEnabled() ? PLAN_FEATURES[plan] : WHATSAPP_PLAN_FEATURES[plan];
}

/** Une phrase par plan, pour les cartes — catalogue complet (mode En ligne). */
export const PLAN_TAGLINES: Record<SubscriptionPlan, string> = {
  free: "Démarre et teste ta boutique",
  starter: "Pour dépasser les premiers articles",
  pro: "Pour vendre régulièrement, sans commission",
};

/** Une phrase par plan, selon le mode : sans caisse, Pro ne vend plus « sans commission » mais « sans limite ». */
export function planTagline(plan: SubscriptionPlan): string {
  if (plan === "pro" && !isOnlineCheckoutEnabled()) {
    return "Pour vendre régulièrement, sans limite";
  }
  return PLAN_TAGLINES[plan];
}

/**
 * Ce que le plan gratuit coûte vraiment : la commission. Caisse masquée,
 * Bio-Lien ne prélève rien : chaîne vide, et l'appelant ne rend pas de
 * paragraphe.
 */
export function commissionNote(plan: SubscriptionPlan): string {
  if (!isOnlineCheckoutEnabled()) return "";
  const rate = PLAN_LIMITS[plan].commissionRate;
  return rate > 0 ? `${percent(rate)} de commission sur chaque vente.` : "Aucune commission.";
}

/** Prix d'un plan payant, tels que Mobile Money et Stripe les facturent. */
export interface PlanPricing {
  /** FCFA, période prépayée. */
  prepaid: { months1: string; months3: string; months12: string; yearlySavingsPercent: number };
  /** $CA, par carte. */
  card: { month: string; year: string };
}

export function planPricing(plan: PaidPlan): PlanPricing {
  return {
    prepaid: {
      months1: fcfa(PREPAID_PRICES[plan][1]),
      months3: fcfa(PREPAID_PRICES[plan][3]),
      months12: fcfa(PREPAID_PRICES[plan][12]),
      yearlySavingsPercent: prepaidSavingsPercent(plan, 12),
    },
    card: {
      month: formatPlanPrice(PLAN_PRICES[plan].month, PLAN_CURRENCY),
      year: formatPlanPrice(PLAN_PRICES[plan].year, PLAN_CURRENCY),
    },
  };
}

/** Libellé du paiement par carte pour une période : « 9,99 $CA » ou « 99 $CA ». */
export function cardPriceLabel(plan: PaidPlan, interval: BillingInterval): string {
  return formatPlanPrice(PLAN_PRICES[plan][interval], PLAN_CURRENCY);
}

/**
 * Résumé d'un plan en une ligne, pour les conditions d'utilisation et les
 * réponses de la FAQ : « Starter (2 000 FCFA / mois, 18 000 FCFA / an ;
 * par carte 4,99 $CA / mois ou 49 $CA / an) ».
 */
export function planPriceSummary(plan: SubscriptionPlan): string {
  if (plan === "free") return "gratuit";
  const p = planPricing(plan);
  return `${p.prepaid.months1} / mois, ${p.prepaid.months3} / 3 mois ou ${p.prepaid.months12} / an ; par carte ${p.card.month} / mois ou ${p.card.year} / an`;
}

export function planLabel(plan: SubscriptionPlan): string {
  return PLAN_LIMITS[plan].label;
}

/** Les fonctionnalités en une phrase (« jusqu'à 20 produits, … »), pour un texte courant. Suit planFeatures, donc le mode. */
export function featureSentence(plan: SubscriptionPlan): string {
  return planFeatures(plan)
    .map((feature) => feature.charAt(0).toLowerCase() + feature.slice(1))
    .join(", ");
}
