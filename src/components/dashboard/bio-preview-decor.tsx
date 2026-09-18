import type { CSSProperties } from "react";
import { bioButtonStyle, bioCardStyle, type BioPalette } from "@/lib/bio-themes";
import { BioHeaderDecor } from "@/components/shop/bio-theme-decor";

/**
 * Plomberie commune aux deux aperçus de la page bio (ThemePreview des
 * réglages et de l'onboarding, BioPagePreview du Page Builder) : le décor de
 * tête réduit, la bannière fondue, le décalage du profil sur une bande et
 * les styles sans flou. Un seul endroit, sinon les deux aperçus divergent et
 * l'un des deux ment au vendeur.
 */

/**
 * Les aperçus sont des pages réduites (texte à 10–11 px, avatar de 56 ou
 * 64 px au lieu de 96). Le décor de tête est rendu par le composant de la
 * page, à ses hauteurs réelles, puis réduit d'un facteur unique — même code,
 * même proportion, aucune valeur de thème recopiée ici.
 */
export const PREVIEW_DECOR_SCALE = 0.6;

/** Le lavis ou la bande de la page, réduits, en premier enfant de la racine `relative`. */
export function PreviewHeaderDecor({
  palette,
  hasBanner,
}: {
  palette: BioPalette;
  hasBanner: boolean;
}) {
  if (!palette.decor?.header || hasBanner) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 origin-top-left"
      style={{
        width: `${100 / PREVIEW_DECOR_SCALE}%`,
        transform: `scale(${PREVIEW_DECOR_SCALE})`,
      }}
    >
      <BioHeaderDecor palette={palette} hasBanner={hasBanner} />
    </div>
  );
}

/** La bannière de la boutique, fondue dans le fond de page comme sur la page. */
export function PreviewBanner({
  url,
  palette,
}: {
  url: string;
  palette: BioPalette;
}) {
  return (
    <div className="absolute inset-x-0 top-0 h-24 overflow-hidden">
      {/* Aperçu local : pas d'optimisation d'image nécessaire. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${palette.backgroundSolid}40, ${palette.backgroundSolid})`,
        }}
      />
    </div>
  );
}

/**
 * Sur la page, l'avatar chevauche la lisière de la bande (−48 px). Dans un
 * aperçu, on décale le profil pour que le centre de l'avatar tombe sur la
 * lisière de la bande réduite ; `contentTop` est ce qui précède déjà le
 * profil (barre haute ou marge de la colonne). Sans bande (lavis, bannière,
 * thème historique) : `undefined`, l'aperçu garde sa marge d'origine.
 */
export function previewProfileOffset(
  palette: BioPalette,
  options: { hasBanner: boolean; avatarSize: number; contentTop: number },
): number | undefined {
  const header = palette.decor?.header;
  if (options.hasBanner || header?.kind !== "band") return undefined;
  return Math.max(
    0,
    header.height * PREVIEW_DECOR_SCALE -
      options.avatarSize / 2 -
      options.contentTop,
  );
}

/**
 * Un flou d'arrière-plan (variant verre de Minuit) dans un aperçu de 300 px
 * ne montre rien de plus et coûte une couche de composition par élément :
 * les aperçus s'en passent, sur les boutons comme sur les cartes.
 */
function withoutBlur(style: CSSProperties): CSSProperties {
  const out = { ...style };
  delete out.backdropFilter;
  return out;
}

/** bioButtonStyle() sans flou, pour les faux boutons des aperçus. */
export function previewButtonStyle(
  palette: BioPalette,
  options: { pill?: boolean } = {},
): CSSProperties {
  return withoutBlur(bioButtonStyle(palette, options));
}

/** bioCardStyle() sans flou, pour les fausses cartes produit des aperçus. */
export function previewCardStyle(palette: BioPalette): CSSProperties {
  return withoutBlur(bioCardStyle(palette));
}
