/**
 * Bio page themes — the full-page palettes used by the public page at /{slug}.
 *
 * A bio page is one scrollable column on a coloured background: whatever the
 * seller picks here decides the page background, the button surface and every
 * text colour on top of them. Keeping the palettes in one typed table (rather
 * than scattered Tailwind classes) means the storefront, the dashboard picker
 * and the live preview all read the exact same values.
 *
 * Framework-free on purpose: pure data + pure functions, so the contrast
 * rules are unit-testable without a DOM.
 */

export const BIO_THEME_IDS = [
  "classic",
  "noir",
  "lagoon",
  "sunset",
  "sahel",
  "kente",
  "mint",
  "lavender",
  "midnight",
  "brand",
] as const;

export type BioThemeId = (typeof BIO_THEME_IDS)[number];

/** How link buttons are painted on top of the page background. */
export type BioButtonVariant = "solid" | "outline" | "shadow" | "glass";

export interface BioThemePreset {
  id: BioThemeId;
  label: string;
  description: string;
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
}

export const DEFAULT_BIO_THEME: BioThemeId = "classic";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const BIO_THEMES: Record<BioThemeId, BioThemePreset> = {
  classic: {
    id: "classic",
    label: "Classique",
    description: "Fond blanc, boutons nets — lisible partout, même en plein soleil.",
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
  sahel: {
    id: "sahel",
    label: "Sahel",
    description: "Sable chaud et terre cuite — parfait pour l'artisanat.",
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
  mint: {
    id: "mint",
    label: "Menthe",
    description: "Vert pâle et doux — beauté, soins, bien-être.",
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
 * CSS custom properties consumed by every bio-page component. Set once on the
 * page root so children stay plain Tailwind + `var(--bio-*)`.
 */
export function bioThemeCssVars(palette: BioPalette): Record<string, string> {
  return {
    "--bio-bg": palette.background,
    "--bio-bg-solid": palette.backgroundSolid,
    "--bio-text": palette.text,
    "--bio-muted": palette.muted,
    "--bio-surface": palette.surface,
    "--bio-surface-text": palette.surfaceText,
    "--bio-border": palette.border,
    "--bio-accent": palette.accent,
  };
}
