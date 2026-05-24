/**
 * /{username} — Public shop homepage.
 *
 * Server Component: fetches shop + products + categories from Supabase,
 * sets metadata, then delegates rendering to <ShopPage> (client component).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";
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
    return { title: "Boutique introuvable | LinkBoutik" };
  }

  return {
    title: `${shop.name} | LinkBoutik`,
    description: shop.description ?? `Découvrez la boutique ${shop.name} sur LinkBoutik.`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? `Découvrez la boutique ${shop.name} sur LinkBoutik.`,
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
// Page
// ---------------------------------------------------------------------------

export default async function Page({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch shop
  const { data: shopData } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", username)
    .single();

  const shop = shopData as ShopRow | null;

  if (!shop || !shop.is_published) {
    notFound();
  }

  // Fetch published products
  const { data: productsData } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const products = (productsData ?? []) as ProductRow[];

  // Fetch categories
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("*")
    .eq("shop_id", shop.id)
    .order("position", { ascending: true });

  const categories = (categoriesData ?? []) as CategoryRow[];

  return (
    <ShopPage
      shop={shop}
      products={products}
      categories={categories}
    />
  );
}
