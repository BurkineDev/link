"use client";

import { ShoppingBag, ExternalLink, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BORDER_RADIUS_CLASS,
  CARD_STYLE_CLASS,
  CTA_SHAPE_CLASS,
  FONT_FAMILY_CLASS,
} from "@/lib/constants";
import type {
  ShopBorderRadius,
  ShopCardStyle,
  ShopCtaShape,
  ShopCtaStyle,
  ShopFontFamily,
} from "@/lib/types/database";

interface ThemePreviewProps {
  shopName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: ShopFontFamily;
  borderRadius: ShopBorderRadius;
  cardStyle: ShopCardStyle;
  ctaShape: ShopCtaShape;
  ctaStyle: ShopCtaStyle;
  logoUrl?: string | null;
}

const SAMPLE_PRODUCTS = [
  { name: "Robe en wax",       price: "12 000 FCFA",  emoji: "👗" },
  { name: "Sandales artisanales", price: "8 500 FCFA",  emoji: "👡" },
  { name: "Sac à main cuir",   price: "25 000 FCFA",  emoji: "👜" },
];

const SAMPLE_LINKS = [
  { label: "WhatsApp",  icon: "💬" },
  { label: "Instagram", icon: "📷" },
];

export function ThemePreview({
  shopName,
  primaryColor,
  accentColor,
  fontFamily,
  borderRadius,
  cardStyle,
  ctaShape,
  ctaStyle,
  logoUrl,
}: ThemePreviewProps) {
  const fontClass = FONT_FAMILY_CLASS[fontFamily] ?? FONT_FAMILY_CLASS.sans;
  const radiusClass = BORDER_RADIUS_CLASS[borderRadius] ?? BORDER_RADIUS_CLASS.lg;
  const cardClass = CARD_STYLE_CLASS[cardStyle] ?? CARD_STYLE_CLASS.bordered;
  const ctaShapeClass = CTA_SHAPE_CLASS[ctaShape] ?? CTA_SHAPE_CLASS.rounded;

  // CTA style maps to inline styles since colors are dynamic
  const ctaInlineStyle: React.CSSProperties = (() => {
    if (ctaStyle === "filled") {
      return { backgroundColor: primaryColor, color: accentColor, border: "none" };
    }
    if (ctaStyle === "outline") {
      return {
        backgroundColor: "transparent",
        color: primaryColor,
        border: `2px solid ${primaryColor}`,
      };
    }
    return {
      backgroundColor: `${primaryColor}1A`,
      color: primaryColor,
      border: "none",
    };
  })();

  return (
    <div
      className={cn(
        "h-full overflow-hidden border border-border bg-background",
        fontClass,
      )}
      style={
        {
          "--shop-primary": primaryColor,
          "--shop-accent": accentColor,
        } as React.CSSProperties
      }
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <div className="size-2.5 rounded-full bg-rose-400" />
        <div className="size-2.5 rounded-full bg-amber-400" />
        <div className="size-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex flex-1 items-center gap-1.5 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          <Globe className="size-2.5" />
          linkboutik.com/{shopName.toLowerCase().replace(/\s+/g, "-")}
        </div>
      </div>

      {/* Scrollable mock storefront */}
      <div className="h-[calc(100%-2rem)] overflow-y-auto">
        {/* Banner + logo */}
        <div
          className="relative h-20"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
          }}
        />
        <div className="-mt-8 flex items-end gap-3 px-4">
          <div
            className={cn(
              "flex size-16 shrink-0 items-center justify-center overflow-hidden border-4 border-background bg-card text-2xl font-bold shadow-sm",
              radiusClass,
            )}
            style={{ color: primaryColor }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={shopName}
                className="size-full object-cover"
              />
            ) : (
              shopName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="pb-1">
            <p className="text-base font-bold text-foreground">
              {shopName || "Ma boutique"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Boutique en ligne
            </p>
          </div>
        </div>

        {/* CTA links (Linktree-style) */}
        <div className="mt-4 space-y-2 px-4">
          {SAMPLE_LINKS.map((link) => (
            <button
              key={link.label}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all",
                ctaShapeClass,
              )}
              style={ctaInlineStyle}
            >
              <span className="text-sm">{link.icon}</span>
              <span className="flex-1 text-left">{link.label}</span>
              <ExternalLink className="size-3 opacity-50" />
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 px-4 pb-6">
          {SAMPLE_PRODUCTS.slice(0, 2).map((p) => (
            <div
              key={p.name}
              className={cn(
                "flex flex-col overflow-hidden",
                radiusClass,
                cardClass,
              )}
            >
              <div
                className="flex aspect-square w-full items-center justify-center bg-muted text-2xl"
                style={{ color: primaryColor }}
              >
                {p.emoji}
              </div>
              <div className="flex flex-col gap-1 p-2">
                <p className="line-clamp-1 text-[10px] font-medium leading-tight text-foreground">
                  {p.name}
                </p>
                <p className="text-[11px] font-bold text-foreground">
                  {p.price}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Floating cart button */}
        <div className="relative h-0">
          <div
            className="absolute -top-12 right-3 flex size-10 items-center justify-center shadow-md"
            style={{
              backgroundColor: primaryColor,
              color: accentColor,
              borderRadius: ctaShape === "pill" ? "9999px" : ctaShape === "rounded" ? "12px" : "0",
            }}
          >
            <ShoppingBag className="size-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
