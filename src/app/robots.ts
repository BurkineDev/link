import type { MetadataRoute } from "next";

const SITE_URL = "https://www.bio-lien.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authenticated surfaces — search engines have nothing to do here.
          "/dashboard",
          "/dashboard/",
          // Server endpoints.
          "/api/",
          // Auth flow pages don't need to rank.
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/checkout",
          "/checkout/",
          // Redirections de liens : rien à indexer, et chaque passage compterait un clic.
          "/go/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
