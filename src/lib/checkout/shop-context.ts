import "server-only";

import { prisma } from "@/lib/prisma";
import type { Currency } from "@/lib/constants";
import type { ShippingZoneQuote } from "@/lib/checkout/shipping";

/**
 * Ce que la page de commande sait de la boutique avant le premier rendu :
 * son identité (l'acheteur venu de TikTok doit reconnaître chez qui il
 * paie), sa couleur, et ses règles de livraison — les mêmes que celles que
 * l'API appliquera au moment de facturer.
 *
 * Public par nature (tout est déjà visible sur la page boutique) ; rien de
 * plus n'est exposé.
 */
export interface CheckoutShop {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  theme_color: string;
  currency: Currency;
  shipping_enabled: boolean;
  /** Zones actives dans la devise de la boutique, ordre de création. */
  shipping_zones: ShippingZoneQuote[];
}

/** Comment la page a obtenu (ou non) sa boutique. */
export type CheckoutShopStatus = "ok" | "not_found" | "error" | "missing";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * `ref` est l'identifiant de la boutique (stable, posé par le panier) ou son
 * slug (lisible, posé par un lien) : un slug renommé entre l'ajout au
 * panier et le paiement ne doit pas priver la page de ses règles de
 * livraison.
 */
export async function loadCheckoutShop(ref: string): Promise<CheckoutShop | null> {
  const normalized = ref.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,50}$/.test(normalized)) return null;

  const shop = await prisma.shop.findFirst({
    where: UUID.test(normalized)
      ? { id: normalized, isPublished: true }
      : { slug: normalized, isPublished: true },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      themeColor: true,
      currency: true,
      shippingEnabled: true,
      shippingZones: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { countries: true, rate: true, freeAbove: true, currency: true },
      },
    },
  });
  if (!shop) return null;

  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    logo_url: shop.logoUrl,
    theme_color: shop.themeColor,
    currency: shop.currency as Currency,
    shipping_enabled: shop.shippingEnabled,
    shipping_zones: shop.shippingZones
      .filter((zone) => zone.currency === shop.currency)
      .map((zone) => ({
        countries: zone.countries,
        rate: Number(zone.rate),
        free_above: zone.freeAbove === null ? null : Number(zone.freeAbove),
      })),
  };
}
