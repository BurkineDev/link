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

import { iso2FromE164, isValidE164 } from "@/lib/phone/dial-codes";
import { countryLabel } from "@/lib/countries";

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

/**
 * Devises dans lesquelles un paiement Mobile Money peut être confirmé.
 *
 * Genius Pay règle TOUJOURS en XOF : `GET /payments/{ref}` renvoie
 * `currency: "XOF"` et un montant converti, quelle que soit la devise
 * envoyée. Or nos trois chemins de confirmation (webhook, vérification,
 * réconciliation) exigent l'égalité stricte montant + devise avec la
 * commande. Une boutique en XAF ou KES encaissait donc l'acheteur sans que
 * la commande soit jamais confirmée : stock bloqué, vendeur jamais prévenu.
 *
 * Tant que le rapprochement en devise convertie n'est pas implémenté, le
 * Mobile Money n'est proposé qu'aux boutiques en XOF.
 */
export const MOBILE_MONEY_CURRENCIES = new Set(["XOF"]);

export function isMobileMoneyCurrency(currency: string | null | undefined): boolean {
  if (!currency) return false;
  return MOBILE_MONEY_CURRENCIES.has(currency.toUpperCase());
}

/**
 * Le pays du vendeur, tel que Genius Pay le verra : son numéro WhatsApp
 * (ou, à défaut, son téléphone de contact) est celui qui reçoit le push.
 * Renvoie le nom du pays quand il n'est PAS couvert, null sinon — ou si
 * aucun numéro international plausible ne fixe un pays (un texte libre sans
 * indicatif ne doit pas bloquer quelqu'un, cf. isMobileMoneyCovered).
 *
 * Un +1 ne se départage pas entre Canada et États-Unis : on ne tranche pas
 * à la place du vendeur.
 */
export function mobileMoneyBlockedCountryForShop(
  shop: { whatsappNumber: string | null; contactPhone: string | null } | null | undefined,
): string | null {
  const phone = [shop?.whatsappNumber, shop?.contactPhone].find((p) => p && isValidE164(p)) ?? null;
  const iso2 = iso2FromE164(phone);
  if (!iso2 || isMobileMoneyCovered(iso2)) return null;
  if (iso2 === "CA" || iso2 === "US") return "Canada / États-Unis";
  return countryLabel(iso2);
}
