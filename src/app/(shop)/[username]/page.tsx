/**
 * /{username} — Public shop homepage.
 *
 * Server Component: fetches shop + products + categories from Supabase,
 * sets metadata, then delegates rendering to <ShopPage> (client component).
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";
import { resolveBioTheme } from "@/lib/bio-themes";
import { resolveBioPageBlocks, type LegacyLink } from "@/lib/blocks/resolve";
import type { PageBlockRow } from "@/lib/types/database";
import { ShopPage } from "./shop-page";

interface Props {
  params: Promise<{ username: string }>;
}

/**
 * Revalidate shop pages every 60 seconds. Cuts Supabase load by 60x for
 * popular shops while keeping the catalog reasonably fresh. The dashboard
 * still shows real-time data because it uses authenticated queries that
 * bypass this cache.
 */
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("name, description, banner_url, theme_color")
    .eq("slug", username)
    .eq("is_published", true)
    .single();

  const shop = data as Pick<ShopRow, "name" | "description" | "banner_url" | "theme_color"> | null;

  if (!shop) {
    return { title: "Boutique introuvable" };
  }

  return {
    title: `${shop.name}`,
    description: shop.description ?? `Découvrez la boutique ${shop.name} sur Bio-Lien.`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? `Découvrez la boutique ${shop.name} sur Bio-Lien.`,
      ...(shop.banner_url && {
        images: [{ url: shop.banner_url, width: 1200, height: 630, alt: shop.name }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: shop.name,
      ...(shop.banner_url && { images: [shop.banner_url] }),
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
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("bio_theme, theme_color, accent_color")
    .eq("slug", username)
    .eq("is_published", true)
    .single();

  const shop = data as Pick<
    ShopRow,
    "bio_theme" | "theme_color" | "accent_color"
  > | null;

  if (!shop) return {};
  return { themeColor: resolveBioTheme(shop).backgroundSolid };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Page({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: shopData } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", username)
    .single();

  const shop = shopData as ShopRow | null;

  if (!shop || !shop.is_published) {
    notFound();
  }

  const [productsResult, categoriesResult, linksResult, blocksResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("shop_id", shop.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("*")
        .eq("shop_id", shop.id)
        .order("position", { ascending: true }),
      supabase
        .from("shop_links")
        .select("id, label, url, icon, thumbnail_url, position")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      supabase
        .from("page_blocks")
        .select("id, type, position, title, config, style, visible")
        .eq("shop_id", shop.id)
        .order("position", { ascending: true }),
    ]);

  const products = (productsResult.data ?? []) as ProductRow[];
  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const links = (linksResult.data ?? []) as LegacyLink[];
  const rows = (blocksResult.data ?? []) as PageBlockRow[];

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

  return (
    <ShopPage
      shop={shop}
      products={products}
      categories={categories}
      blocks={blocks}
      pageUrl={`${appUrl}/${shop.slug}`}
    />
  );
}
