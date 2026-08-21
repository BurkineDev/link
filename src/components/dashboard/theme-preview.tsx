"use client";

import { Globe, Link2, MoreVertical, Share2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BORDER_RADIUS_CLASS,
  CTA_SHAPE_CLASS,
  FONT_FAMILY_CLASS,
} from "@/lib/constants";
import { resolveBioTheme, type BioThemeId } from "@/lib/bio-themes";
import type {
  ShopBorderRadius,
  ShopCtaShape,
  ShopFontFamily,
} from "@/lib/types/database";

/**
 * Live preview of the public bio page, rendered inside a fake browser frame.
 *
 * It reads the exact same palette resolver as the real page, so what a seller
 * sees while tuning colours is what a visitor gets.
 */

interface ThemePreviewProps {
  shopName: string;
  slug?: string;
  bioTheme: BioThemeId;
  primaryColor: string;
  accentColor: string;
  fontFamily: ShopFontFamily;
  borderRadius: ShopBorderRadius;
  ctaShape: ShopCtaShape;
  logoUrl?: string | null;
}

const SAMPLE_LINKS = ["Mon TikTok", "WhatsApp"];

const SAMPLE_PRODUCTS = [
  { name: "Robe en wax", price: "12 000 FCFA", emoji: "👗" },
  { name: "Sac en raphia", price: "8 500 FCFA", emoji: "👜" },
];

export function ThemePreview({
  shopName,
  slug,
  bioTheme,
  primaryColor,
  accentColor,
  fontFamily,
  borderRadius,
  ctaShape,
  logoUrl,
}: ThemePreviewProps) {
  const palette = resolveBioTheme({
    bio_theme: bioTheme,
    theme_color: primaryColor,
    accent_color: accentColor,
  });

  const fontClass = FONT_FAMILY_CLASS[fontFamily] ?? FONT_FAMILY_CLASS.sans;
  const radiusClass = BORDER_RADIUS_CLASS[borderRadius] ?? BORDER_RADIUS_CLASS.lg;
  const ctaShapeClass = CTA_SHAPE_CLASS[ctaShape] ?? CTA_SHAPE_CLASS.rounded;

  const handle = slug || shopName.toLowerCase().replace(/\s+/g, "-") || "ma-boutique";

  const buttonStyle: React.CSSProperties = {
    backgroundColor:
      palette.buttonVariant === "outline" ? "transparent" : palette.surface,
    color:
      palette.buttonVariant === "outline"
        ? palette.text
        : palette.surfaceText,
    border:
      palette.buttonVariant === "outline"
        ? `2px solid ${palette.text}`
        : `1px solid ${palette.border}`,
    boxShadow:
      palette.buttonVariant === "shadow" ? `0 2px 0 0 ${palette.border}` : undefined,
  };

  return (
    <div
      className={cn(
        "h-full overflow-hidden border border-border bg-background",
        fontClass,
      )}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <div className="size-2.5 rounded-full bg-rose-400" />
        <div className="size-2.5 rounded-full bg-amber-400" />
        <div className="size-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex flex-1 items-center gap-1.5 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          <Globe className="size-2.5" />
          bio-lien.com/{handle}
        </div>
      </div>

      {/* Bio page */}
      <div
        className="h-[calc(100%-2rem)] overflow-y-auto px-4 pb-6 pt-3"
        style={{ background: palette.background, color: palette.text }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: palette.surface, color: palette.surfaceText }}
          >
            <Sparkles className="size-3" />
          </span>
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: palette.surface, color: palette.surfaceText }}
          >
            <Share2 className="size-3" />
          </span>
        </div>

        {/* Profile */}
        <div className="mt-2 flex flex-col items-center text-center">
          <div
            className="flex size-14 items-center justify-center overflow-hidden rounded-full text-xl font-bold shadow-sm"
            style={{ backgroundColor: palette.surface, color: palette.surfaceText }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              (shopName || "M").charAt(0).toUpperCase()
            )}
          </div>
          <p
            className="mt-2 text-sm font-bold"
            style={{ color: palette.accent }}
          >
            {shopName || "Ma boutique"}
          </p>
          <p className="text-[10px]" style={{ color: palette.muted }}>
            @{handle}
          </p>
        </div>

        {/* Liens / Boutique switch */}
        <div
          className="mx-auto mt-3 grid w-36 grid-cols-2 rounded-full p-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor:
              palette.buttonVariant === "shadow"
                ? palette.border
                : `color-mix(in oklab, ${palette.text} 16%, transparent)`,
          }}
        >
          <span
            className="rounded-full py-1 text-center"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
            }}
          >
            Liens
          </span>
          <span className="py-1 text-center opacity-70">Boutique</span>
        </div>

        {/* Link buttons */}
        <div className="mt-3 space-y-2">
          {SAMPLE_LINKS.map((label) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 p-1.5 text-[11px] font-semibold",
                ctaShapeClass,
              )}
              style={buttonStyle}
            >
              <span
                className={cn("flex size-7 items-center justify-center", ctaShapeClass)}
                style={{
                  backgroundColor: `color-mix(in oklab, currentColor 10%, transparent)`,
                }}
              >
                <Link2 className="size-3" />
              </span>
              <span className="flex-1 text-center">{label}</span>
              <MoreVertical className="size-3 opacity-50" />
            </div>
          ))}
        </div>

        {/* Products */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SAMPLE_PRODUCTS.map((p) => (
            <div
              key={p.name}
              className={cn("overflow-hidden", radiusClass)}
              style={{
                backgroundColor: palette.surface,
                color: palette.surfaceText,
                border: `1px solid ${palette.border}`,
              }}
            >
              <div className="flex aspect-square w-full items-center justify-center text-2xl">
                {p.emoji}
              </div>
              <div className="p-1.5">
                <p className="line-clamp-1 text-[9px] font-medium">{p.name}</p>
                <p className="text-[10px] font-bold">{p.price}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-4 flex justify-center">
          <span
            className="rounded-full px-3 py-1.5 text-[9px] font-semibold"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.border}`,
            }}
          >
            Crée ta page sur Bio-Lien
          </span>
        </div>
      </div>
    </div>
  );
}
