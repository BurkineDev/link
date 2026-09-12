/**
 * /{username}/{productSlug} — Product detail page.
 *
 * Server Component: fetches shop + product + variants + related products,
 * then delegates rendering to <ProductPage> (client component).
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeProduct, serializeShop, serializeVariant } from "@/lib/db/serialize";
import type { ProductRow, ProductVariantRow, ShopRow } from "@/lib/types/database";
import { resolveBioTheme } from "@/lib/bio-themes";
import {
  JsonLd,
  breadcrumbJsonLd,
  productJsonLd,
} from "@/lib/seo/json-ld";
import { ProductPage } from "./product-page";

interface Props {
  params: Promise<{ username: string; productSlug: string }>;
}

/** Revalidate every 60 seconds — see /(shop)/[username]/page.tsx for rationale. */
export const revalidate = 60;

/**
 * Génération statique à la demande.
 *
 * Sans `generateStaticParams`, cette version de Next rend la route
 * dynamiquement malgré `revalidate` : chaque visite depuis TikTok coûtait
 * une fonction à Francfort et sept requêtes en base, avec un démarrage à
 * froid jusqu'à 2,4 s avant le premier octet. Un tableau vide suffit : la
 * page est rendue à la première visite, puis servie depuis le cache et
 * régénérée en arrière-plan (`revalidate`) ou dès qu'un vendeur modifie sa
 * boutique (`revalidateShop`).
 */
export async function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, productSlug } = await params;
  const shop = await prisma.shop.findFirst({
    where: { slug: username, isPublished: true },
    select: { id: true, name: true, themeColor: true },
  });

  // Une boutique dépubliée ne doit pas laisser une page vide dans l'index.
  if (!shop) return { title: "Produit introuvable", robots: { index: false } };

  const productRow = await prisma.product.findFirst({
    where: { shopId: shop.id, slug: productSlug, isPublished: true },
    select: { name: true, description: true, images: true, price: true, currency: true },
  });

  if (!productRow) return { title: "Produit introuvable", robots: { index: false } };

  // Le reste lit la forme Supabase.
  const product = {
    ...productRow,
    price: Number(productRow.price),
    images: productRow.images as ProductRow["images"] | null,
  };

  const primaryImage = product.images?.[0];

  return {
    title: `${product.name} — ${shop.name}`,
    description:
      product.description ??
      `Découvrez ${product.name} sur la boutique ${shop.name}.`,
    // Sans canonique, la même fiche partagée avec un paramètre de suivi
    // (?ref=tiktok, ?fbclid=…) est indexée plusieurs fois et se fait
    // concurrence à elle-même.
    alternates: { canonical: `/${username}/${productSlug}` },
    openGraph: {
      url: `/${username}/${productSlug}`,
      title: `${product.name} — ${shop.name}`,
      description:
        product.description ??
        `Découvrez ${product.name} sur la boutique ${shop.name}.`,
      ...(primaryImage?.url && {
        images: [
          { url: primaryImage.url, width: 800, height: 800, alt: product.name },
        ],
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Same browser-chrome tint as the bio page, so tapping a product doesn't
 * flash a different colour at the top of the screen.
 */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { username } = await params;
  const row = await prisma.shop.findFirst({
    where: { slug: username, isPublished: true },
    select: { bioTheme: true, themeColor: true, accentColor: true },
  });

  if (!row) return {};
  const data = {
    bio_theme: row.bioTheme,
    theme_color: row.themeColor,
    accent_color: row.accentColor,
  } as Pick<ShopRow, "bio_theme" | "theme_color" | "accent_color">;
  return { themeColor: resolveBioTheme(data).backgroundSolid };
}

export default async function Page({ params }: Props) {
  const { username, productSlug } = await params;
  // Fetch shop
  const shopRow = await prisma.shop.findUnique({ where: { slug: username } });
  if (!shopRow || !shopRow.isPublished) notFound();

  // Fetch product
  const productRow = await prisma.product.findFirst({
    where: { shopId: shopRow.id, slug: productSlug, isPublished: true },
  });
  if (!productRow) notFound();

  // Fetch variants (if product has them) + related products together
  const [variantRows, relatedRows] = await Promise.all([
    productRow.hasVariants
      ? prisma.productVariant.findMany({
          where: { productId: productRow.id },
          orderBy: { id: "asc" },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { shopId: shopRow.id, isPublished: true, id: { not: productRow.id } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  // Les composants d'affichage lisent la forme Supabase (snake_case).
  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const product = serializeProduct(productRow) as unknown as ProductRow;
  const variants = variantRows.map(serializeVariant) as unknown as ProductVariantRow[];
  const related = relatedRows.map(serializeProduct) as unknown as ProductRow[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shopUrl = `${appUrl}/${shop.slug}`;

  const pageUrl = `${shopUrl}/${product.slug}`;

  return (
    <>
      <JsonLd data={productJsonLd({ product, shop, url: pageUrl })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: shop.name, url: shopUrl },
          { name: product.name, url: pageUrl },
        ])}
      />
      <ProductPage
        shop={shop}
        product={product}
        variants={variants}
        related={related}
        pageUrl={pageUrl}
        shopUrl={shopUrl}
      />
    </>
  );
}
