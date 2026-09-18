"use client";

import type { CSSProperties } from "react";
import { Globe, Link2, MessageCircle, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { CTA_SHAPE_CLASS, FONT_FAMILY_CLASS } from "@/lib/constants";
import {
  bioAvatarRingStyle,
  bioButtonStyle,
  bioCardStyle,
  bioFontVars,
  bioThemeCssVars,
  contrastRatio,
  whatsappButtonStyle,
  type BioPalette,
} from "@/lib/bio-themes";
import { BioDivider, BioHeaderDecor } from "@/components/shop/bio-theme-decor";
import type { ResolvedBlock } from "@/lib/blocks/types";
import type { ShopRow } from "@/lib/types/database";

/**
 * Aperçu de la BioPage dans le Page Builder.
 *
 * Reprend la palette et les formes de la vraie page (mêmes résolveur et
 * classes) pour que ce que le vendeur voit corresponde à ce que le visiteur
 * recevra. Le décor des thèmes « Afrique de l'Ouest » (lavis ou bande de
 * tête, anneau d'avatar, couture, boutons bordés, cartes crème) passe par
 * les mêmes composants et fonctions de style que la page. Les blocs masqués
 * apparaissent estompés et marqués — dans l'éditeur, ils doivent rester
 * visibles pour être réactivés.
 */

interface BioPagePreviewProps {
  shop: ShopRow;
  palette: BioPalette;
  blocks: ResolvedBlock[];
}

/**
 * L'aperçu est une page réduite (avatar 64 px au lieu de 96) : le décor de
 * tête est rendu par le composant de la page, à ses hauteurs réelles, puis
 * réduit d'un facteur unique.
 */
const DECOR_SCALE = 0.6;

/** Avatar de l'aperçu : 64 px, le `size-16` ci-dessous. */
const AVATAR_SIZE = 64;

/** Haut de la colonne : `py-5` (20 px). */
const CONTENT_TOP = 20;

/**
 * Sur la page, l'avatar chevauche la lisière de la bande (−48 px) : ici le
 * profil descend pour que le centre de l'avatar tombe sur la lisière de la
 * bande réduite. Sans bande (lavis, bannière, thème historique), rien.
 */
function profileOffset(palette: BioPalette, hasBanner: boolean): number | undefined {
  const header = palette.decor?.header;
  if (hasBanner || header?.kind !== "band") return undefined;
  return Math.max(0, header.height * DECOR_SCALE - AVATAR_SIZE / 2 - CONTENT_TOP);
}

/**
 * Tuile d'icône d'un bouton de lien, la règle de bio-link-button : sur un
 * thème à décor dont les boutons sont un aplat franc sur page claire (Wax :
 * cobalt sur crème), la tuile s'inverse en disque du fond de page avec
 * l'icône couleur bouton ; partout ailleurs, la teinte du texte courant à
 * 10 %, comme aujourd'hui.
 */
function iconTileStyle(palette: BioPalette): CSSProperties {
  if (
    palette.decor &&
    palette.scheme === "light" &&
    contrastRatio(palette.surface, palette.backgroundSolid) >= 3
  ) {
    return { backgroundColor: palette.backgroundSolid, color: palette.surface };
  }
  return { backgroundColor: "color-mix(in oklab, currentColor 10%, transparent)" };
}

export function BioPagePreview({ shop, palette, blocks }: BioPagePreviewProps) {
  const fontClass = FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;
  const shapeClass = CTA_SHAPE_CLASS[shop.cta_shape] ?? CTA_SHAPE_CLASS.rounded;
  const fontVars = bioFontVars(palette, shop.font_family);
  const hasBanner = Boolean(shop.banner_url);
  const ring = bioAvatarRingStyle(palette);
  const marginTop = profileOffset(palette, hasBanner);

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
        className={cn("relative h-[520px] overflow-y-auto px-4 py-5", fontClass)}
        style={
          {
            background: palette.background,
            color: palette.text,
            colorScheme: palette.scheme,
            ...bioThemeCssVars(palette),
            ...fontVars,
            fontFamily: fontVars["--bio-font-body"] ? "var(--bio-font-body)" : undefined,
          } as CSSProperties
        }
      >
        {/* Décor de tête (lavis ou bande), le composant de la page réduit. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: `${100 / DECOR_SCALE}%`,
            transform: `scale(${DECOR_SCALE})`,
          }}
        >
          <BioHeaderDecor palette={palette} hasBanner={hasBanner} />
        </div>

        {/* Bannière fondue dans le fond, comme sur la page */}
        {shop.banner_url && (
          <div className="absolute inset-x-0 top-0 h-24 overflow-hidden">
            {/* Aperçu local : pas d'optimisation d'image nécessaire. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shop.banner_url} alt="" className="size-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${palette.backgroundSolid}40, ${palette.backgroundSolid})`,
              }}
            />
          </div>
        )}

        {/* Profil */}
        <div
          className="relative flex flex-col items-center text-center"
          style={marginTop === undefined ? undefined : { marginTop }}
        >
          <div
            className="flex size-16 items-center justify-center overflow-hidden rounded-full text-xl font-bold"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.border}`,
              ...ring,
            }}
          >
            {shop.logo_url ? (
              // Aperçu local : pas d'optimisation d'image nécessaire.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="size-full object-cover" />
            ) : (
              shop.name.charAt(0).toUpperCase()
            )}
          </div>
          <p
            className="mt-2 text-sm font-bold"
            style={{
              color: palette.accent,
              fontFamily: "var(--bio-font-display, inherit)",
            }}
          >
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

        {/* La couture entre le profil et les blocs (thèmes à décor). */}
        <BioDivider palette={palette} className="relative" />

        {/* Blocs */}
        <div className="relative mt-4 space-y-2">
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
                  style={{
                    color: palette.text,
                    fontFamily: "var(--bio-font-display, inherit)",
                  }}
                >
                  {block.title}
                </p>
              )}
              <BlockPreview
                block={block}
                palette={palette}
                shapeClass={shapeClass}
                pill={shop.cta_shape === "pill"}
              />
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
  pill,
}: {
  block: ResolvedBlock;
  palette: BioPalette;
  shapeClass: string;
  pill: boolean;
}) {
  const config = block.config as Record<string, unknown>;
  const decor = palette.decor;
  const buttonStyle = bioButtonStyle(palette, { pill });
  const cardStyle: CSSProperties = { ...bioCardStyle(palette) };
  // Un flou dans un aperçu de 300 px ne montre rien de plus et coûte une
  // couche de composition par carte : on le laisse à la page.
  delete cardStyle.backdropFilter;
  const surfaceStyle: CSSProperties = {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `1px solid ${palette.border}`,
  };

  switch (block.type) {
    case "LINK":
      return (
        <div
          className={cn(
            "flex items-center gap-2 p-1.5 text-[11px] font-semibold",
            // La lisière de 5 px du Pagne tissé mordrait sur la tuile.
            decor?.selvedge && !pill && "pl-3",
            shapeClass,
          )}
          style={buttonStyle}
        >
          <span
            className={cn("flex size-7 items-center justify-center", shapeClass)}
            style={iconTileStyle(palette)}
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
      // Encre sombre sur le vert : le blanc ne lisait pas en plein soleil.
      return (
        <div
          className={cn(
            "flex items-center justify-center gap-1.5 p-2 text-[11px] font-semibold",
            shapeClass,
          )}
          style={whatsappButtonStyle("inline")}
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
              style={cardStyle}
            >
              <div
                className="flex aspect-square w-full items-center justify-center"
                style={decor ? { borderBottom: `1px solid ${palette.border}` } : undefined}
              >
                <ShoppingBag className="size-5 opacity-40" />
              </div>
              <div className="space-y-1 p-1.5">
                <div
                  className="h-1.5 w-3/4 rounded-full"
                  style={{ backgroundColor: "currentColor", opacity: 0.25 }}
                />
                {/* Le prix : une pastille de rehaut sur les thèmes à décor. */}
                <div
                  className="h-2 w-1/2 rounded-sm"
                  style={
                    decor?.highlight
                      ? { backgroundColor: decor.highlight.bg }
                      : { backgroundColor: "currentColor", opacity: 0.4 }
                  }
                />
                {/* « Commander » pleine largeur, encre sur vert : sur tous les thèmes. */}
                <div
                  className="flex h-4 items-center justify-center gap-0.5 rounded text-[8px] font-bold"
                  style={whatsappButtonStyle("inline")}
                >
                  <MessageCircle className="size-2" />
                  Commander
                </div>
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
