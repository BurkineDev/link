import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isBioThemeId, resolveBioTheme } from "@/lib/bio-themes";
import { formatPrice } from "@/lib/utils/format";
import type { ProductImage, ProductRow, ShopRow } from "@/lib/types/database";
import {
  STORY_GUTTER,
  STORY_HEIGHT,
  STORY_WIDTH,
  StoryDivider,
  StoryHeaderDecor,
  storyButtonStyle,
  storyCardStyle,
  storyPillStyle,
  storyPriceBadgeStyle,
  storyRaise,
} from "../../story-decor";

/**
 * GET /api/story/{slug}/{productSlug} — a ready-to-post story image
 * (1080×1920) for one product: photo, name, price, QR to the product page.
 *
 * This is what turns every new product into content: the seller adds a
 * product, taps "Partager en story", and it is on Instagram in the shop's own
 * palette. Same exposure policy as the page story — published shop AND
 * published product only, 404 otherwise.
 *
 * Avec un thème « Afrique de l'Ouest », la carte du produit est cousue sur
 * la lisière de la bande ou posée sur le lavis, et le prix s'écrit dans la
 * pastille de rehaut du thème (story-decor.tsx) ; sans décor, rien ne change.
 */

// Runtime Node.js : Prisma ne tourne pas sur le runtime edge, et next/og
// rend aussi bien sur Node.

const WIDTH = STORY_WIDTH;
const HEIGHT = STORY_HEIGHT;
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const SLUG_RE = /^[a-z0-9_-]{1,80}$/;

/**
 * Sépare le montant de son symbole quand celui-ci suit le nombre après une
 * insécable (« 12 500 FCFA » → « 12 500 » + « FCFA ») pour que la pastille
 * écrive le symbole en plus petit. Un prix dont le symbole précède le nombre
 * (« ₦2,500.00 ») reste d'un seul tenant.
 */
function splitPriceSymbol(formatted: string): { amount: string; symbol?: string } {
  const match = /^(.+)\u00A0([A-Za-z]+)$/.exec(formatted);
  return match ? { amount: match[1], symbol: match[2] } : { amount: formatted };
}

type Ctx = { params: Promise<{ slug: string; productSlug: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { slug, productSlug } = await ctx.params;

  if (!SLUG_RE.test(slug) || !SLUG_RE.test(productSlug)) {
    return new Response("Not found", { status: 404 });
  }

  const themeOverride = new URL(request.url).searchParams.get("theme");

  const shopRow = await prisma.shop.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true,
      name: true,
      slug: true,
      bioTheme: true,
      themeColor: true,
      accentColor: true,
      currency: true,
    },
  });

  if (!shopRow) return new Response("Not found", { status: 404 });

  const productRow = await prisma.product.findFirst({
    where: { shopId: shopRow.id, slug: productSlug, isPublished: true },
    select: {
      name: true,
      slug: true,
      price: true,
      comparePrice: true,
      currency: true,
      images: true,
    },
  });

  if (!productRow) return new Response("Not found", { status: 404 });

  // Le rendu lit la forme Supabase (snake_case).
  const shop = {
    id: shopRow.id,
    name: shopRow.name,
    slug: shopRow.slug,
    bio_theme: shopRow.bioTheme,
    theme_color: shopRow.themeColor,
    accent_color: shopRow.accentColor,
    currency: shopRow.currency,
  } as Pick<
    ShopRow,
    "id" | "name" | "slug" | "bio_theme" | "theme_color" | "accent_color" | "currency"
  >;
  const product = {
    name: productRow.name,
    slug: productRow.slug,
    price: Number(productRow.price),
    compare_price:
      productRow.comparePrice === null ? null : Number(productRow.comparePrice),
    currency: productRow.currency,
    images: productRow.images as unknown as ProductRow["images"],
  } as Pick<ProductRow, "name" | "slug" | "price" | "compare_price" | "currency" | "images">;

  const palette = resolveBioTheme(
    isBioThemeId(themeOverride) ? { ...shop, bio_theme: themeOverride } : shop,
  );
  const decor = palette.decor;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bio-lien.com";
  const productUrl = `${appUrl.replace(/\/$/, "")}/${shop.slug}/${product.slug}`;
  const displayUrl = productUrl.replace(/^https?:\/\/(www\.)?/, "");

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?" +
    `data=${encodeURIComponent(productUrl)}` +
    "&size=360x360&margin=0&qzone=1&format=png&color=0F172A&bgcolor=FFFFFF";

  const rawImage = (product.images as ProductImage[] | null)?.[0];
  // satori (the next/og renderer) cannot decode WebP — a .webp URL renders as
  // a blank square. Legacy uploads are WebP (the pipeline now emits JPEG), so
  // those fall back to the lettered card instead of shipping a broken story.
  const image =
    rawImage?.url && !/\.webp(\?|$)/i.test(rawImage.url) ? rawImage : null;
  const currency = product.currency ?? shop.currency;
  const isOnSale =
    product.compare_price !== null && product.compare_price > product.price;
  const discount = isOnSale
    ? Math.round(
        ((product.compare_price! - product.price) / product.compare_price!) *
          100,
      )
    : 0;

  const productName =
    product.name.length > 60 ? `${product.name.slice(0, 57)}…` : product.name;

  const priceBadge = storyPriceBadgeStyle(palette);
  const price = splitPriceSymbol(formatPrice(product.price, currency));
  const raise = storyRaise(palette);
  // Le badge promo prend la couleur de rehaut du thème quand il en a une ;
  // sinon le rose historique.
  const saleBadge = decor?.highlight
    ? { backgroundColor: decor.highlight.bg, color: decor.highlight.text }
    : { backgroundColor: "#F43F5E", color: "#FFFFFF" };

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
          padding: `88px ${STORY_GUTTER}px`,
          background: palette.background,
          color: palette.text,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <StoryHeaderDecor palette={palette} />

        {/* Shop identity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 34px",
            borderRadius: 999,
            fontSize: 34,
            fontWeight: 800,
            ...storyPillStyle(palette),
          }}
        >
          {shop.name}
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            @{shop.slug}
          </div>
        </div>

        {/* Product visual — sur une bande, la carte chevauche la lisière */}
        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: 64,
            width: 820,
            height: 820,
            borderRadius: decor ? 28 : 56,
            overflow: "hidden",
            ...storyCardStyle(palette),
          }}
        >
          {image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt=""
              width={820}
              height={820}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                color: decor?.card?.text ?? palette.surfaceText,
                fontSize: 260,
                fontWeight: 800,
              }}
            >
              {product.name.charAt(0).toUpperCase()}
            </div>
          )}

          {isOnSale ? (
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: 36,
                left: 36,
                padding: "14px 30px",
                borderRadius: 999,
                fontSize: 40,
                fontWeight: 800,
                ...saleBadge,
              }}
            >
              −{discount}%
            </div>
          ) : null}
        </div>

        {/* Name + price */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            maxWidth: 880,
            fontSize: 62,
            fontWeight: 800,
            textAlign: "center",
            color: palette.text,
          }}
        >
          {productName}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 26,
            marginTop: 26,
          }}
        >
          {priceBadge ? (
            // La pastille de prix du thème : chiffres en grand, symbole en
            // petit, tous deux dans l'encre garantie lisible sur le rehaut.
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                padding: "10px 40px",
                borderRadius: 999,
                fontSize: 72,
                fontWeight: 800,
                ...priceBadge,
              }}
            >
              {price.amount}
              {price.symbol ? (
                <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
                  {price.symbol}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                fontSize: 84,
                fontWeight: 800,
                color: palette.accent,
              }}
            >
              {formatPrice(product.price, currency)}
            </div>
          )}
          {isOnSale ? (
            <div
              style={{
                display: "flex",
                fontSize: 46,
                fontWeight: 600,
                color: palette.muted,
                textDecoration: "line-through",
              }}
            >
              {formatPrice(product.compare_price!, currency)}
            </div>
          ) : null}
        </div>

        {/* La couture du thème, entre le produit et l'appel à scanner */}
        <StoryDivider palette={palette} />

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* QR + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 44,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: 24,
              borderRadius: 40,
              background: "#FFFFFF",
              border: `2px solid ${palette.border}`,
              ...(raise ? { boxShadow: raise } : {}),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="" width={280} height={280} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              maxWidth: 560,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 800,
                color: palette.text,
              }}
            >
              Scanne pour commander
            </div>
            <div
              style={{
                display: "flex",
                padding: "16px 30px",
                borderRadius: 999,
                fontSize: 27,
                fontWeight: 700,
                ...storyButtonStyle(palette, { pill: true }),
              }}
            >
              {displayUrl.length > 32 ? `${displayUrl.slice(0, 29)}…` : displayUrl}
            </div>
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
