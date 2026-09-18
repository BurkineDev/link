/**
 * Bio page themes — the full-page palettes used by the public page at /{slug}.
 *
 * A bio page is one scrollable column on a coloured background: whatever the
 * seller picks here decides the page background, the button surface and every
 * text colour on top of them. Keeping the palettes in one typed table (rather
 * than scattered Tailwind classes) means the storefront, the dashboard picker
 * and the live preview all read the exact same values.
 *
 * Les thèmes « Afrique de l'Ouest » (bogolan, wax, indigo, pagne) portent en
 * plus un `decor` : motif tuilé, bande ou lavis d'en-tête, couture entre les
 * réseaux et les onglets, anneau d'avatar, pastille de prix, paire de polices.
 * Tout ce qui touche au décor est conditionné à ce champ : les dix thèmes
 * historiques n'en ont pas et rendent donc exactement comme avant.
 *
 * Framework-free on purpose: pure data + pure functions, so the contrast
 * rules are unit-testable without a DOM.
 */

import type { CSSProperties } from "react";
import {
  BIO_DISPLAY_FONTS,
  DEFAULT_FONT_FAMILY,
  SHOP_FONTS,
  WHATSAPP_GREEN,
  WHATSAPP_INK,
} from "@/lib/constants";
import type { ShopFontFamily } from "@/lib/types/database";

/**
 * L'ordre est celui du sélecteur (réglages et onboarding) : l'Afrique de
 * l'Ouest en tête, les classiques ensuite, « Mes couleurs » en dernier.
 */
export const BIO_THEME_IDS = [
  "bogolan",
  "wax",
  "indigo",
  "pagne",
  "sahel",
  "kente",
  "classic",
  "noir",
  "lagoon",
  "sunset",
  "mint",
  "lavender",
  "midnight",
  "brand",
] as const;

export type BioThemeId = (typeof BIO_THEME_IDS)[number];

/** How link buttons are painted on top of the page background. */
export type BioButtonVariant = "solid" | "outline" | "shadow" | "glass";

/** Intertitres du sélecteur : chaque preset appartient à un groupe. */
export type BioThemeGroup = "afrique" | "classique" | "perso";

export const BIO_THEME_GROUPS: Record<BioThemeGroup, string> = {
  afrique: "Afrique de l'Ouest",
  classique: "Classiques",
  perso: "Mes couleurs",
};

const BIO_THEME_GROUP_ORDER: readonly BioThemeGroup[] = [
  "afrique",
  "classique",
  "perso",
];

// ---------------------------------------------------------------------------
// Décor — types
// ---------------------------------------------------------------------------

/** Tuiles SVG disponibles ; la couleur est cuite dans le SVG à la demande. */
export type BioPatternId = "bogolan" | "wax" | "thioup" | "pagne";

/** Polices d'affiche (nom, titres de groupe, chiffres du prix). */
export type BioDisplayFontId = keyof typeof BIO_DISPLAY_FONTS;

/**
 * Couleur de rehaut — pastille de prix, compteur d'onglet, anneau d'avatar.
 * `text` s'écrit dessus ; on n'écrit jamais du texte en `bg` ailleurs.
 */
export interface BioHighlight {
  bg: string;
  text: string;
}

/** Zone haute de la page quand la boutique n'a pas de bannière. */
export type BioHeaderDecor =
  /**
   * Lavis : la tuile fondue vers le fond avant le nom (Bogolan 220, Indigo
   * 208). `fade` est la hauteur, en pourcentage, à partir de laquelle le
   * fondu commence (35 par défaut ; Indigo le repousse à 46 pour que les
   * anneaux restent visibles sur un LCD).
   */
  | { kind: "wash"; height: number; fade?: number }
  /**
   * Bande pleine portant le motif, fermée par une lisière : demi-disques
   * festonnés (Wax) ou trois fils cousus (Pagne tissé).
   */
  | { kind: "band"; height: number; fill: string; edge?: "scallop" | "selvedge" };

/** Couture entre les réseaux et les onglets — un seul emplacement, une peau par thème. */
export type BioDividerKind = "frieze" | "dots" | "toron" | "stitch";

/** Piste des onglets Liens / Boutique. */
export type BioTabsKind = "outline" | "raised";

/** Anneau d'avatar : remplace le `shadow-lg` flouté dès qu'un décor existe. */
export type BioAvatarRing = "double" | "highlight" | "raise";

export interface BioDecor {
  /** Motif tuilé : data-URI de bioPatternDataUri(id, ink), couleur cuite dans le SVG. */
  pattern?: { image: string; size: string; opacity: number; position?: string };
  header?: BioHeaderDecor;
  divider?: BioDividerKind;
  tabs?: BioTabsKind;
  /** Bordure marquée 2 px `border` sur boutons, cartes, chips. */
  buttonBorder?: "bold";
  /** Lisière de 5 px sur le bord gauche des boutons (désactivée en forme pilule). */
  selvedge?: boolean;
  /** Étend l'ombre dure `0 3px 0 0 border` aux cartes, à l'avatar, aux pastilles et à l'onglet actif. */
  raise?: boolean;
  avatarRing?: BioAvatarRing;
  highlight?: BioHighlight;
  /** Petit texte lisible sur `surface` (sous-titres, « FCFA ») — défaut : `muted`. */
  surfaceMuted?: string;
  /** Cartes produit qui ne suivent pas `surface` (Wax : crème plutôt que cobalt). */
  card?: { bg: string; text: string };
  /**
   * Paire de polices du thème — appliquée seulement si le vendeur n'a pas
   * choisi de police (font_family === "sans"), voir bioFontVars().
   */
  fontPreset?: { display: BioDisplayFontId; body: ShopFontFamily };
}

export interface BioThemePreset {
  id: BioThemeId;
  label: string;
  description: string;
  group: BioThemeGroup;
  /** Brightness of the *background*, not of the text. Drives icon tints. */
  scheme: "light" | "dark";
  /** Any CSS background value — a flat colour or a gradient. */
  background: string;
  /** Solid colour approximating `background`, for meta theme-color / previews. */
  backgroundSolid: string;
  text: string;
  muted: string;
  surface: string;
  surfaceText: string;
  border: string;
  accent: string;
  buttonVariant: BioButtonVariant;
  decor?: BioDecor;
}

/**
 * Thème des nouvelles boutiques : présélectionné à l'onboarding, posé à la
 * création et repli d'une valeur inconnue en base. Les boutiques existantes
 * gardent ce qu'elles ont (le défaut Prisma reste « classic », sans migration).
 */
export const DEFAULT_BIO_THEME: BioThemeId = "wax";

// ---------------------------------------------------------------------------
// Motifs — tuiles SVG cuites en data-URI
// ---------------------------------------------------------------------------

/**
 * SVG bruts avec un jeton `{{ink}}` à la place de la couleur. Une seule tuile
 * par thème, partagée par la page, les aperçus et les stories ; chacune tient
 * sous 1 Ko une fois encodée, ce qui compte sur une page ouverte en 3G.
 *
 * - bogolan : trois registres (zigzag, losanges creux, rangée de points), 48×48.
 * - wax : grands disques concentriques décalés et craquelures de cire, 96×96.
 * - thioup : anneaux de teinture à réserve en quinconce, 56×56.
 * - pagne : fils de chaîne aux bords et losange à gradins inséré en trame, 48×48.
 */
export const BIO_PATTERNS: Record<BioPatternId, string> = {
  bogolan:
    "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>" +
    "<path d='M-6 3l6 9 6-9 6 9 6-9 6 9 6-9 6 9 6-9 6 9 6-9' fill='none' stroke='{{ink}}' stroke-width='2.2' stroke-linejoin='miter' stroke-linecap='square'/>" +
    "<path d='M12 18l6 6-6 6-6-6zM36 18l6 6-6 6-6-6z' fill='none' stroke='{{ink}}' stroke-width='2'/>" +
    "<path d='M6 40h0M18 40h0M30 40h0M42 40h0' stroke='{{ink}}' stroke-width='4.4' stroke-linecap='round'/>" +
    "</svg>",
  wax:
    "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>" +
    "<g fill='none' stroke='{{ink}}' stroke-width='1.8'>" +
    "<circle cx='48' cy='48' r='34'/><circle cx='48' cy='48' r='26'/><circle cx='48' cy='48' r='6'/>" +
    "<circle cx='0' cy='0' r='14'/><circle cx='96' cy='0' r='14'/><circle cx='0' cy='96' r='14'/><circle cx='96' cy='96' r='14'/>" +
    "<path d='M18 80l4-3 3-4M71 12l4-3 3-4M10 42l5 2 2 5M81 50l5 2 2 5' stroke-width='1.2'/>" +
    "</g></svg>",
  thioup:
    "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>" +
    "<g fill='none' stroke='{{ink}}' stroke-width='1.2'>" +
    "<circle cx='28' cy='28' r='6'/><circle cx='28' cy='28' r='12.7' stroke-dasharray='2.7 3'/>" +
    "<circle cx='0' cy='0' r='6'/><circle cx='56' cy='0' r='6'/><circle cx='0' cy='56' r='6'/><circle cx='56' cy='56' r='6'/>" +
    "</g><g fill='{{ink}}'>" +
    "<circle cx='28' cy='28' r='1.6'/><circle cx='0' cy='0' r='1.6'/><circle cx='56' cy='0' r='1.6'/><circle cx='0' cy='56' r='1.6'/><circle cx='56' cy='56' r='1.6'/>" +
    "</g></svg>",
  pagne:
    "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>" +
    "<g fill='{{ink}}' stroke='{{ink}}'>" +
    "<path d='M2.5 0v48M45.5 0v48M8 24.5h6M34 24.5h6' fill='none' stroke-width='1'/>" +
    "<path d='M22 14h4v4h4v4h4v4h-4v4h-4v4h-4v-4h-4v-4h-4v-4h4v-4h4zM22 22h4v4h-4z' stroke='none' fill-rule='evenodd'/>" +
    "</g></svg>",
};

/**
 * Tuile prête pour `background-image` : `url("data:image/svg+xml,…")`.
 *
 * La couleur est cuite dans le SVG parce qu'une image de fond ne lit ni
 * `currentColor` ni les variables CSS. Seuls `#`, `<` et `>` sont encodés :
 * c'est ce qu'exigent les navigateurs, et le reste (guillemets simples,
 * espaces) passe tel quel dans un `url("…")`, ce qui garde la tuile courte.
 */
export function bioPatternDataUri(id: BioPatternId, ink: string): string {
  const svg = BIO_PATTERNS[id].replace(/\{\{ink\}\}/g, ink);
  const encoded = svg
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E");
  return `url("data:image/svg+xml,${encoded}")`;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** La même paire pour les quatre thèmes afrique : Ojuju en titre, Atkinson en corps. */
const AFRIQUE_FONTS: NonNullable<BioDecor["fontPreset"]> = {
  display: "ojuju",
  body: "atkinson",
};

export const BIO_THEMES: Record<BioThemeId, BioThemePreset> = {
  bogolan: {
    id: "bogolan",
    label: "Bogolan",
    description:
      "Crème coton, noir de boue, ocre cuit — mat, artisanal, très lisible au soleil.",
    group: "afrique",
    scheme: "light",
    background: "#F3E9D8",
    backgroundSolid: "#F3E9D8",
    text: "#1C1714",
    muted: "#5C4B3E",
    // Surface et fond sont volontairement proches (même coton) : la
    // séparation vient du filet d'encre et de l'ombre dure du variant shadow.
    surface: "#FBF7EF",
    surfaceText: "#1C1714",
    border: "#1C1714",
    accent: "#A3481A",
    buttonVariant: "shadow",
    decor: {
      pattern: {
        image: bioPatternDataUri("bogolan", "#1C1714"),
        size: "48px 48px",
        opacity: 0.08,
      },
      header: { kind: "wash", height: 220 },
      divider: "frieze",
      tabs: "outline",
      raise: true,
      avatarRing: "double",
      highlight: { bg: "#A3481A", text: "#FBF7EF" },
      surfaceMuted: "#5C4B3E",
      fontPreset: AFRIQUE_FONTS,
    },
  },
  wax: {
    id: "wax",
    label: "Wax",
    description:
      "Cobalt et moutarde sur crème, bande imprimée de disques — l'énergie du marché, sans surcharge.",
    group: "afrique",
    scheme: "light",
    background: "#FFFBF2",
    backgroundSolid: "#FFFBF2",
    text: "#17171C",
    muted: "#5A5A64",
    // Les boutons de liens sont des aplats cobalt ; les cartes produit
    // repassent en blanc via decor.card pour ne pas faire un mur de bleu.
    surface: "#1748A8",
    surfaceText: "#FFFFFF",
    border: "#1748A8",
    accent: "#1748A8",
    buttonVariant: "solid",
    decor: {
      pattern: {
        image: bioPatternDataUri("wax", "#FFFBF2"),
        size: "96px 96px",
        opacity: 0.2,
        position: "24px 12px",
      },
      header: { kind: "band", height: 172, fill: "#1748A8", edge: "scallop" },
      divider: "dots",
      tabs: "outline",
      buttonBorder: "bold",
      avatarRing: "highlight",
      highlight: { bg: "#F2B705", text: "#17171C" },
      surfaceMuted: "#DCE4F2",
      card: { bg: "#FFFFFF", text: "#17171C" },
      fontPreset: AFRIQUE_FONTS,
    },
  },
  indigo: {
    id: "indigo",
    label: "Indigo",
    description:
      "Nuit indigo, boutons sable et ombres nettes terracotta. Chic, lisible partout.",
    group: "afrique",
    scheme: "dark",
    // Fond plat : un dégradé indigo bande sur les LCD 6 bits des Tecno/Infinix.
    background: "#141E3D",
    backgroundSolid: "#141E3D",
    text: "#F2EBDC",
    muted: "#C4BBA4",
    surface: "#EAD9B8",
    surfaceText: "#141E3D",
    border: "#C2643A",
    accent: "#EE9468",
    buttonVariant: "shadow",
    decor: {
      pattern: {
        image: bioPatternDataUri("thioup", "#EAD9B8"),
        size: "56px 56px",
        opacity: 0.14,
        position: "center top",
      },
      header: { kind: "wash", height: 208, fade: 46 },
      divider: "toron",
      tabs: "raised",
      raise: true,
      avatarRing: "raise",
      highlight: { bg: "#141E3D", text: "#F2EBDC" },
      surfaceMuted: "#3E4560",
      fontPreset: AFRIQUE_FONTS,
    },
  },
  pagne: {
    id: "pagne",
    label: "Pagne tissé",
    description:
      "Écru, indigo et un fil d'ocre — inspiré du Faso Dan Fani, en bandes très lisibles.",
    group: "afrique",
    scheme: "light",
    background: "#F7F3EA",
    backgroundSolid: "#F7F3EA",
    text: "#17181C",
    muted: "#4E5261",
    // Boutons blancs sur écru (1,11:1) : ils se détachent par la bordure
    // indigo 2 px et la lisière, d'où buttonBorder bold + selvedge.
    surface: "#FFFFFF",
    surfaceText: "#17181C",
    border: "#23407A",
    accent: "#23407A",
    buttonVariant: "solid",
    decor: {
      // Le motif n'apparaît que sur la bande d'en-tête, en écru à 16 %.
      pattern: {
        image: bioPatternDataUri("pagne", "#F7F3EA"),
        size: "48px 48px",
        opacity: 0.16,
      },
      header: { kind: "band", height: 104, fill: "#23407A", edge: "selvedge" },
      divider: "stitch",
      tabs: "outline",
      buttonBorder: "bold",
      selvedge: true,
      avatarRing: "double",
      // Ocre à texte blanc : 4,94:1 (l'écru de la page ne ferait que 4,46).
      highlight: { bg: "#B5541C", text: "#FFFFFF" },
      surfaceMuted: "#4E5261",
      fontPreset: AFRIQUE_FONTS,
    },
  },
  sahel: {
    id: "sahel",
    label: "Sahel",
    description: "Sable chaud et terre cuite — parfait pour l'artisanat.",
    group: "afrique",
    scheme: "light",
    background: "#F4EADB",
    backgroundSolid: "#F4EADB",
    text: "#4A2F17",
    muted: "#8A6A4B",
    surface: "#FFFFFF",
    surfaceText: "#4A2F17",
    border: "#E2D2BB",
    accent: "#B45309",
    buttonVariant: "shadow",
  },
  kente: {
    id: "kente",
    label: "Kente",
    description: "Vert profond et or. Un rendu premium, très haut de gamme.",
    group: "afrique",
    scheme: "dark",
    background: "#0E3B2E",
    backgroundSolid: "#0E3B2E",
    text: "#F8FAFC",
    muted: "#B9D9C9",
    surface: "#E9B949",
    surfaceText: "#14342A",
    border: "#E9B949",
    accent: "#E9B949",
    buttonVariant: "solid",
  },
  classic: {
    id: "classic",
    label: "Classique",
    description: "Fond blanc, boutons nets — lisible partout, même en plein soleil.",
    group: "classique",
    scheme: "light",
    background: "#FFFFFF",
    backgroundSolid: "#FFFFFF",
    text: "#0F172A",
    muted: "#64748B",
    surface: "#FFFFFF",
    surfaceText: "#0F172A",
    border: "#E2E8F0",
    accent: "#0F172A",
    buttonVariant: "shadow",
  },
  noir: {
    id: "noir",
    label: "Noir",
    description: "Fond sombre, contraste maximal. Économise la batterie sur OLED.",
    group: "classique",
    scheme: "dark",
    background: "#0B0B0F",
    backgroundSolid: "#0B0B0F",
    text: "#FAFAFA",
    muted: "#A1A1AA",
    surface: "#18181B",
    surfaceText: "#FAFAFA",
    border: "#2A2A31",
    accent: "#FAFAFA",
    buttonVariant: "solid",
  },
  lagoon: {
    id: "lagoon",
    label: "Lagune",
    description: "Turquoise profond, boutons blancs. Le classique des pages bio.",
    group: "classique",
    scheme: "dark",
    background: "#2E7D7B",
    backgroundSolid: "#2E7D7B",
    text: "#FFFFFF",
    muted: "#D3EDEC",
    surface: "#FFFFFF",
    surfaceText: "#123C3D",
    border: "#FFFFFF",
    accent: "#FFD9D2",
    buttonVariant: "solid",
  },
  sunset: {
    id: "sunset",
    label: "Coucher de soleil",
    description: "Dégradé chaud orange-mangue, très visible en story.",
    group: "classique",
    // Light scheme: white body text on a mango gradient never reaches a
    // readable ratio, so the warm background carries dark ink instead.
    scheme: "light",
    background:
      "linear-gradient(165deg, #FFC857 0%, #FB8C00 55%, #F4511E 100%)",
    backgroundSolid: "#FB8C00",
    text: "#3A1206",
    muted: "#6B2E10",
    surface: "#FFFFFF",
    surfaceText: "#7C2D12",
    border: "#FFFFFF",
    accent: "#7C2D12",
    buttonVariant: "solid",
  },
  mint: {
    id: "mint",
    label: "Menthe",
    description: "Vert pâle et doux — beauté, soins, bien-être.",
    group: "classique",
    scheme: "light",
    background: "#E7F6EF",
    backgroundSolid: "#E7F6EF",
    text: "#10352A",
    muted: "#4B6E62",
    surface: "#FFFFFF",
    surfaceText: "#10352A",
    border: "#C8E6D8",
    accent: "#0E7C5A",
    buttonVariant: "shadow",
  },
  lavender: {
    id: "lavender",
    label: "Lavande",
    description: "Violet clair, féminin et calme. Mode, bijoux, lifestyle.",
    group: "classique",
    scheme: "light",
    background: "#EDE9FE",
    backgroundSolid: "#EDE9FE",
    text: "#3B0764",
    muted: "#6D5B96",
    surface: "#FFFFFF",
    surfaceText: "#3B0764",
    border: "#DDD6FE",
    accent: "#6D28D9",
    buttonVariant: "shadow",
  },
  midnight: {
    id: "midnight",
    label: "Minuit",
    description: "Dégradé nuit et boutons translucides. Effet verre.",
    group: "classique",
    scheme: "dark",
    background:
      "linear-gradient(165deg, #0F172A 0%, #1E1B4B 55%, #312E81 100%)",
    backgroundSolid: "#1E1B4B",
    text: "#F8FAFC",
    muted: "#C7D2FE",
    surface: "rgba(255, 255, 255, 0.10)",
    surfaceText: "#F8FAFC",
    border: "rgba(255, 255, 255, 0.22)",
    accent: "#A5B4FC",
    buttonVariant: "glass",
  },
  brand: {
    id: "brand",
    label: "Mes couleurs",
    description:
      "Reprend la couleur primaire et la couleur d'accent de ta boutique.",
    group: "perso",
    scheme: "dark",
    // Placeholder values — resolveBioTheme() replaces them with the shop's own
    // colours. They only ever show up in a preview rendered without a shop.
    background: "#6366F1",
    backgroundSolid: "#6366F1",
    text: "#FFFFFF",
    muted: "rgba(255, 255, 255, 0.78)",
    surface: "#FFFFFF",
    surfaceText: "#312E81",
    border: "#FFFFFF",
    accent: "#FFFFFF",
    buttonVariant: "solid",
  },
};

export const BIO_THEME_LIST: BioThemePreset[] = BIO_THEME_IDS.map(
  (id) => BIO_THEMES[id],
);

export function isBioThemeId(value: unknown): value is BioThemeId {
  return (
    typeof value === "string" &&
    (BIO_THEME_IDS as readonly string[]).includes(value)
  );
}

export interface BioThemeGroupEntry {
  group: BioThemeGroup;
  label: string;
  themes: BioThemePreset[];
}

/**
 * Regroupe une liste de presets pour un sélecteur, dans l'ordre des groupes
 * (Afrique de l'Ouest, Classiques, Mes couleurs) et, à l'intérieur, dans
 * l'ordre reçu. Les groupes vides disparaissent : l'onboarding, qui retire
 * « brand », n'affiche pas d'intertitre « Mes couleurs » orphelin.
 */
export function groupBioThemes(
  themes: readonly BioThemePreset[] = BIO_THEME_LIST,
): BioThemeGroupEntry[] {
  return BIO_THEME_GROUP_ORDER.flatMap((group) => {
    const members = themes.filter((theme) => theme.group === group);
    return members.length
      ? [{ group, label: BIO_THEME_GROUPS[group], themes: members }]
      : [];
  });
}

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const DARK_INK = "#0F172A";
const LIGHT_INK = "#FFFFFF";

/** Parses `#RGB` / `#RRGGBB` into 0-255 channels. Returns null when unparsable. */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.1 relative luminance, 0 (black) → 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
}

/** WCAG contrast ratio between two colours, 1 (identical) → 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Picks the ink (near-black or white) that reads best on `background`.
 * This is what keeps a seller-chosen colour from producing white-on-yellow.
 */
export function readableTextOn(background: string): string {
  return contrastRatio(background, DARK_INK) >=
    contrastRatio(background, LIGHT_INK)
    ? DARK_INK
    : LIGHT_INK;
}

/** `#RRGGBB` + opacity → `rgba(...)`. Falls back to the input when unparsable. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Mélange sRGB de deux hex : `t` est la part de `a`, le reste vient de `b`,
 * comme `color-mix(in srgb, a t%, b)`. Sert de jumeau hexadécimal aux
 * `color-mix` de la page pour les stories (satori ne connaît pas color-mix)
 * et pour les tests de contraste. Repli sur la couleur parsable quand l'une
 * des deux ne l'est pas (dégradé, rgba).
 */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return rb ? b : a;
  const k = Math.min(1, Math.max(0, t));
  const channel = (from: number, to: number) =>
    Math.round(to + (from - to) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(ra.r, rb.r)}${channel(ra.g, rb.g)}${channel(ra.b, rb.b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Below this ratio a button would visually melt into the page background. */
const MIN_SURFACE_CONTRAST = 1.6;

export interface BioPalette {
  id: BioThemeId;
  scheme: "light" | "dark";
  background: string;
  backgroundSolid: string;
  text: string;
  muted: string;
  surface: string;
  surfaceText: string;
  border: string;
  accent: string;
  buttonVariant: BioButtonVariant;
  decor?: BioDecor;
}

export interface BioThemeSource {
  bio_theme?: string | null;
  theme_color: string;
  accent_color: string;
}

/**
 * Turns a shop row into the palette the page actually renders with.
 *
 * For every preset this is a straight lookup. For `brand` the palette is
 * derived from the seller's own two colours, with two guards: text ink is
 * chosen by contrast, and a button colour too close to the background is
 * swapped for plain white/near-black so the buttons never disappear.
 */
export function resolveBioTheme(shop: BioThemeSource): BioPalette {
  const id: BioThemeId = isBioThemeId(shop.bio_theme)
    ? shop.bio_theme
    : DEFAULT_BIO_THEME;

  if (id !== "brand") {
    const preset = BIO_THEMES[id];
    return { ...preset };
  }

  const background = hexToRgb(shop.theme_color)
    ? shop.theme_color
    : BIO_THEMES.brand.background;
  const text = readableTextOn(background);

  const wanted = hexToRgb(shop.accent_color) ? shop.accent_color : LIGHT_INK;
  const surface =
    contrastRatio(wanted, background) >= MIN_SURFACE_CONTRAST
      ? wanted
      : text === DARK_INK
        ? LIGHT_INK
        : DARK_INK;

  return {
    id: "brand",
    scheme: text === LIGHT_INK ? "dark" : "light",
    background,
    backgroundSolid: background,
    text,
    muted: withAlpha(text, 0.75),
    surface,
    surfaceText: readableTextOn(surface),
    border: surface,
    accent: text,
    buttonVariant: "solid",
  };
}

/**
 * Fill colour for a primary action sitting **on a surface card** (add to cart,
 * buy now) rather than on the page background.
 *
 * The theme's accent is picked for contrast against the page background, so it
 * can vanish on the card — pale pink on white, for instance. This walks the
 * candidates in order of brand fidelity and falls back to plain ink, which
 * always reads.
 *
 * `surface` vaut la surface de la palette par défaut ; une carte produit qui
 * ne suit pas `surface` (Wax : `decor.card.bg`) passe la sienne.
 */
export function primaryActionColor(
  palette: BioPalette,
  surface: string = palette.surface,
): string {
  for (const candidate of [palette.backgroundSolid, palette.accent]) {
    if (hexToRgb(candidate) && contrastRatio(candidate, surface) >= 3) {
      return withReadableLabel(candidate);
    }
  }
  return readableTextOn(surface);
}

/** AA threshold for the 16px semibold label sitting on a button. */
const MIN_LABEL_CONTRAST = 4.5;

/**
 * Nudges a fill darker or lighter until its best ink clears AA.
 *
 * Mid-tone brand colours land just under the threshold — indigo #6366F1
 * carries white at 4.47:1 — and the seller's hue is worth keeping, so shift
 * the fill a few percent rather than discarding it for plain ink.
 */
function withReadableLabel(color: string): string {
  let current = color;

  for (let step = 0; step < 12; step += 1) {
    const ink = readableTextOn(current);
    if (contrastRatio(current, ink) >= MIN_LABEL_CONTRAST) return current;
    // Move away from the ink that is currently winning.
    current = shift(current, ink === LIGHT_INK ? 0 : 255, 0.08);
  }

  return readableTextOn(color) === LIGHT_INK ? DARK_INK : LIGHT_INK;
}

/** Moves every channel `ratio` of the way towards `target` (0 or 255). */
function shift(hex: string, target: number, ratio: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const channel = (v: number) =>
    Math.round(v + (target - v) * ratio)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles partagés — une seule implémentation pour la page, les aperçus et
// les miniatures, sinon l'aperçu ment au vendeur.
// ---------------------------------------------------------------------------

/** L'ombre dure du variant shadow, réutilisée partout où un élément est « en relief ». */
const hardShadow = (color: string) => `0 3px 0 0 ${color}`;

/**
 * Style d'un bouton de lien. Les quatre variants historiques sont repris tels
 * quels ; un décor peut ajouter la bordure marquée (2 px `border`) et la
 * lisière gauche de 5 px, cette dernière retirée en forme pilule où elle
 * mordrait sur l'arrondi.
 */
export function bioButtonStyle(
  palette: BioPalette,
  options: { pill?: boolean } = {},
): CSSProperties {
  const decor = palette.decor;
  switch (palette.buttonVariant) {
    case "outline":
      return {
        backgroundColor: "transparent",
        color: palette.text,
        border: `2px solid ${palette.text}`,
      };
    case "shadow":
      return {
        backgroundColor: palette.surface,
        color: palette.surfaceText,
        border: `1px solid ${palette.border}`,
        boxShadow: hardShadow(palette.border),
      };
    case "glass":
      return {
        backgroundColor: palette.surface,
        color: palette.surfaceText,
        border: `1px solid ${palette.border}`,
        backdropFilter: "blur(12px)",
      };
    default: {
      const style: CSSProperties = {
        backgroundColor: palette.surface,
        color: palette.surfaceText,
        border:
          decor?.buttonBorder === "bold"
            ? `2px solid ${palette.border}`
            : "1px solid transparent",
      };
      if (decor?.selvedge && !options.pill) {
        style.boxShadow = `inset 5px 0 0 ${palette.border}`;
      }
      return style;
    }
  }
}

/**
 * Ombre dure étendue aux cartes, à l'avatar, aux pastilles et à l'onglet
 * actif — la règle « tout ce qui est en relief porte la même ombre nette ».
 *
 * Réservée aux thèmes à décor : sans `decor`, renvoie `undefined` même pour
 * un variant shadow, sinon les cartes de Classique ou Sahel gagneraient une
 * ombre qu'elles n'ont jamais eue.
 */
export function bioRaise(palette: BioPalette): string | undefined {
  const decor = palette.decor;
  if (!decor) return undefined;
  return decor.raise || palette.buttonVariant === "shadow"
    ? hardShadow(palette.border)
    : undefined;
}

/**
 * Style d'une carte produit. Sans décor, exactement ce que la carte peignait
 * déjà (surface, filet 1 px, flou du variant glass). Avec décor : fond
 * `decor.card` s'il existe, bordure 2 px si `buttonBorder: "bold"`, ombre
 * dure via bioRaise().
 */
export function bioCardStyle(palette: BioPalette): CSSProperties {
  const decor = palette.decor;
  const style: CSSProperties = {
    backgroundColor: decor?.card?.bg ?? palette.surface,
    color: decor?.card?.text ?? palette.surfaceText,
    border: `${decor?.buttonBorder === "bold" ? 2 : 1}px solid ${palette.border}`,
    backdropFilter: palette.buttonVariant === "glass" ? "blur(12px)" : undefined,
  };
  const raise = bioRaise(palette);
  if (raise) style.boxShadow = raise;
  return style;
}

/** AA pour le petit texte (sous-titres, « FCFA ») posé sur une surface. */
const MIN_SMALL_TEXT_CONTRAST = 4.5;

/**
 * Couleur du petit texte posé sur `surface` (sous-titre de lien, « FCFA »,
 * ligne de confiance). `decor.surfaceMuted` est choisie pour la surface des
 * boutons ; une carte qui ne la suit pas (Wax : carte blanche sous des
 * boutons cobalt) recevrait un gris bleuté illisible, d'où le choix par
 * contraste parmi les candidates, de la plus discrète à la plus franche.
 * Sans décor, `muted` puis le texte de surface, selon ce qui lit.
 */
export function bioSurfaceMutedOn(
  palette: BioPalette,
  surface: string = palette.surface,
): string {
  const decor = palette.decor;
  const candidates = [
    decor?.surfaceMuted,
    palette.muted,
    decor?.card?.text,
    palette.surfaceText,
  ].filter((c): c is string => Boolean(c));
  if (hexToRgb(surface)) {
    for (const candidate of candidates) {
      if (
        hexToRgb(candidate) &&
        contrastRatio(candidate, surface) >= MIN_SMALL_TEXT_CONTRAST
      ) {
        return candidate;
      }
    }
  }
  return decor?.surfaceMuted ?? palette.muted;
}

/**
 * Pastille de prix d'un thème à décor (ocre/crème, moutarde/encre…), chiffres
 * en police d'affiche ; `undefined` sans `decor.highlight`, la carte garde
 * alors son prix historique. Le « FCFA » s'écrit en `highlight.text` : c'est
 * la seule couleur garantie ≥ 4,5:1 sur la pastille.
 */
export function bioPriceBadgeStyle(
  palette: BioPalette,
): CSSProperties | undefined {
  const highlight = palette.decor?.highlight;
  if (!highlight) return undefined;
  return {
    backgroundColor: highlight.bg,
    color: highlight.text,
    fontFamily: "var(--bio-font-display, inherit)",
    fontVariantNumeric: "tabular-nums",
  };
}

/**
 * Anneau d'avatar d'un thème à décor ; `undefined` sinon, pour que le
 * composant garde son rendu historique (bordure 2 px + shadow-lg).
 */
export function bioAvatarRingStyle(
  palette: BioPalette,
): CSSProperties | undefined {
  const decor = palette.decor;
  switch (decor?.avatarRing) {
    case "double":
      // Le lé cousu : un filet du fond puis un filet d'encre.
      return {
        boxShadow: `0 0 0 3px ${palette.backgroundSolid}, 0 0 0 5px ${palette.border}`,
      };
    case "highlight":
      // Le disque du wax : anneau crème puis anneau moutarde.
      return {
        boxShadow: `0 0 0 4px ${palette.backgroundSolid}, 0 0 0 9px ${decor?.highlight?.bg ?? palette.accent}`,
      };
    case "raise":
      // La même règle que les boutons : filet 1 px + ombre dure.
      return {
        border: `1px solid ${palette.border}`,
        boxShadow: hardShadow(palette.border),
      };
    default:
      return undefined;
  }
}

/**
 * Pastilles de la barre haute (logo, partage). Sans décor : surface, texte
 * de surface, filet 1 px — le rendu historique. Avec décor, l'ombre dure
 * de bioRaise() ; et quand elles flottent sur une bande ou une bannière
 * (`overHeader`), fond de page + texte `accent`, sinon une pastille cobalt
 * disparaît sur la bande cobalt de Wax.
 */
export function bioTopBarPillStyle(
  palette: BioPalette,
  options: { overHeader?: boolean } = {},
): CSSProperties {
  const decor = palette.decor;
  const style: CSSProperties = {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `1px solid ${palette.border}`,
  };
  if (!decor) return style;
  if (options.overHeader) {
    style.backgroundColor = palette.backgroundSolid;
    style.color = palette.accent;
  }
  const raise = bioRaise(palette);
  if (raise) style.boxShadow = raise;
  return style;
}

/**
 * Les boutons WhatsApp, identiques sur tous les thèmes : le vert officiel
 * n'est jamais thémé (le visiteur doit le reconnaître en une demi-seconde)
 * et l'encre sombre lit dessus à 7,46:1 là où le blanc ne faisait que
 * 1,98:1. `fab` = bouton flottant (filet 2 px + ombre dure), `inline` =
 * « Commander » sur une carte produit ou une fiche (filet 1 px).
 */
export function whatsappButtonStyle(kind: "fab" | "inline"): CSSProperties {
  const style: CSSProperties = {
    backgroundColor: WHATSAPP_GREEN,
    color: WHATSAPP_INK,
    border: `${kind === "fab" ? 2 : 1}px solid ${WHATSAPP_INK}`,
  };
  if (kind === "fab") style.boxShadow = hardShadow(WHATSAPP_INK);
  return style;
}

/** Libellé inactif d'onglet : il doit rester lisible sur la piste. */
const MIN_TAB_CONTRAST = 4.5;

/**
 * Piste des onglets telle que le code la peignait avant : la couleur de la
 * bordure pour le variant shadow, sinon le texte à 16 % sur le fond. `hex`
 * est l'équivalent mesurable de `css` (les stories et les tests n'ont pas
 * color-mix).
 */
function legacyTabTrack(palette: BioPalette): { css: string; hex: string } {
  if (palette.buttonVariant === "shadow") {
    return {
      css: palette.border,
      hex: hexToRgb(palette.border) ? palette.border : palette.backgroundSolid,
    };
  }
  return {
    css: `color-mix(in oklab, ${palette.text} 16%, transparent)`,
    hex: mixHex(palette.text, palette.backgroundSolid, 0.16),
  };
}

/**
 * Garde-fou : quand le libellé inactif ne lit plus sur la piste (Lagune :
 * blanc sur turquoise éclairci), on écarte la piste du texte — plus sombre
 * pour un texte clair, plus claire pour un texte sombre — jusqu'à repasser
 * 4,5:1. Le résultat est un hex, identique en CSS et en story.
 */
function contrastSafeTabTrack(palette: BioPalette): string {
  const away =
    relativeLuminance(palette.text) > relativeLuminance(palette.backgroundSolid)
      ? "#000000"
      : "#FFFFFF";
  for (const t of [0.16, 0.24, 0.32, 0.4, 0.48]) {
    const candidate = mixHex(away, palette.backgroundSolid, t);
    if (contrastRatio(palette.text, candidate) >= MIN_TAB_CONTRAST) {
      return candidate;
    }
  }
  return palette.backgroundSolid;
}

function tabTrack(palette: BioPalette): { css: string; hex: string } {
  const decor = palette.decor;
  if (decor?.tabs === "outline") {
    return { css: palette.backgroundSolid, hex: palette.backgroundSolid };
  }
  if (decor?.tabs === "raised") {
    const hex = mixHex(palette.text, palette.backgroundSolid, 0.08);
    return { css: hex, hex };
  }
  const legacy = legacyTabTrack(palette);
  if (contrastRatio(palette.text, legacy.hex) >= MIN_TAB_CONTRAST) {
    return legacy;
  }
  const safe = contrastSafeTabTrack(palette);
  return { css: safe, hex: safe };
}

/**
 * Style de la piste des onglets Liens / Boutique : `outline` = fond de page
 * + filet `border` (2 px si les boutons sont bordés), `raised` = fond relevé
 * de 8 % de texte, sinon le rendu historique protégé par le garde-fou de
 * contraste.
 */
export function bioTabTrackStyle(palette: BioPalette): CSSProperties {
  const decor = palette.decor;
  const track = tabTrack(palette);
  if (decor?.tabs === "outline") {
    return {
      backgroundColor: track.css,
      border: `${decor.buttonBorder === "bold" ? 2 : 1}px solid ${palette.border}`,
    };
  }
  return { backgroundColor: track.css };
}

/** Couleur hex de la piste des onglets — pour les stories et les tests de contraste. */
export function bioTabTrackColor(palette: BioPalette): string {
  return tabTrack(palette).hex;
}

/**
 * Style d'un onglet. Sans décor : le rendu historique (surface + ombre
 * douce quand il est sélectionné). `outline` : onglet actif en aplat
 * `border` à libellé fond de page (le tampon). `raised` : surface + ombre
 * dure de 2 px qui tient lieu de soulignement.
 */
export function bioTabStyle(
  palette: BioPalette,
  selected: boolean,
): CSSProperties {
  const decor = palette.decor;
  if (!selected) {
    return { backgroundColor: "transparent", color: palette.text };
  }
  if (decor?.tabs === "outline") {
    return { backgroundColor: palette.border, color: palette.backgroundSolid };
  }
  if (decor?.tabs === "raised") {
    return {
      backgroundColor: palette.surface,
      color: palette.surfaceText,
      boxShadow: `0 2px 0 0 ${palette.border}`,
    };
  }
  return {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    boxShadow: "0 1px 3px rgba(0,0,0,.12)",
  };
}

// ---------------------------------------------------------------------------
// Variables CSS
// ---------------------------------------------------------------------------

/**
 * CSS custom properties consumed by every bio-page component. Set once on the
 * page root so children stay plain Tailwind + `var(--bio-*)`.
 *
 * Les variables de décor ont une valeur neutre sans décor (`none`, `0 0`,
 * `0`) : les utilitaires .bio-wash / .bio-band peuvent être posés sans
 * condition, ils ne dessinent rien. Les variables de police sont posées à
 * part (bioFontVars) car elles dépendent du choix du vendeur.
 */
export function bioThemeCssVars(palette: BioPalette): Record<string, string> {
  const decor = palette.decor;
  const pattern = decor?.pattern;
  const header = decor?.header;
  return {
    "--bio-bg": palette.background,
    "--bio-bg-solid": palette.backgroundSolid,
    "--bio-text": palette.text,
    "--bio-muted": palette.muted,
    "--bio-surface": palette.surface,
    "--bio-surface-text": palette.surfaceText,
    "--bio-border": palette.border,
    "--bio-accent": palette.accent,
    "--bio-pattern": pattern?.image ?? "none",
    "--bio-pattern-size": pattern?.size ?? "0 0",
    "--bio-pattern-position": pattern?.position ?? "0 0",
    "--bio-pattern-opacity": pattern ? String(pattern.opacity) : "0",
    "--bio-band-fill":
      header?.kind === "band" ? header.fill : palette.backgroundSolid,
    "--bio-highlight": decor?.highlight?.bg ?? palette.accent,
    // Repli : l'encre qui lit sur l'accent, jamais l'accent sur lui-même.
    "--bio-highlight-text":
      decor?.highlight?.text ??
      (hexToRgb(palette.accent)
        ? readableTextOn(palette.accent)
        : palette.surfaceText),
  };
}

/**
 * Polices du thème, posées sur la racine à côté de bioThemeCssVars.
 *
 * Règle « tout ou rien » : la paire du thème (Ojuju + Atkinson) ne s'applique
 * que si le vendeur n'a pas choisi de police (font_family « sans », le
 * défaut). Toute autre valeur gagne partout — pas de mélange Playfair +
 * Ojuju. Sans paire ou avec une police choisie, l'objet est vide : les
 * composants lisent `var(--bio-font-display, inherit)` et retombent sur la
 * police de la page.
 */
export function bioFontVars(
  palette: BioPalette,
  fontFamily: string | null | undefined,
): Record<string, string> {
  const preset = palette.decor?.fontPreset;
  if (!preset || (fontFamily ?? DEFAULT_FONT_FAMILY) !== DEFAULT_FONT_FAMILY) {
    return {};
  }
  const vars: Record<string, string> = {
    "--bio-font-display": BIO_DISPLAY_FONTS[preset.display],
  };
  const body = SHOP_FONTS.find((font) => font.value === preset.body)?.cssVar;
  if (body) vars["--bio-font-body"] = body;
  return vars;
}
