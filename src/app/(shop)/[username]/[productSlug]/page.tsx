/**
 * /{username}/{productSlug} — Product detail page.
 *
 * Server Component: fetches shop + product + variants + related products,
 * then delegates rendering to <ProductPage> (client component).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductPage } from "./product-page";

interface Props {
  params: Promise<{ username: string; productSlug: string }>;
}

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

  if (!shop) return { title: "Produit introuvable | LinkBoutik" };

  const { data: product } = await supabase
    .from("products")
    .select("name, description, images, price, currency")
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .eq("is_published", true)
    .single();

  if (!product) return { title: "Produit introuvable | LinkBoutik" };

  const primaryImage = product.images?.[0];

  return {
    title: `${product.name} — ${shop.name} | LinkBoutik`,
    description:
      product.description ??
      `Découvrez ${product.name} sur la boutique ${shop.name}.`,
    openGraph: {
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

  return (
    <ProductPage
      shop={shop}
      product={product}
      variants={variants ?? []}
      related={related ?? []}
    />
  );
}
