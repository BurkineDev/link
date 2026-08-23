import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { isBioThemeId, resolveBioTheme } from "@/lib/bio-themes";
import { formatPrice } from "@/lib/utils/format";
import type { Database, ProductImage } from "@/lib/types/database";

/**
 * GET /api/story/{slug}/{productSlug} — a ready-to-post story image
 * (1080×1920) for one product: photo, name, price, QR to the product page.
 *
 * This is what turns every new product into content: the seller adds a
 * product, taps "Partager en story", and it is on Instagram in the shop's own
 * palette. Same exposure policy as the page story — published shop AND
 * published product only, 404 otherwise.
 */

export const runtime = "edge";

const WIDTH = 1080;
const HEIGHT = 1920;
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const SLUG_RE = /^[a-z0-9_-]{1,80}$/;

type Ctx = { params: Promise<{ slug: string; productSlug: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { slug, productSlug } = await ctx.params;

  if (!SLUG_RE.test(slug) || !SLUG_RE.test(productSlug)) {
    return new Response("Not found", { status: 404 });
  }

  const themeOverride = new URL(request.url).searchParams.get("theme");

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, bio_theme, theme_color, accent_color, currency")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!shop) return new Response("Not found", { status: 404 });

  const { data: product } = await supabase
    .from("products")
    .select("name, slug, price, compare_price, currency, images")
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .eq("is_published", true)
    .single();

  if (!product) return new Response("Not found", { status: 404 });

  const palette = resolveBioTheme(
    isBioThemeId(themeOverride) ? { ...shop, bio_theme: themeOverride } : shop,
  );

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

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          height: "100%",
          padding: "88px 72px",
          background: palette.background,
          color: palette.text,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Shop identity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 34px",
            borderRadius: 999,
            background: palette.surface,
            color: palette.surfaceText,
            border: `2px solid ${palette.border}`,
            fontSize: 34,
            fontWeight: 800,
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

        {/* Product visual */}
        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: 64,
            width: 820,
            height: 820,
            borderRadius: 56,
            overflow: "hidden",
            background: palette.surface,
            border: `6px solid ${palette.surface}`,
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
                color: palette.surfaceText,
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
                background: "#F43F5E",
                color: "#FFFFFF",
                fontSize: 40,
                fontWeight: 800,
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
                background: palette.surface,
                color: palette.surfaceText,
                border: `2px solid ${palette.border}`,
                fontSize: 27,
                fontWeight: 700,
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
