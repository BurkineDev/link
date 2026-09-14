import { z } from "zod";
import { AFRICAN_COUNTRIES } from "@/lib/constants";

/**
 * Zone de livraison telle que le vendeur la déclare : des pays, un tarif,
 * un seuil de gratuité, un délai indicatif. Même schéma côté formulaire et
 * côté API — la page et le serveur refusent les mêmes saisies.
 *
 * Le tarif est dans la devise de la boutique, sans décimale ni conversion :
 * le checkout ne prend en compte que les zones de cette devise.
 */

const COUNTRY_CODES = new Set<string>(AFRICAN_COUNTRIES.map((c) => c.code));

/** Tous les messages en français : la première erreur est montrée telle quelle au vendeur. */
const amount = (label: string) =>
  z
    .number({ error: `${label} : indique un nombre` })
    .min(0, `${label} : pas de montant négatif`)
    .max(100_000_000, `${label} : montant trop élevé`);

const days = (label: string) =>
  z
    .number({ error: `${label} : indique un nombre de jours` })
    .int(`${label} : un nombre de jours entier`)
    .min(0, `${label} : pas de délai négatif`)
    .max(90, `${label} : 90 jours au maximum`);

export const shippingZoneSchema = z
  .object({
    name: z
      .string({ error: "Donne un nom à la zone" })
      .trim()
      .min(2, "Donne un nom à la zone")
      .max(100, "Nom de la zone : 100 caractères au maximum"),
    countries: z
      .array(
        z
          .string({ error: "Pays inconnu" })
          .trim()
          .toUpperCase()
          .refine((code) => COUNTRY_CODES.has(code), "Pays inconnu"),
        { error: "Choisis au moins un pays" },
      )
      .min(1, "Choisis au moins un pays")
      .max(60, "Trop de pays")
      .transform((codes) => [...new Set(codes)]),
    rate: amount("Frais de livraison").max(10_000_000, "Frais de livraison : montant trop élevé"),
    // « Offerte à partir de » : 0 voudrait dire « toujours offerte », ce
    // que personne ne veut dire en tapant 0 — c'est « jamais » (null).
    free_above: amount("Offerte à partir de")
      .nullable()
      .optional()
      .default(null)
      .transform((value) => (value === 0 ? null : value)),
    estimated_min: days("Délai minimum").nullable().optional().default(null),
    estimated_max: days("Délai maximum").nullable().optional().default(null),
    is_active: z.boolean().optional().default(true),
  })
  .superRefine((zone, ctx) => {
    if (
      zone.estimated_min !== null &&
      zone.estimated_max !== null &&
      zone.estimated_max < zone.estimated_min
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimated_max"],
        message: "Le délai maximum doit être supérieur au minimum",
      });
    }
  });

/**
 * Les montants d'une devise sans décimale (FCFA, NGN…) doivent être entiers :
 * un « 1.500 » lu comme 1,5 franc ne doit pas finir en base. Vérifié là où
 * la devise est connue (API et formulaire), le schéma ne la connaissant pas.
 */
export function zoneAmountIssue(
  zone: Pick<ShippingZoneInput, "rate" | "free_above">,
  currencyDecimals: number,
): string | null {
  if (currencyDecimals > 0) return null;
  if (!Number.isInteger(zone.rate)) return "Frais de livraison : un montant entier, sans décimale";
  if (zone.free_above !== null && !Number.isInteger(zone.free_above)) {
    return "Offerte à partir de : un montant entier, sans décimale";
  }
  return null;
}

export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;

/** Forme renvoyée au tableau de bord et à la page de commande. */
export interface ShippingZoneRow {
  id: string;
  shop_id: string;
  name: string;
  countries: string[];
  rate: number;
  free_above: number | null;
  estimated_min: number | null;
  estimated_max: number | null;
  is_active: boolean;
  currency: string;
}

/**
 * Délai tel que l'acheteur le lit sous « Livraison » : ce que le vendeur a
 * promis, ni plus ni moins. Un seul délai renseigné n'est pas une durée
 * ferme : « sous 3 jours » (maximum seul), « à partir de 2 jours »
 * (minimum seul).
 */
export function deliveryDelayLabel(min: number | null, max: number | null): string | null {
  const day = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;
  if (min === null && max === null) return null;
  if (min === null) return max === 0 ? "le jour même" : `sous ${day(max as number)}`;
  if (max === null) return min === 0 ? "dès aujourd'hui" : `à partir de ${day(min)}`;
  if (min === 0 && max === 0) return "le jour même";
  if (min === 0) return `sous ${day(max)}`;
  if (min === max) return day(min);
  return `${min} à ${max} jours`;
}
