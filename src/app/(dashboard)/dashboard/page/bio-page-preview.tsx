"use client";

import { Globe, Link2, MessageCircle, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { CTA_SHAPE_CLASS, FONT_FAMILY_CLASS } from "@/lib/constants";
import type { BioPalette } from "@/lib/bio-themes";
import type { ResolvedBlock } from "@/lib/blocks/types";
import type { ShopRow } from "@/lib/types/database";

/**
 * Aperçu de la BioPage dans le Page Builder.
 *
 * Reprend la palette et les formes de la vraie page (mêmes résolveur et
 * classes) pour que ce que le vendeur voit corresponde à ce que le visiteur
 * recevra. Les blocs masqués apparaissent estompés et marqués — dans
 * l'éditeur, ils doivent rester visibles pour être réactivés.
 */

interface BioPagePreviewProps {
  shop: ShopRow;
  palette: BioPalette;
  blocks: ResolvedBlock[];
}

export function BioPagePreview({ shop, palette, blocks }: BioPagePreviewProps) {
  const fontClass = FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;
  const shapeClass = CTA_SHAPE_CLASS[shop.cta_shape] ?? CTA_SHAPE_CLASS.rounded;

  const surfaceStyle: React.CSSProperties = {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `1px solid ${palette.border}`,
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <div className="size-2.5 rounded-full bg-rose-400" />
        <div className="size-2.5 rounded-full bg-amber-400" />
        <div className="size-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex flex-1 items-center gap-1.5 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          <Globe className="size-2.5 shrink-0" />
          bio-lien.com/{shop.slug}
        </div>
      </div>

      <div
        className={cn("h-[520px] overflow-y-auto px-4 py-5", fontClass)}
        style={{ background: palette.background, color: palette.text }}
      >
        {/* Profil */}
        <div className="flex flex-col items-center text-center">
          <div
            className="flex size-16 items-center justify-center overflow-hidden rounded-full text-xl font-bold"
            style={surfaceStyle}
          >
            {shop.logo_url ? (
              // Aperçu local : pas d'optimisation d'image nécessaire.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="size-full object-cover" />
            ) : (
              shop.name.charAt(0).toUpperCase()
            )}
          </div>
          <p className="mt-2 text-sm font-bold" style={{ color: palette.accent }}>
            {shop.name}
          </p>
          <p className="text-[10px]" style={{ color: palette.muted }}>
            @{shop.slug}
          </p>
          {shop.description && (
            <p className="mt-2 line-clamp-2 text-[11px]" style={{ color: palette.text }}>
              {shop.description}
            </p>
          )}
        </div>

        {/* Blocs */}
        <div className="mt-4 space-y-2">
          {blocks.length === 0 && (
            <p
              className="rounded-lg border border-dashed px-3 py-6 text-center text-[11px]"
              style={{ borderColor: palette.border, color: palette.muted }}
            >
              Ajoute un bloc pour voir ta page prendre forme.
            </p>
          )}

          {blocks.map((block) => (
            <div
              key={block.id}
              className={cn(!block.visible && "opacity-40")}
              aria-hidden={!block.visible}
            >
              {!block.visible && (
                <p
                  className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: palette.muted }}
                >
                  Masqué
                </p>
              )}
              {block.title && (
                <p
                  className="mb-1 px-1 text-[11px] font-semibold"
                  style={{ color: palette.text }}
                >
                  {block.title}
                </p>
              )}
              <BlockPreview block={block} palette={palette} shapeClass={shapeClass} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockPreview({
  block,
  palette,
  shapeClass,
}: {
  block: ResolvedBlock;
  palette: BioPalette;
  shapeClass: string;
}) {
  const config = block.config as Record<string, unknown>;
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `1px solid ${palette.border}`,
  };

  switch (block.type) {
    case "LINK":
      return (
        <div
          className={cn("flex items-center gap-2 p-1.5 text-[11px] font-semibold", shapeClass)}
          style={surfaceStyle}
        >
          <span
            className={cn("flex size-7 items-center justify-center", shapeClass)}
            style={{ backgroundColor: "color-mix(in oklab, currentColor 10%, transparent)" }}
          >
            <Link2 className="size-3" />
          </span>
          <span className="flex-1 truncate text-center">
            {String(config.label ?? "Lien")}
          </span>
          <span className="size-7 shrink-0" />
        </div>
      );

    case "WHATSAPP":
      return (
        <div
          className={cn(
            "flex items-center justify-center gap-1.5 p-2 text-[11px] font-semibold text-white",
            shapeClass,
          )}
          style={{ backgroundColor: "#25D366" }}
        >
          <MessageCircle className="size-3" />
          {String(config.label ?? "WhatsApp")}
        </div>
      );

    case "TEXT":
      return (
        <p
          className="px-2 py-1 text-[11px] leading-relaxed"
          style={{
            color: palette.text,
            textAlign: config.align === "left" ? "left" : "center",
          }}
        >
          {String(config.body ?? "")}
        </p>
      );

    case "IMAGE":
      return (
        <div className={cn("overflow-hidden", shapeClass)} style={surfaceStyle}>
          {config.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(config.url)}
              alt={String(config.alt ?? "")}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="aspect-video w-full" />
          )}
        </div>
      );

    case "PRODUCT":
    case "PRODUCT_COLLECTION":
      return (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: block.type === "PRODUCT" ? 1 : 2 }).map((_, i) => (
            <div
              key={i}
              className={cn("overflow-hidden", shapeClass)}
              style={surfaceStyle}
            >
              <div className="flex aspect-square w-full items-center justify-center">
                <ShoppingBag className="size-5 opacity-40" />
              </div>
              <div className="space-y-1 p-1.5">
                <div
                  className="h-1.5 w-3/4 rounded-full"
                  style={{ backgroundColor: "currentColor", opacity: 0.25 }}
                />
                <div
                  className="h-1.5 w-1/2 rounded-full"
                  style={{ backgroundColor: "currentColor", opacity: 0.4 }}
                />
              </div>
            </div>
          ))}
        </div>
      );

    case "SOCIAL":
      return (
        <div className="flex justify-center gap-2 py-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-6 rounded-full"
              style={{ backgroundColor: palette.text, opacity: 0.7 }}
            />
          ))}
        </div>
      );

    default:
      return (
        <div
          className={cn("p-2 text-center text-[11px] font-medium", shapeClass)}
          style={surfaceStyle}
        >
          {block.title || block.type}
        </div>
      );
  }
}
