import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://www.bio-lien.com";

/**
 * Dynamic sitemap. Static marketing pages first, then every published shop
 * and its products. Re-fetched every hour by Next.js (the route is dynamic
 * because it queries the database, so freshness is automatic).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/outils`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // /register et /login sont volontairement absents : robots.txt les
    // interdit. Les déclarer ici produirait un plan de site qui contredit
    // nos propres règles, ce que les outils de référencement signalent.
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/mentions`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const rows = await prisma.shop.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
      select: { id: true, slug: true, updatedAt: true },
    });

    const publishedShops = rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      updated_at: s.updatedAt.toISOString(),
    }));

    const shopRoutes: MetadataRoute.Sitemap = publishedShops.map((s) => ({
      url: `${SITE_URL}/${s.slug}`,
      lastModified: new Date(s.updated_at),
      changeFrequency: "daily",
      priority: 0.7,
    }));

    // Resolve product → shop slug via the already-fetched published shops,
    // which avoids a joined query and the type gymnastics it requires.
    const shopSlugById = new Map(publishedShops.map((s) => [s.id, s.slug]));

    const productRows = await prisma.product.findMany({
      where: { isPublished: true, shopId: { in: publishedShops.map((s) => s.id) } },
      orderBy: { updatedAt: "desc" },
      take: 5000,
      select: { slug: true, updatedAt: true, shopId: true },
    });
    const products = productRows.map((p) => ({
      slug: p.slug,
      updated_at: p.updatedAt.toISOString(),
      shop_id: p.shopId,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.flatMap((p) => {
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
    // If the database is unreachable, at least return the static surface so search
    // engines still discover the marketing pages.
    return staticRoutes;
  }
}
