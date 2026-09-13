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

export const shippingZoneSchema = z
  .object({
    name: z.string().trim().min(2, "Donne un nom à la zone").max(100),
    countries: z
      .array(z.string().trim().toUpperCase().refine((code) => COUNTRY_CODES.has(code), "Pays inconnu"))
      .min(1, "Choisis au moins un pays")
      .max(60)
      .transform((codes) => [...new Set(codes)]),
    rate: z.number().min(0, "Le tarif ne peut pas être négatif").max(10_000_000),
    free_above: z.number().min(0).max(100_000_000).nullable().optional().default(null),
    estimated_min: z.number().int().min(0).max(90).nullable().optional().default(null),
    estimated_max: z.number().int().min(0).max(90).nullable().optional().default(null),
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

/** « 2 à 4 jours », « dès le lendemain », « le jour même »… ou null. */
export function deliveryDelayLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  if (lo === 0 && hi === 0) return "le jour même";
  if (lo === hi) return `${lo} jour${lo > 1 ? "s" : ""}`;
  return `${lo} à ${hi} jours`;
}
