/**
 * /{username}/{productSlug} — Product detail page.
 *
 * Server Component: fetches shop + product + variants + related products,
 * then delegates rendering to <ProductPage> (client component).
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, productSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, theme_color")
    .eq("slug", username)
    .eq("is_published", true)
    .single();

  // Une boutique dépubliée ne doit pas laisser une page vide dans l'index.
  if (!shop) return { title: "Produit introuvable", robots: { index: false } };

  const { data: product } = await supabase
    .from("products")
    .select("name, description, images, price, currency")
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .eq("is_published", true)
    .single();

  if (!product) return { title: "Produit introuvable", robots: { index: false } };

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
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("bio_theme, theme_color, accent_color")
    .eq("slug", username)
    .eq("is_published", true)
    .single();

  if (!data) return {};
  return { themeColor: resolveBioTheme(data).backgroundSolid };
}

export default async function Page({ params }: Props) {
  const { username, productSlug } = await params;
  const supabase = await createClient();

  // Fetch shop
  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", username)
    .single();

  if (!shop || !shop.is_published) notFound();

  // Fetch product
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .eq("is_published", true)
    .single();

  if (!product) notFound();

  // Fetch variants (if product has them)
  const { data: variants } = product.has_variants
    ? await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("id")
    : { data: [] };

  // Fetch related products (other published products from same shop)
  const { data: related } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("is_published", true)
    .neq("id", product.id)
    .limit(4)
    .order("created_at", { ascending: false });

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
        variants={variants ?? []}
        related={related ?? []}
        pageUrl={pageUrl}
        shopUrl={shopUrl}
      />
    </>
  );
}
