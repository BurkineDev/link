/**
 * Couverture Mobile Money de Genius Pay, pays par pays.
 *
 * Genius Pay accepte de créer un paiement Mobile Money pour n'importe quel
 * numéro. Si le pays n'est pas couvert, la transaction part quand même en
 * « processing » — et le push USSD n'arrive jamais. L'acheteur attend devant
 * son téléphone un message qui ne viendra pas, et la commande reste en
 * attente jusqu'à ce que la réconciliation la ferme.
 *
 * C'est arrivé au premier acheteur burkinabè. Rien, ni chez nous ni chez
 * Genius Pay, ne l'avait prévenu.
 *
 * Source : la table « Pays et opérateurs disponibles » de
 * https://geniuspay.ci/docs/api — « Seuls les pays listés ci-dessous sont
 * actuellement disponibles ». Genius Pay expose aussi cette liste en direct
 * (`GET /api/v1/merchant/pawapay/providers`) : le jour où elle bouge souvent,
 * c'est de là qu'il faudra la lire plutôt que d'ici.
 */

/** Codes ISO2 où le Mobile Money aboutit réellement. */
export const MOBILE_MONEY_COUNTRIES = new Set([
  "BJ", // Bénin — MTN, Moov
  "CM", // Cameroun — MTN, Orange
  "CI", // Côte d'Ivoire — Wave, MTN, Orange
  "CD", // RD Congo — Airtel, Orange, Vodacom
  "GA", // Gabon — Airtel
  "KE", // Kenya — M-Pesa
  "CG", // République du Congo — Airtel, MTN
  "RW", // Rwanda — Airtel, MTN
  "SN", // Sénégal — Free, Orange
  "SL", // Sierra Leone — Orange
  "UG", // Ouganda — Airtel, MTN
  "ZM", // Zambie — MTN, Zamtel
]);

/**
 * Un pays inconnu n'est pas déclaré non couvert : sans information, on laisse
 * l'acheteur essayer plutôt que de lui fermer une porte qui marchait peut-être.
 * Seul un pays explicitement renseigné et absent de la liste déclenche
 * l'avertissement.
 */
export function isMobileMoneyCovered(country: string | null | undefined): boolean {
  if (!country) return true;
  return MOBILE_MONEY_COUNTRIES.has(country.toUpperCase());
}
