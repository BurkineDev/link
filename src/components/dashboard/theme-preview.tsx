"use client";

import type { CSSProperties } from "react";
import {
  Globe,
  Link2,
  MessageCircle,
  MoreVertical,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BORDER_RADIUS_CLASS,
  CTA_SHAPE_CLASS,
  FONT_FAMILY_CLASS,
} from "@/lib/constants";
import {
  bioAvatarInitialsStyle,
  bioAvatarRingStyle,
  bioFontVars,
  bioIconTileStyle,
  bioPriceBadgeStyle,
  bioTabStyle,
  bioTabTrackStyle,
  bioThemeCssVars,
  bioTopBarPillStyle,
  resolveBioTheme,
  whatsappButtonStyle,
  type BioThemeId,
} from "@/lib/bio-themes";
import { BioDivider } from "@/components/shop/bio-theme-decor";
import {
  PreviewBanner,
  PreviewHeaderDecor,
  previewButtonStyle,
  previewCardStyle,
  previewProfileOffset,
} from "@/components/dashboard/bio-preview-decor";
import { formatPrice } from "@/lib/utils/format";
import type {
  ShopBorderRadius,
  ShopCtaShape,
  ShopFontFamily,
} from "@/lib/types/database";

/**
 * Live preview of the public bio page, rendered inside a fake browser frame.
 *
 * It reads the exact same palette resolver as the real page, so what a seller
 * sees while tuning colours is what a visitor gets. Le décor des thèmes
 * « Afrique de l'Ouest » passe par les mêmes composants et les mêmes
 * fonctions de style que la page (BioHeaderDecor, BioDivider,
 * bioButtonStyle, bioTabTrackStyle, anneau d'avatar, pastille prix) :
 * l'aperçu ne réinvente rien, sinon il ment.
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
  /**
   * Bannière de la boutique : sur la page, elle prend la place du lavis ou
   * de la bande. L'aperçu la montre pour la même raison.
   */
  bannerUrl?: string | null;
  /** Le badge « Crée ta page sur Bio-Lien », retirable sur un plan payant. */
  showBadge?: boolean;
}

const SAMPLE_LINKS = ["Mon TikTok", "WhatsApp"];

const SAMPLE_PRODUCTS = [
  { name: "Robe en wax", price: 12000, emoji: "👗" },
  { name: "Sac en raphia", price: 8500, emoji: "👜" },
];

/** Avatar de l'aperçu : 56 px, le `size-14` ci-dessous. */
const AVATAR_SIZE = 56;

/** Bas de la barre haute : `pt-3` (12 px) + pastilles `size-6` (24 px). */
const TOP_BAR_BOTTOM = 36;

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
  bannerUrl,
  showBadge = true,
}: ThemePreviewProps) {
  const palette = resolveBioTheme({
    bio_theme: bioTheme,
    theme_color: primaryColor,
    accent_color: accentColor,
  });
  const decor = palette.decor;
  const hasBanner = Boolean(bannerUrl);
  const overHeader = hasBanner || decor?.header?.kind === "band";

  const fontClass = FONT_FAMILY_CLASS[fontFamily] ?? FONT_FAMILY_CLASS.sans;
  const radiusClass = BORDER_RADIUS_CLASS[borderRadius] ?? BORDER_RADIUS_CLASS.lg;
  const ctaShapeClass = CTA_SHAPE_CLASS[ctaShape] ?? CTA_SHAPE_CLASS.rounded;
  const fontVars = bioFontVars(palette, fontFamily);

  const handle = slug || shopName.toLowerCase().replace(/\s+/g, "-") || "ma-boutique";

  // Les mêmes styles que la page, sans le flou du variant verre.
  const buttonStyle = previewButtonStyle(palette, { pill: ctaShape === "pill" });
  const cardStyle = previewCardStyle(palette);
  const ring = bioAvatarRingStyle(palette);
  const priceBadge = bioPriceBadgeStyle(palette);
  const tile = bioIconTileStyle(palette);
  // Sans bande, le `mt-2` historique du profil.
  const marginTop = previewProfileOffset(palette, {
    hasBanner,
    avatarSize: AVATAR_SIZE,
    contentTop: TOP_BAR_BOTTOM,
  });

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
        className="relative h-[calc(100%-2rem)] overflow-y-auto px-4 pb-6 pt-3"
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
        {/* Décor de tête (lavis ou bande), le composant de la page réduit,
            ou la bannière fondue dans le fond, comme sur la page. */}
        <PreviewHeaderDecor palette={palette} hasBanner={hasBanner} />
        {bannerUrl && <PreviewBanner url={bannerUrl} palette={palette} />}

        {/* Top bar */}
        <div className="relative flex items-center justify-between">
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={bioTopBarPillStyle(palette, { overHeader })}
          >
            <Sparkles className="size-3" />
          </span>
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={bioTopBarPillStyle(palette, { overHeader })}
          >
            <Share2 className="size-3" />
          </span>
        </div>

        {/* Profile */}
        <div
          className={cn(
            "relative flex flex-col items-center text-center",
            marginTop === undefined && "mt-2",
          )}
          style={marginTop === undefined ? undefined : { marginTop }}
        >
          <div
            className={cn(
              "flex size-14 items-center justify-center overflow-hidden rounded-full text-xl font-bold",
              // L'anneau du décor remplace l'ombre floue.
              !ring && "shadow-sm",
            )}
            // Les couleurs du disque, son filet et son anneau sont ceux de la
            // page (crème à initiales cobalt sur la bande de Wax).
            style={bioAvatarInitialsStyle(palette)}
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
            style={{
              color: palette.accent,
              fontFamily: "var(--bio-font-display, inherit)",
            }}
          >
            {shopName || "Ma boutique"}
          </p>
          <p className="text-[10px]" style={{ color: palette.muted }}>
            @{handle}
          </p>
        </div>

        {/* La couture entre le profil et les onglets (thèmes à décor). */}
        <BioDivider palette={palette} className="relative" />

        {/* Liens / Boutique switch */}
        <div
          className="relative mx-auto mt-3 grid w-36 grid-cols-2 rounded-full p-0.5 text-[10px] font-semibold"
          style={bioTabTrackStyle(palette)}
        >
          <span
            className="rounded-full py-1 text-center"
            style={bioTabStyle(palette, true)}
          >
            Liens
          </span>
          <span
            className={cn(
              "flex items-center justify-center gap-1 rounded-full py-1 text-center",
              !decor && "opacity-70",
            )}
            style={bioTabStyle(palette, false)}
          >
            Boutique
            {decor?.highlight && (
              <span
                className="rounded-full px-1 text-[8px] font-bold leading-[12px]"
                style={{
                  backgroundColor: "var(--bio-highlight)",
                  color: "var(--bio-highlight-text)",
                }}
              >
                {SAMPLE_PRODUCTS.length}
              </span>
            )}
          </span>
        </div>

        {/* Link buttons */}
        <div className="relative mt-3 space-y-2">
          {SAMPLE_LINKS.map((label) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 p-1.5 text-[11px] font-semibold",
                // La lisière de 5 px du Pagne tissé mordrait sur la tuile.
                decor?.selvedge && ctaShape !== "pill" && "pl-3",
                ctaShapeClass,
              )}
              style={buttonStyle}
            >
              <span
                className={cn("flex size-7 items-center justify-center", ctaShapeClass)}
                style={tile}
              >
                <Link2 className="size-3" />
              </span>
              <span className="flex-1 text-center">{label}</span>
              <MoreVertical className="size-3 opacity-50" />
            </div>
          ))}
        </div>

        {/* Products */}
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          {SAMPLE_PRODUCTS.map((p) => (
            <div
              key={p.name}
              className={cn("overflow-hidden", radiusClass)}
              style={cardStyle}
            >
              <div
                className="flex aspect-square w-full items-center justify-center text-2xl"
                // Le filet entre la photo et le corps : une photo à fond blanc
                // paraîtrait « sale » sur le sable ou la crème.
                style={decor ? { borderBottom: `1px solid ${palette.border}` } : undefined}
              >
                {p.emoji}
              </div>
              <div className="p-1.5">
                <p className="line-clamp-1 text-[9px] font-medium">{p.name}</p>
                {priceBadge ? (
                  <p
                    className="mt-0.5 inline-block rounded px-1 py-px text-[10px] font-bold leading-tight"
                    style={priceBadge}
                  >
                    {formatPrice(p.price, "XOF")}
                  </p>
                ) : (
                  <p className="text-[10px] font-bold">{formatPrice(p.price, "XOF")}</p>
                )}
                {/* « Commander » pleine largeur, encre sur vert : sur tous les thèmes. */}
                <p
                  className="mt-1 flex h-4 items-center justify-center gap-0.5 rounded text-[8px] font-bold"
                  style={whatsappButtonStyle("inline")}
                >
                  <MessageCircle className="size-2" />
                  Commander
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        {showBadge && (
          <div className="relative mt-4 flex justify-center">
            <span
              className="rounded-full px-3 py-1.5 text-[9px] font-semibold"
              // La même pastille que sur la page (ombre dure comprise).
              style={bioTopBarPillStyle(palette)}
            >
              Crée ta page sur Bio-Lien
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
