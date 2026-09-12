/**
 * /{username} — Public shop homepage.
 *
 * Server Component: fetches shop + products + categories via Prisma,
 * sets metadata, then delegates rendering to <ShopPage> (client component).
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  serializeCategory,
  serializePageBlock,
  serializeProduct,
  serializeShop,
  serializeShopLink,
} from "@/lib/db/serialize";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";
import { resolveBioTheme } from "@/lib/bio-themes";
import { JsonLd, storeJsonLd } from "@/lib/seo/json-ld";
import { resolveBioPageBlocks, type LegacyLink } from "@/lib/blocks/resolve";
import type { PageBlockRow } from "@/lib/types/database";
import { ShopPage } from "./shop-page";

interface Props {
  params: Promise<{ username: string }>;
}

/**
 * Revalidate shop pages every 60 seconds. Cuts database load by 60x for
 * popular shops while keeping the catalog reasonably fresh. The dashboard
 * still shows real-time data because it uses authenticated queries that
 * bypass this cache.
 */
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
  const { username } = await params;

  const shop = await prisma.shop.findFirst({
    where: { slug: username, isPublished: true },
    select: { name: true, description: true, bannerUrl: true, themeColor: true },
  });

  // Une boutique dépubliée ou renommée ne doit pas laisser une page vide
  // dans l'index des moteurs.
  if (!shop) {
    return { title: "Boutique introuvable", robots: { index: false } };
  }

  return {
    title: `${shop.name}`,
    description: shop.description ?? `Découvrez la boutique ${shop.name} sur Bio-Lien.`,
    // Un lien de bio se partage avec toutes sortes de paramètres de suivi.
    // La canonique dit aux moteurs qu'il n'y a qu'une seule boutique derrière.
    alternates: { canonical: `/${username}` },
    openGraph: {
      url: `/${username}`,
      title: shop.name,
      description: shop.description ?? `Découvrez la boutique ${shop.name} sur Bio-Lien.`,
      ...(shop.bannerUrl && {
        images: [{ url: shop.bannerUrl, width: 1200, height: 630, alt: shop.name }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: shop.name,
      ...(shop.bannerUrl && { images: [shop.bannerUrl] }),
    },
  };
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

/**
 * Paints the mobile browser chrome in the seller's own theme, so opening the
 * page from a TikTok bio feels like entering their space, not a tab.
 */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { username } = await params;

  const shop = await prisma.shop.findFirst({
    where: { slug: username, isPublished: true },
    select: { bioTheme: true, themeColor: true, accentColor: true },
  });

  if (!shop) return {};
  return {
    themeColor: resolveBioTheme({
      bio_theme: shop.bioTheme,
      theme_color: shop.themeColor,
      accent_color: shop.accentColor,
    } as Pick<ShopRow, "bio_theme" | "theme_color" | "accent_color">).backgroundSolid,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Page({ params }: Props) {
  const { username } = await params;

  const shopRow = await prisma.shop.findUnique({ where: { slug: username } });

  if (!shopRow || !shopRow.isPublished) {
    notFound();
  }

  const [productRows, categoryRows, linkRows, blockRows] = await Promise.all([
    prisma.product.findMany({
      where: { shopId: shopRow.id, isPublished: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
    prisma.shopLink.findMany({
      where: { shopId: shopRow.id, isActive: true },
      orderBy: { position: "asc" },
    }),
    prisma.pageBlock.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
  ]);

  // Les composants d'affichage attendent encore la forme Supabase
  // (snake_case) ; les sérialiseurs la reproduisent à l'identique.
  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const products = productRows.map(serializeProduct) as unknown as ProductRow[];
  const categories = categoryRows.map(serializeCategory) as CategoryRow[];
  const links = linkRows.map(serializeShopLink) as LegacyLink[];
  const rows = blockRows.map(serializePageBlock) as unknown as PageBlockRow[];

  // La composition est résolue ici, côté serveur : la page publique ne connaît
  // que des blocs. Une boutique qui n'en a pas encore en reçoit une synthèse
  // fidèle de ses liens et de sa grille produits — rien ne change pour elle
  // tant qu'elle n'a pas ouvert le Page Builder.
  const { blocks } = resolveBioPageBlocks({
    rows: rows.map((row) => ({
      id: row.id,
      type: row.type,
      position: row.position,
      title: row.title,
      config: row.config,
      style: row.style,
      visible: row.visible,
    })),
    links,
    hasProducts: products.length > 0,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const pageUrl = `${appUrl}/${shop.slug}`;

  return (
    <>
      <JsonLd data={storeJsonLd({ shop, url: pageUrl })} />
      <ShopPage
        shop={shop}
        products={products}
        categories={categories}
        blocks={blocks}
        pageUrl={pageUrl}
      />
    </>
  );
}
