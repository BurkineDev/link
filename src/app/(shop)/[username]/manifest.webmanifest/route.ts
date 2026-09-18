import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBioTheme } from "@/lib/bio-themes";
import type { ShopRow } from "@/lib/types/database";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * GET /{slug}/manifest.webmanifest — la page d'une vendeuse comme une appli.
 *
 * Un client qui épingle bio-lien.com/awa-couture sur son écran d'accueil
 * doit voir « Awa Couture » et son icône, pas « Bio-Lien » : chaque page
 * publiée a donc son propre manifeste, aux couleurs de son thème, qui
 * s'ouvre sur elle. Le manifeste global (src/app/manifest.ts) reste celui
 * du tableau de bord des vendeurs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!/^[a-z0-9_-]{3,50}$/.test(username)) return new NextResponse(null, { status: 404 });

  const row = await prisma.shop
    .findFirst({
      where: { slug: username, isPublished: true },
      select: { name: true, description: true, bioTheme: true, themeColor: true, accentColor: true },
    })
    .catch(() => null);
  if (!row) return new NextResponse(null, { status: 404 });

  const palette = resolveBioTheme({
    name: row.name,
    bio_theme: row.bioTheme,
    theme_color: row.themeColor,
    accent_color: row.accentColor,
  } as Pick<ShopRow, "name" | "bio_theme" | "theme_color" | "accent_color">);

  const manifest = {
    name: row.name,
    short_name: row.name.slice(0, 12),
    description: row.description ?? `${row.name} sur Bio-Lien`,
    start_url: `/${username}?source=pwa`,
    scope: `/${username}`,
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: palette.backgroundSolid,
    theme_color: palette.backgroundSolid,
    icons: [
      { src: `/${username}/app-icon?size=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/${username}/app-icon?size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/${username}/app-icon?size=512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
