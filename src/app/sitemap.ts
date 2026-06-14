import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.bio-lien.com";

/**
 * Dynamic sitemap. Static marketing pages first, then every published shop
 * and its products. Re-fetched every hour by Next.js (the route is dynamic
 * because it calls Supabase, so freshness is automatic).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/outils`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/mentions`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const supabase = await createClient();

    const { data: shops } = await supabase
      .from("shops")
      .select("id, slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(1000);

    const publishedShops = shops ?? [];

    const shopRoutes: MetadataRoute.Sitemap = publishedShops.map((s) => ({
      url: `${SITE_URL}/${s.slug}`,
      lastModified: new Date(s.updated_at),
      changeFrequency: "daily",
      priority: 0.7,
    }));

    // Resolve product → shop slug via the already-fetched published shops,
    // which avoids a joined query and the type gymnastics it requires.
    const shopSlugById = new Map(publishedShops.map((s) => [s.id, s.slug]));

    const { data: products } = await supabase
      .from("products")
      .select("slug, updated_at, shop_id")
      .eq("is_published", true)
      .in("shop_id", publishedShops.map((s) => s.id))
      .order("updated_at", { ascending: false })
      .limit(5000);

    const productRoutes: MetadataRoute.Sitemap = (products ?? []).flatMap((p) => {
      const shopSlug = shopSlugById.get(p.shop_id);
      if (!shopSlug) return [];
      return [
        {
          url: `${SITE_URL}/${shopSlug}/${p.slug}`,
          lastModified: new Date(p.updated_at),
          changeFrequency: "daily" as const,
          priority: 0.6,
        },
      ];
    });

    return [...staticRoutes, ...shopRoutes, ...productRoutes];
  } catch {
    // If Supabase is unreachable, at least return the static surface so search
    // engines still discover the marketing pages.
    return staticRoutes;
  }
}
