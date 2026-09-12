import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Invalide le cache de la page publique d'une boutique et de ses fiches
 * produit, dès qu'un vendeur y change quelque chose.
 *
 * Les pages boutique sont servies depuis le cache (ISR, 60 s). Sans cet
 * appel, un vendeur qui ajoute un produit ou change sa couleur attendrait
 * jusqu'à une minute pour le voir — et croirait que ça n'a pas marché.
 *
 * À appeler après l'écriture, jamais avant : la régénération part de la
 * prochaine visite et lit la base à ce moment-là. Une erreur ici ne doit
 * jamais faire échouer la mutation.
 */
export async function revalidateShop(shopId: string): Promise<void> {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { slug: true },
    });
    if (!shop?.slug) return;
    revalidateShopSlug(shop.slug);
  } catch (error) {
    console.warn("[revalidate-shop] failed for", shopId, error);
  }
}

/** Variante quand le slug est déjà connu (renommage : passer l'ancien ET le nouveau). */
export function revalidateShopSlug(...slugs: string[]): void {
  for (const slug of slugs) {
    if (!slug) continue;
    try {
      revalidatePath(`/${slug}`);
      // Toutes les fiches produit de la boutique, quel que soit leur slug.
      revalidatePath(`/${slug}/[productSlug]`, "page");
    } catch (error) {
      console.warn("[revalidate-shop] failed for slug", slug, error);
    }
  }
}
