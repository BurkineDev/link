/**
 * Données structurées schema.org.
 *
 * Sans elles, Google lit une page produit comme une page quelconque : un
 * titre, un texte. Avec elles, il en connaît le prix, la devise et la
 * disponibilité, et peut afficher ces informations directement dans les
 * résultats. Pour une plateforme de vente, c'est la différence entre un lien
 * nu et une fiche qui donne envie de cliquer.
 *
 * Le projet n'en avait aucune.
 */

import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

/**
 * Le JSON est injecté tel quel dans la page. `<` est échappé parce qu'un nom
 * de produit contenant `</script>` refermerait la balise et transformerait
 * une description de vendeur en script exécuté.
 */
export function JsonLd({ data }: { data: object }): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Constructeurs
// ---------------------------------------------------------------------------

interface ProductInput {
  name: string;
  description?: string | null;
  images?: { url?: string }[] | null;
  price: number;
  currency: string;
  stock_quantity?: number | null;
  is_digital?: boolean;
}

interface ShopInput {
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
}

function imageUrls(images: ProductInput["images"]): string[] {
  return (images ?? [])
    .map((i) => i?.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

/**
 * Fiche produit. L'offre n'est déclarée que si le produit a un prix : chez
 * nous le prix est facultatif et vaut 0 par défaut, et annoncer « 0 FCFA »
 * à Google serait faux — il le sanctionne, et l'acheteur se sentirait trompé.
 */
export function productJsonLd(args: {
  product: ProductInput;
  shop: ShopInput;
  url: string;
}) {
  const { product, shop, url } = args;
  const images = imageUrls(product.images);

  const inStock =
    product.is_digital ||
    product.stock_quantity == null ||
    product.stock_quantity > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description && { description: product.description }),
    ...(images.length && { image: images }),
    brand: { "@type": "Brand", name: shop.name },
    ...(product.price > 0 && {
      offers: {
        "@type": "Offer",
        url,
        price: product.price,
        priceCurrency: product.currency,
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: shop.name },
      },
    }),
  };
}

/** La boutique elle-même, pour que le nom du vendeur devienne une entité. */
export function storeJsonLd(args: { shop: ShopInput; url: string }) {
  const { shop, url } = args;
  const image = shop.logo_url ?? shop.banner_url ?? undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    url,
    ...(shop.description && { description: shop.description }),
    ...(image && { image }),
  };
}

/** Fil d'Ariane : Google l'affiche à la place de l'URL brute. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** L'éditeur du site, déclaré une fois sur l'accueil. */
export function organizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bio-Lien",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description:
      "Bio-Lien permet aux vendeurs d'Afrique de l'Ouest de créer leur boutique en ligne et d'encaisser en Mobile Money ou par carte.",
  };
}

/**
 * Le site.
 *
 * Pas de `SearchAction` : elle promettrait aux moteurs une recherche interne
 * sur `/explore?q=`, or cette page ne lit aucun paramètre de recherche.
 * Déclarer une capacité qu'on n'a pas se retourne contre le site le jour où
 * un moteur essaie l'URL. À rebrancher le jour où la recherche existe.
 */
export function websiteJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bio-Lien",
    url: siteUrl,
    inLanguage: "fr",
  };
}
