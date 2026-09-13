import { CURRENCY_META, type Currency } from "@/lib/constants";

/**
 * Arrondis d'argent au checkout : UNE règle, à la précision de la devise
 * (0 décimale en XOF/XAF, 2 ailleurs), partagée par la validation du code
 * promo (ce que la page affiche), sa consommation (ce que l'API facture) et
 * le total envoyé au prestataire. Avant, la page arrondissait à l'unité et
 * l'API au centime : 1 995 F × 10 % donnait 200 à l'écran et 199,5 en
 * base — un total à 1 795,5 que Stripe ne pouvait jamais égaler, et une
 * commande payée restée « en attente ».
 *
 * Aucune dépendance serveur.
 */

export function currencyDecimals(currency: string): number {
  return CURRENCY_META[currency as Currency]?.decimals ?? 2;
}

export function roundToCurrency(amount: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(amount * factor) / factor;
}

/** Remise en pourcentage, plafonnée au sous-total. */
export function percentDiscount(subtotal: number, percent: number, currency: string): number {
  return Math.min(subtotal, roundToCurrency((subtotal * percent) / 100, currency));
}
