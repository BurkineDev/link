import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBioTheme } from "@/lib/bio-themes";
import type { ShopRow } from "@/lib/types/database";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * GET /{slug}/app-icon?size=192|512 — l'icône de la page d'une vendeuse une
 * fois épinglée sur un écran d'accueil : son logo s'il existe, sinon son
 * initiale aux couleurs de son thème. Le petit favicon (icon.tsx) ne
 * suffit pas : Android veut 192 et 512 px.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const size = request.nextUrl.searchParams.get("size") === "192" ? 192 : 512;

  let look = { background: "#D9F55C", color: "#0B0F0A", letter: "B", logo: null as string | null };
  if (/^[a-z0-9_-]{3,50}$/.test(username)) {
    const row = await prisma.shop
      .findFirst({
        where: { slug: username, isPublished: true },
        select: { name: true, bioTheme: true, themeColor: true, accentColor: true, logoUrl: true },
      })
      .catch(() => null);
    if (!row) return new NextResponse("Introuvable", { status: 404 });
    const palette = resolveBioTheme({
      name: row.name,
      bio_theme: row.bioTheme,
      theme_color: row.themeColor,
      accent_color: row.accentColor,
    } as Pick<ShopRow, "name" | "bio_theme" | "theme_color" | "accent_color">);
    // Les couleurs des boutons (surface) : c'est ce qui signe le thème sur
    // un écran d'accueil — cobalt pour Wax, sable pour Indigo — comme le favicon.
    look = {
      background: palette.surface,
      color: palette.surfaceText,
      letter: (row.name.trim()[0] ?? "B").toUpperCase(),
      logo: row.logoUrl,
    };
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: look.background,
          color: look.color,
          fontSize: Math.round(size * 0.5),
          fontWeight: 800,
        }}
      >
        {look.logo ? (
          // Le logo occupe la zone sûre d'une icône « maskable » (80 % centré).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={look.logo} alt="" width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} style={{ objectFit: "cover", borderRadius: size * 0.2 }} />
        ) : (
          look.letter
        )}
      </div>
    ),
    { width: size, height: size },
  );
}
