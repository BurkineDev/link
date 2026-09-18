import type { CSSProperties } from "react";
import {
  bioAvatarRingStyle,
  bioButtonStyle,
  bioCardStyle,
  bioPriceBadgeStyle,
  bioRaise,
  bioTopBarPillStyle,
  contrastRatio,
  mixHex,
  withAlpha,
  type BioPalette,
} from "@/lib/bio-themes";

/**
 * Décor des thèmes « Afrique de l'Ouest » dans les images de story.
 *
 * La page publique dessine sa zone haute, sa couture et ses reliefs avec des
 * utilitaires CSS qui lisent des variables `--bio-*`, du `color-mix`, des
 * pseudo-éléments et des dégradés répétés. satori, le moteur de next/og, ne
 * connaît rien de tout cela : ni `var()`, ni `color-mix`, ni `::before`, ni
 * `mask-image`, chaque boîte à plusieurs enfants doit être un flex et une
 * propriété à `undefined` est une erreur (on omet la clé). On refait donc
 * ici la même construction avec des `div` et des couleurs
 * précalculées en hex, à partir des mêmes helpers de bio-themes.ts, pour que
 * la story ressemble à la page que le visiteur découvrira en scannant.
 *
 * Sans `decor`, chaque helper renvoie exactement ce que la story peignait
 * déjà : les dix thèmes historiques et « Mes couleurs » ne bougent pas.
 *
 * Partagé par /api/story/[slug] et /api/story/[slug]/[productSlug] ; ce
 * fichier n'est pas une route (seul route.tsx l'est).
 */

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
/** Marge latérale des deux stories ; les coutures pleine largeur la débordent. */
export const STORY_GUTTER = 72;

/**
 * La page se lit sur ~390 px, la story fait 1080 : filets, ombres, anneaux
 * et tuiles sont doublés (le texte suit déjà sa propre échelle).
 */
const SCALE = 2;

/**
 * Hauteur de la bande d'en-tête (Wax, Pagne tissé). 1080 × 320 garde à peu
 * près le rapport de la bande tissée de la page ; l'avatar de la story de
 * page et la carte de la story produit y chevauchent la lisière, comme sur
 * la page.
 */
export const STORY_BAND_HEIGHT = 320;

/**
 * Le lavis (Bogolan, Indigo) monte plus haut que ×2 : il doit encore se
 * voir derrière un nom de boutique écrit en 76 px.
 */
const WASH_SCALE = 2.5;

/** Rendu historique des pastilles et boutons de la story, avant tout décor. */
function legacySurfaceStyle(palette: BioPalette): CSSProperties {
  return {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `2px solid ${palette.border}`,
  };
}

/**
 * Multiplie chaque longueur en px d'une valeur CSS
 * (« 1px solid #1C1714 » → « 2px solid #1C1714 », « 0 3px 0 0 » → « 0 6px 0 0 »).
 */
export function scalePx(value: string, factor: number = SCALE): string {
  return value.replace(
    /(-?\d*\.?\d+)px/g,
    (_, n: string) => `${Number(n) * factor}px`,
  );
}

/**
 * Passe un style de la page à l'échelle de la story et retire ce que satori
 * ne sait pas rendre (flou d'arrière-plan, police en `var()`).
 */
function toStoryStyle(style: CSSProperties): CSSProperties {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (key === "backdropFilter" || key === "fontFamily") continue;
    out[key] = typeof value === "string" ? scalePx(value) : value;
  }
  return out as CSSProperties;
}

// ---------------------------------------------------------------------------
// Zone haute
// ---------------------------------------------------------------------------

/** Hauteur de la zone haute dans la story ; 0 sans décor d'en-tête. */
export function storyHeaderHeight(palette: BioPalette): number {
  const header = palette.decor?.header;
  if (!header) return 0;
  return header.kind === "band"
    ? STORY_BAND_HEIGHT
    : Math.round(header.height * WASH_SCALE);
}

/** Vrai quand la zone haute est une bande pleine sur laquelle flottent les pastilles. */
export function storyHasBand(palette: BioPalette): boolean {
  return palette.decor?.header?.kind === "band";
}

/** Largeur de la tuile, lue dans `size` (« 48px 48px » → 48). */
function tileWidth(size: string): number {
  const match = /(\d*\.?\d+)px/.exec(size);
  return match ? Number(match[1]) : 0;
}

/**
 * Position de la tuile pour satori, qui ne lit que des longueurs : une paire
 * en px est doublée ; un mot-clé (« center top » sur Indigo) devient le
 * décalage qui centre la rangée de tuiles sur la largeur de la story.
 */
function storyPatternPosition(
  position: string | undefined,
  tile: number,
): string {
  if (!position) return "0px 0px";
  if (/^-?\d*\.?\d+px -?\d*\.?\d+px$/.test(position)) return scalePx(position);
  const x =
    position.includes("center") && tile > 0
      ? Math.round((STORY_WIDTH % tile) / 2)
      : 0;
  return `${x}px 0px`;
}

/**
 * Style satori de la tuile du thème : la même data-URI que la page, taille
 * et position doublées, répétée dans les deux sens, à l'opacité du décor.
 */
export function storyPatternStyle(
  palette: BioPalette,
): CSSProperties | undefined {
  const pattern = palette.decor?.pattern;
  if (!pattern) return undefined;
  const tile = tileWidth(pattern.size) * SCALE;
  return {
    backgroundImage: pattern.image,
    backgroundSize: scalePx(pattern.size),
    backgroundPosition: storyPatternPosition(pattern.position, tile),
    backgroundRepeat: "repeat",
    opacity: pattern.opacity,
  };
}

const layer = (height: number): CSSProperties => ({
  position: "absolute",
  top: 0,
  left: 0,
  width: STORY_WIDTH,
  height,
  display: "flex",
});

/**
 * Lisière festonnée de Wax : la page la fait d'un dégradé radial répété ;
 * ici une rangée de disques de la bande, centrés sur son bord, qui mordent
 * sur la crème.
 */
function StoryScallop({ fill, edge }: { fill: string; edge: number }) {
  const period = 16 * SCALE;
  const diameter = 13 * SCALE;
  const count = Math.ceil(STORY_WIDTH / period);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: edge - diameter / 2,
        display: "flex",
        gap: period - diameter,
        paddingLeft: (period - diameter) / 2,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: diameter,
            height: diameter,
            borderRadius: 999,
            backgroundColor: fill,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Fils de chaîne de Pagne tissé : deux fils du fond et un fil d'ocre par
 * période de 72 px sur la page (144 ici), sous le motif.
 */
function StoryWarpThreads({
  palette,
  height,
}: {
  palette: BioPalette;
  height: number;
}) {
  const ground = palette.backgroundSolid;
  const ochre = palette.decor?.highlight?.bg ?? palette.accent;
  const period = 72 * SCALE;
  const count = Math.ceil(STORY_WIDTH / period);
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 12 * SCALE,
        height,
        display: "flex",
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: period,
            height,
            paddingLeft: 26 * SCALE,
            gap: 6 * SCALE,
          }}
        >
          <div style={{ width: 2 * SCALE, height, backgroundColor: ground }} />
          <div style={{ width: 3 * SCALE, height, backgroundColor: ochre }} />
          <div style={{ width: 2 * SCALE, height, backgroundColor: ground }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Zone haute de la story, à poser en premier enfant de la racine : un lavis
 * (tuile fondue vers le fond, deux calques) ou une bande pleine à motif
 * fermée par sa lisière. Un seul `div` enveloppant : satori ne connaît pas
 * les fragments. `null` sans décor d'en-tête.
 */
export function StoryHeaderDecor({ palette }: { palette: BioPalette }) {
  const header = palette.decor?.header;
  if (!header) return null;
  const height = storyHeaderHeight(palette);
  const pattern = storyPatternStyle(palette);

  if (header.kind === "wash") {
    const fade = header.fade ?? 35;
    return (
      <div style={layer(height)}>
        {pattern ? <div style={{ ...layer(height), ...pattern }} /> : null}
        <div
          style={{
            ...layer(height),
            // Le même fond à opacité 0 plutôt que `transparent` : un
            // dégradé SVG interpole couleur et opacité séparément, et un
            // noir transparent assombrirait le milieu du fondu.
            backgroundImage: `linear-gradient(to bottom, ${withAlpha(palette.backgroundSolid, 0)} ${fade}%, ${palette.backgroundSolid} 100%)`,
          }}
        />
      </div>
    );
  }

  const selvedge = header.edge === "selvedge";
  return (
    <div
      style={{
        ...layer(height),
        backgroundColor: header.fill,
        // Sous la bande tissée, trois fils cousus en ombres dures (fond,
        // indigo, ocre), comme le box-shadow de .bio-band-selvedge. Clé
        // omise sinon : satori refuse un `boxShadow: undefined`.
        ...(selvedge
          ? {
              boxShadow: `0 ${2 * SCALE}px 0 ${palette.backgroundSolid}, 0 ${4 * SCALE}px 0 ${header.fill}, 0 ${6 * SCALE}px 0 ${palette.decor?.highlight?.bg ?? palette.accent}`,
            }
          : {}),
      }}
    >
      {selvedge ? <StoryWarpThreads palette={palette} height={height} /> : null}
      {pattern ? <div style={{ ...layer(height), ...pattern }} /> : null}
      {header.edge === "scallop" ? (
        <StoryScallop fill={header.fill} edge={height} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Couture
// ---------------------------------------------------------------------------

/**
 * Couleur du fond de la frise bogolan : le jumeau hex du
 * `color-mix(text 10 %, fond)` de la page (#DED4C4 sur Bogolan).
 */
export function storyFriezeColor(palette: BioPalette): string {
  return mixHex(palette.text, palette.backgroundSolid, 0.1);
}

/** Largeur de la colonne de contenu, entre les deux marges. */
const CONTENT_WIDTH = STORY_WIDTH - 2 * STORY_GUTTER;

/** Une rangée de points ou de tirets, centrée : sert aux coutures dots, toron et stitch. */
function StoryRow({
  count,
  width,
  height,
  gap,
  color,
  radius,
  marginTop,
  opacity,
}: {
  count: number;
  width: number;
  height: number;
  gap: number;
  color: string;
  radius: number;
  marginTop: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap,
        marginTop,
        flexShrink: 0,
        ...(opacity !== undefined ? { opacity } : {}),
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{ width, height, borderRadius: radius, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

/**
 * La couture du thème, entre le bloc profil et les boutons (ou entre le
 * produit et le QR) : frise bogolan pleine largeur, rangée de points de Wax,
 * toron d'Indigo, point de piqûre de Pagne tissé. `null` sans décor.
 */
export function StoryDivider({ palette }: { palette: BioPalette }) {
  const divider = palette.decor?.divider;
  if (!divider) return null;

  switch (divider) {
    case "frieze": {
      // Même tuile que le lavis, mais seule la rangée du zigzag est visible
      // (repeat-x, boîte moins haute que la tuile), à pleine opacité entre
      // deux filets d'encre, et sur toute la largeur de l'image.
      const pattern = storyPatternStyle(palette);
      return (
        <div
          style={{
            width: STORY_WIDTH,
            height: 18 * SCALE,
            marginTop: 22 * SCALE,
            flexShrink: 0,
            display: "flex",
            borderTop: `${SCALE}px solid ${palette.border}`,
            borderBottom: `${SCALE}px solid ${palette.border}`,
            backgroundColor: storyFriezeColor(palette),
            ...pattern,
            backgroundPosition: `${3 * SCALE}px ${1 * SCALE}px`,
            backgroundRepeat: "repeat-x",
            opacity: 1,
          }}
        />
      );
    }
    case "dots":
      // La bordure de pagne : onze points d'accent, 132 px sur la page.
      return (
        <StoryRow
          count={11}
          width={4 * SCALE}
          height={4 * SCALE}
          gap={8 * SCALE}
          radius={999}
          color={palette.accent}
          marginTop={20 * SCALE}
        />
      );
    case "toron": {
      // Les pieux de rônier : sable à 55 % sur l'indigo, sur toute la colonne.
      const period = 12 * SCALE;
      const size = 4 * SCALE;
      return (
        <StoryRow
          count={Math.floor((CONTENT_WIDTH + period - size) / period)}
          width={size}
          height={size}
          gap={period - size}
          radius={999}
          color={mixHex(palette.surface, palette.backgroundSolid, 0.55)}
          marginTop={20 * SCALE}
        />
      );
    }
    case "stitch": {
      // Le point de piqûre : tirets de 6 px, pas de 11 px sur la page.
      const dash = 6 * SCALE;
      const gap = 5 * SCALE;
      return (
        <StoryRow
          count={Math.floor((CONTENT_WIDTH + gap) / (dash + gap))}
          width={dash}
          height={SCALE}
          gap={gap}
          radius={0}
          color={palette.border}
          marginTop={18 * SCALE}
          opacity={0.55}
        />
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Reliefs : pastilles, boutons, cartes, avatar, prix
// ---------------------------------------------------------------------------

/**
 * Pastille de la barre haute (« Bio-Lien », identité de la boutique). Sans
 * décor, le rendu historique ; avec, la même règle que la page : fond de
 * page + texte accent quand elle flotte sur une bande, sinon la surface,
 * avec l'ombre dure des thèmes en relief.
 */
export function storyPillStyle(palette: BioPalette): CSSProperties {
  if (!palette.decor) return legacySurfaceStyle(palette);
  return toStoryStyle(
    bioTopBarPillStyle(palette, { overHeader: storyHasBand(palette) }),
  );
}

/**
 * Bouton de lien (faux boutons de la story de page, pastille d'URL). Sans
 * décor, le rendu historique ; avec, bioButtonStyle() à l'échelle : filet
 * + ombre dure, bordure 2 px cobalt, lisière indigo hors forme pilule.
 */
export function storyButtonStyle(
  palette: BioPalette,
  options: { pill?: boolean } = {},
): CSSProperties {
  if (!palette.decor) return legacySurfaceStyle(palette);
  return toStoryStyle(bioButtonStyle(palette, options));
}

/**
 * Carte du visuel produit. Sans décor, le cadre historique (surface, 6 px
 * de la même couleur) ; avec, bioCardStyle() à l'échelle : carte blanche
 * bordée de cobalt pour Wax, sable à ombre terracotta pour Indigo…
 */
export function storyCardStyle(palette: BioPalette): CSSProperties {
  if (!palette.decor) {
    return {
      backgroundColor: palette.surface,
      border: `6px solid ${palette.surface}`,
    };
  }
  return toStoryStyle(bioCardStyle(palette));
}

/** Ombre dure des éléments en relief, à l'échelle ; `undefined` sans décor. */
export function storyRaise(palette: BioPalette): string | undefined {
  const raise = bioRaise(palette);
  return raise ? scalePx(raise) : undefined;
}

/**
 * Avatar de la story de page. Sans décor : le cadre historique (6 px de
 * surface autour d'une photo, filet 2 px autour des initiales). Avec : les
 * couleurs du disque d'initiales suivent la page (fond de page + accent sur
 * une bande, sinon surface), le filet 2 px de la page devient 4 px sauf pour
 * les anneaux moutarde de Wax, et l'anneau du thème est doublé.
 */
export function storyAvatarStyle(
  palette: BioPalette,
  kind: "image" | "initials",
): CSSProperties {
  const decor = palette.decor;
  if (!decor) {
    return kind === "image"
      ? { border: `6px solid ${palette.surface}` }
      : {
          backgroundColor: palette.surface,
          color: palette.surfaceText,
          border: `2px solid ${palette.border}`,
        };
  }
  const ring = bioAvatarRingStyle(palette);
  const colors: CSSProperties =
    kind === "image"
      ? {}
      : storyHasBand(palette)
        ? { backgroundColor: palette.backgroundSolid, color: palette.accent }
        : { backgroundColor: palette.surface, color: palette.surfaceText };
  return {
    ...colors,
    ...(decor.avatarRing === "highlight"
      ? {}
      : { border: `${2 * SCALE}px solid ${palette.border}` }),
    ...(ring ? toStoryStyle(ring) : {}),
  };
}

/** En dessous, une pastille se fond dans le fond de page (même seuil que les boutons de « Mes couleurs »). */
const MIN_BADGE_CONTRAST = 1.6;

/**
 * Pastille de prix (story produit) : couleurs de `decor.highlight`, sans la
 * police en `var()` que satori ne résoudrait pas. `undefined` sans rehaut :
 * le prix garde son rendu historique en accent.
 *
 * Sur la page, la pastille est posée sur une carte produit ; dans la story
 * elle est posée sur le fond de page. Quand le rehaut est ce fond (Indigo :
 * pastille indigo sur nuit indigo), elle passe en surface, avec l'ombre dure
 * du thème — le prix se lit alors comme un bouton sable, pas comme du texte.
 */
export function storyPriceBadgeStyle(
  palette: BioPalette,
): CSSProperties | undefined {
  const badge = bioPriceBadgeStyle(palette);
  if (!badge) return undefined;
  const bg = String(badge.backgroundColor);
  if (contrastRatio(bg, palette.backgroundSolid) >= MIN_BADGE_CONTRAST) {
    return { backgroundColor: bg, color: badge.color };
  }
  const raise = storyRaise(palette);
  return {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    ...(raise ? { boxShadow: raise } : {}),
  };
}
