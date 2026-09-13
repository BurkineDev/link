/**
 * Livraison au checkout : une seule règle, partagée entre la page de
 * commande (ce que l'acheteur voit AVANT de payer) et l'API (ce qui est
 * réellement facturé). Avant, la page ne montrait jamais les frais alors que
 * l'API les ajoutait au montant envoyé à Genius Pay ou Stripe : l'acheteur
 * cliquait « Payer 10 000 F » et voyait 12 000 F sur le push USSD, sans une
 * ligne pour expliquer l'écart.
 *
 * Aucune dépendance serveur : importable depuis un Client Component.
 */

export interface ShippingZoneQuote {
  /** Codes pays ISO 3166-1 alpha-2, dans la casse d'origine. */
  countries: string[];
  rate: number;
  free_above: number | null;
}

export type ShippingQuote =
  /** Rien à livrer (numérique) ou vendeur qui ne facture pas la livraison ici. */
  | { kind: "none" }
  /** Pays pas encore choisi : impossible de chiffrer. */
  | { kind: "unknown" }
  /** Aucune zone ne dessert ce pays : la commande sera refusée. */
  | { kind: "unavailable" }
  | { kind: "free"; amount: 0 }
  | { kind: "paid"; amount: number };

export interface ShippingQuoteInput {
  /** Le panier contient au moins un article physique. */
  physical: boolean;
  /** Le vendeur facture la livraison sur la plateforme (zones actives). */
  shippingEnabled: boolean;
  zones: ShippingZoneQuote[];
  /** Pays de livraison choisi, ou null. */
  country: string | null | undefined;
  subtotal: number;
}

/** Zone desservant `country`, la première déclarée l'emportant. */
export function findShippingZone<Z extends { countries: string[] }>(
  zones: Z[],
  country: string,
): Z | undefined {
  const wanted = country.toUpperCase();
  return zones.find((zone) => zone.countries.some((code) => code.toUpperCase() === wanted));
}

export function quoteShipping(input: ShippingQuoteInput): ShippingQuote {
  if (!input.physical || !input.shippingEnabled) return { kind: "none" };
  if (!input.country) return { kind: "unknown" };
  const zone = findShippingZone(input.zones, input.country);
  if (!zone) return { kind: "unavailable" };
  const free =
    (zone.free_above !== null && input.subtotal >= zone.free_above) || zone.rate <= 0;
  return free ? { kind: "free", amount: 0 } : { kind: "paid", amount: zone.rate };
}

/** Montant facturé pour un devis : 0 tant qu'il n'est pas chiffré. */
export function shippingAmount(quote: ShippingQuote): number {
  return quote.kind === "paid" ? quote.amount : 0;
}

/** Total tel qu'il sera facturé : sous-total − remise + livraison chiffrée. */
export function checkoutTotal(input: {
  subtotal: number;
  discount?: number;
  shipping: ShippingQuote;
}): number {
  return Math.max(0, input.subtotal - (input.discount ?? 0) + shippingAmount(input.shipping));
}

/**
 * Le panier a-t-il quelque chose à livrer ? Un article dont on ignore la
 * nature (panier enregistré avant que le drapeau existe) est réputé
 * physique : mieux vaut demander une adresse de trop que livrer nulle part.
 */
export function cartNeedsShipping(items: ReadonlyArray<{ isDigital?: boolean }>): boolean {
  return items.some((item) => item.isDigital !== true);
}
