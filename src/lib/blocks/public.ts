/**
 * Ce que les blocs produits donnent à afficher sur la page publique.
 *
 * La BioPage garde ses deux onglets — Liens / Boutique — parce que c'est ce
 * qui rend une page à la fois lisible en trois secondes et complète. Les blocs
 * ne changent pas cette lecture : ils décident de son *contenu*. Les blocs
 * produits alimentent l'onglet Boutique, tous les autres l'onglet Liens.
 */

import type { ResolvedBlock } from "@/lib/blocks/types";

/** Le minimum qu'un produit doit exposer pour être sélectionné par un bloc. */
export interface SelectableProduct {
  id: string;
  category_id: string | null;
}

const PRODUCT_BLOCK_TYPES = new Set(["PRODUCT", "PRODUCT_COLLECTION"]);

export function isProductBlock(block: ResolvedBlock): boolean {
  return PRODUCT_BLOCK_TYPES.has(block.type);
}

/**
 * Résout la vitrine à partir des blocs produits de la page.
 *
 * Un bloc PRODUCT désigne un article précis, une PRODUCT_COLLECTION une
 * sélection (catégorie, liste explicite, ou tout le catalogue) plafonnée par
 * `limit`. Plusieurs blocs peuvent coexister : on parcourt dans l'ordre de la
 * page et on dédoublonne, pour qu'un produit mis en avant en haut ne réapparaisse
 * pas plus bas.
 *
 * `products` est le catalogue publié, déjà trié par la requête serveur — cet
 * ordre est conservé à l'intérieur de chaque collection.
 */
export function selectProductsForBlocks<T extends SelectableProduct>(
  blocks: ResolvedBlock[],
  products: T[],
): T[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const selected: T[] = [];

  const take = (product: T | undefined) => {
    if (!product || seen.has(product.id)) return;
    seen.add(product.id);
    selected.push(product);
  };

  for (const block of blocks) {
    if (block.type === "PRODUCT") {
      const { productId } = block.config as { productId: string };
      take(byId.get(productId));
      continue;
    }

    if (block.type !== "PRODUCT_COLLECTION") continue;

    const config = block.config as {
      categoryId?: string | null;
      productIds?: string[];
      limit?: number;
    };

    // Une liste explicite fait autorité : le vendeur a choisi ces produits-là,
    // dans cet ordre.
    const pool =
      config.productIds && config.productIds.length > 0
        ? config.productIds.flatMap((id) => {
            const product = byId.get(id);
            return product ? [product] : [];
          })
        : products.filter(
            (p) => !config.categoryId || p.category_id === config.categoryId,
          );

    pool.slice(0, config.limit ?? 12).forEach(take);
  }

  return selected;
}
