import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isBioThemeId, resolveBioTheme } from "@/lib/bio-themes";
import type { ShopRow } from "@/lib/types/database";
import {
  STORY_BAND_HEIGHT,
  STORY_GUTTER,
  STORY_HEIGHT,
  STORY_WIDTH,
  StoryDivider,
  StoryHeaderDecor,
  storyAvatarStyle,
  storyButtonStyle,
  storyHasBand,
  storyPillStyle,
  storyRaise,
} from "../story-decor";

/**
 * GET /api/story/{slug} — a ready-to-post story image (1080×1920, 9:16) for a
 * published shop, painted with the exact palette of its public bio page.
 *
 * This is the seller's growth loop: they screenshot nothing, they download or
 * native-share this image straight into an Instagram/TikTok/WhatsApp story.
 * The QR code and the URL pill both lead to the bio page.
 *
 * Public by design (same policy as the OG images): it only shows what the
 * public page already shows. Unpublished or unknown slugs get a 404.
 *
 * Les thèmes « Afrique de l'Ouest » y retrouvent leur zone haute (lavis ou
 * bande à motif), leur anneau d'avatar, leur couture et leurs reliefs, via
 * story-decor.tsx ; sans décor, l'image est celle d'avant.
 */

// Runtime Node.js : Prisma ne tourne pas sur le runtime edge, et next/og
// rend aussi bien sur Node.

const WIDTH = STORY_WIDTH;
const HEIGHT = STORY_HEIGHT;

/** Cache at the edge for an hour — theme changes show up on the next hour. */
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Géométrie de la zone haute : ces trois valeurs fixent où tombe l'avatar.
 * La pastille garde sa hauteur historique (14 px de marge autour d'une
 * ligne de 32 px), fixée ici pour que le calcul ne dépende pas de la police.
 */
const TOP_PADDING = 96;
const PILL_HEIGHT = 74;
const AVATAR_SIZE = 220;
/** Écart historique entre la pastille « Bio-Lien » et l'avatar. */
const PROFILE_GAP = 88;

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;

  // Optional palette override (?theme=kente) so the dashboard can preview a
  // theme before saving it. Palettes are public information, so letting
  // anyone pass this is harmless.
  const themeOverride = new URL(request.url).searchParams.get("theme");

  if (!/^[a-z0-9_-]{3,50}$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }

  // Route publique et sans cookie : seules les boutiques publiées sont
  // lisibles, c'est le `where` qui l'impose.
  const row = await prisma.shop.findFirst({
    where: { slug, isPublished: true },
    select: {
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      bioTheme: true,
      themeColor: true,
      accentColor: true,
    },
  });

  if (!row) return new Response("Not found", { status: 404 });

  const shop = {
    name: row.name,
    slug: row.slug,
    description: row.description,
    logo_url: row.logoUrl,
    bio_theme: row.bioTheme,
    theme_color: row.themeColor,
    accent_color: row.accentColor,
  } as Pick<
    ShopRow,
    "name" | "slug" | "description" | "logo_url" | "bio_theme" | "theme_color" | "accent_color"
  >;

  const palette = resolveBioTheme(
    isBioThemeId(themeOverride) ? { ...shop, bio_theme: themeOverride } : shop,
  );
  const decor = palette.decor;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bio-lien.com";
  const pageUrl = `${appUrl.replace(/\/$/, "")}/${shop.slug}`;
  const displayUrl = pageUrl.replace(/^https?:\/\/(www\.)?/, "");

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?" +
    `data=${encodeURIComponent(pageUrl)}` +
    "&size=440x440&margin=0&qzone=1&format=png&color=0F172A&bgcolor=FFFFFF";

  const description = (shop.description ?? "").trim();
  const shortDescription =
    description.length > 110 ? `${description.slice(0, 107)}…` : description;

  const initial = shop.name.charAt(0).toUpperCase();

  // Sur une bande (Wax, Pagne tissé), l'avatar est cousu à cheval sur la
  // lisière : son centre tombe sur le bord bas de la bande.
  const profileGap = storyHasBand(palette)
    ? STORY_BAND_HEIGHT - AVATAR_SIZE / 2 - TOP_PADDING - PILL_HEIGHT
    : PROFILE_GAP;

  const pillStyle = storyPillStyle(palette);
  const raise = storyRaise(palette);
  // Les boutons d'un thème à décor sont des rectangles arrondis, comme sur la
  // page (la lisière de Pagne tissé n'existe pas en forme pilule).
  const buttonRadius = decor ? 28 : 999;
  const buttonStyle = storyButtonStyle(palette, { pill: !decor });

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          width: "100%",
          height: "100%",
          padding: `${TOP_PADDING}px ${STORY_GUTTER}px`,
          background: palette.background,
          color: palette.text,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <StoryHeaderDecor palette={palette} />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: PILL_HEIGHT,
            padding: "14px 32px",
            borderRadius: 999,
            fontSize: 32,
            fontWeight: 800,
            ...pillStyle,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 18,
              height: 18,
              borderRadius: 999,
              background: pillStyle.color,
            }}
          />
          Bio-Lien
        </div>

        {/* Profile */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: profileGap,
          }}
        >
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.logo_url}
              alt=""
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 999,
                objectFit: "cover",
                ...storyAvatarStyle(palette, "image"),
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 999,
                fontSize: 104,
                fontWeight: 800,
                ...storyAvatarStyle(palette, "initials"),
              }}
            >
              {initial}
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 44,
              fontSize: 76,
              fontWeight: 800,
              color: palette.accent,
              textAlign: "center",
            }}
          >
            {shop.name}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 38,
              fontWeight: 600,
              color: palette.muted,
            }}
          >
            @{shop.slug}
          </div>

          {shortDescription ? (
            <div
              style={{
                display: "flex",
                marginTop: 34,
                maxWidth: 780,
                fontSize: 36,
                lineHeight: 1.4,
                textAlign: "center",
                color: palette.text,
              }}
            >
              {shortDescription}
            </div>
          ) : null}
        </div>

        {/* La couture du thème, entre le profil et les liens (rien sans décor) */}
        <StoryDivider palette={palette} />

        {/* Faux link buttons — evokes the page the visitor will land on */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: 780,
            marginTop: decor ? 56 : 72,
            gap: 26,
          }}
        >
          {["Découvre mes produits", "Commande en 2 minutes"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 108,
                borderRadius: buttonRadius,
                fontSize: 38,
                fontWeight: 700,
                ...buttonStyle,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Spacer pushes the QR block to the bottom */}
        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* QR + URL */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 34,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: 28,
              borderRadius: 48,
              background: "#FFFFFF",
              border: `2px solid ${palette.border}`,
              ...(raise ? { boxShadow: raise } : {}),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="" width={340} height={340} />
          </div>
          <div
            style={{
              display: "flex",
              padding: "20px 44px",
              borderRadius: 999,
              fontSize: 42,
              fontWeight: 800,
              ...storyButtonStyle(palette, { pill: true }),
            }}
          >
            {displayUrl}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}
