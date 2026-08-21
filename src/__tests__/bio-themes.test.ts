/**
 * Bio page theming — contrast rules and palette resolution.
 *
 * These are the guards that stop a seller-chosen colour from producing an
 * unreadable public page, so they are worth pinning down.
 */

import {
  BIO_THEME_IDS,
  BIO_THEMES,
  bioThemeCssVars,
  contrastRatio,
  hexToRgb,
  isBioThemeId,
  readableTextOn,
  relativeLuminance,
  resolveBioTheme,
  withAlpha,
} from "@/lib/bio-themes";

describe("hexToRgb", () => {
  it("parses 6-digit and 3-digit hex, with or without #", () => {
    expect(hexToRgb("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb("ff8800")).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb("#F80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("returns null for anything that is not a hex colour", () => {
    expect(hexToRgb("rgba(0,0,0,.5)")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });
});

describe("relativeLuminance / contrastRatio", () => {
  it("anchors black and white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#3F9296", "#FFFFFF")).toBeCloseTo(
      contrastRatio("#FFFFFF", "#3F9296"),
      6,
    );
  });
});

describe("readableTextOn", () => {
  it("puts dark ink on light backgrounds and white on dark ones", () => {
    expect(readableTextOn("#FFFFFF")).toBe("#0F172A");
    expect(readableTextOn("#F4EADB")).toBe("#0F172A");
    expect(readableTextOn("#0B0B0F")).toBe("#FFFFFF");
    expect(readableTextOn("#6366F1")).toBe("#FFFFFF");
  });

  it("picks dark ink on saturated yellows — the classic white-on-yellow trap", () => {
    expect(readableTextOn("#E9B949")).toBe("#0F172A");
    expect(readableTextOn("#FFFF00")).toBe("#0F172A");
  });

  it("always clears the WCAG AA large-text threshold", () => {
    for (const background of [
      "#FFFFFF",
      "#000000",
      "#E9B949",
      "#3F9296",
      "#6366F1",
      "#F4EADB",
    ]) {
      expect(contrastRatio(background, readableTextOn(background))).toBeGreaterThan(3);
    }
  });
});

describe("withAlpha", () => {
  it("converts to rgba and clamps the alpha", () => {
    expect(withAlpha("#0F172A", 0.5)).toBe("rgba(15, 23, 42, 0.5)");
    expect(withAlpha("#0F172A", 5)).toBe("rgba(15, 23, 42, 1)");
    expect(withAlpha("#0F172A", -1)).toBe("rgba(15, 23, 42, 0)");
  });

  it("passes non-hex values through untouched", () => {
    expect(withAlpha("rgba(0,0,0,.2)", 0.5)).toBe("rgba(0,0,0,.2)");
  });
});

describe("isBioThemeId", () => {
  it("accepts known ids only", () => {
    expect(isBioThemeId("lagoon")).toBe(true);
    expect(isBioThemeId("does-not-exist")).toBe(false);
    expect(isBioThemeId(null)).toBe(false);
    expect(isBioThemeId(42)).toBe(false);
  });
});

describe("resolveBioTheme", () => {
  const shop = { theme_color: "#6366F1", accent_color: "#0F172A" };

  it("returns the preset untouched for every non-brand theme", () => {
    for (const id of BIO_THEME_IDS) {
      if (id === "brand") continue;
      expect(resolveBioTheme({ ...shop, bio_theme: id })).toEqual(
        BIO_THEMES[id],
      );
    }
  });

  it("falls back to the default theme for a missing or unknown value", () => {
    expect(resolveBioTheme({ ...shop, bio_theme: null }).id).toBe("classic");
    expect(resolveBioTheme({ ...shop, bio_theme: "neon-pink" }).id).toBe(
      "classic",
    );
    expect(resolveBioTheme(shop).id).toBe("classic");
  });

  describe("brand", () => {
    it("builds the page from the shop's own colours", () => {
      const palette = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#2E7D7B",
        accent_color: "#FFFFFF",
      });

      expect(palette.background).toBe("#2E7D7B");
      expect(palette.surface).toBe("#FFFFFF");
      expect(palette.text).toBe("#FFFFFF");
      expect(palette.surfaceText).toBe("#0F172A");
    });

    it("keeps buttons visible when both shop colours are nearly identical", () => {
      const palette = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#2E7D7B",
        accent_color: "#2E7D7B",
      });

      expect(palette.surface).not.toBe("#2E7D7B");
      expect(
        contrastRatio(palette.surface, palette.background),
      ).toBeGreaterThan(1.6);
    });

    it("keeps text readable on a light brand colour", () => {
      const palette = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#FFE066",
        accent_color: "#111111",
      });

      expect(palette.text).toBe("#0F172A");
      expect(palette.scheme).toBe("light");
      expect(contrastRatio(palette.text, palette.background)).toBeGreaterThan(3);
    });

    it("survives a malformed colour instead of rendering a blank page", () => {
      const palette = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "not-a-colour",
        accent_color: "also-not",
      });

      expect(hexToRgb(palette.background)).not.toBeNull();
      expect(contrastRatio(palette.text, palette.background)).toBeGreaterThan(3);
    });
  });

  it("keeps every preset's text, secondary text and buttons legible", () => {
    for (const id of BIO_THEME_IDS) {
      const palette = resolveBioTheme({ ...shop, bio_theme: id });
      // Gradients and rgba surfaces aren't measurable — check the solid ones.
      if (hexToRgb(palette.backgroundSolid) && hexToRgb(palette.text)) {
        expect(
          contrastRatio(palette.text, palette.backgroundSolid),
        ).toBeGreaterThan(3);
      }
      if (hexToRgb(palette.backgroundSolid) && hexToRgb(palette.muted)) {
        expect(
          contrastRatio(palette.muted, palette.backgroundSolid),
        ).toBeGreaterThan(3);
      }
      if (hexToRgb(palette.backgroundSolid) && hexToRgb(palette.accent)) {
        expect(
          contrastRatio(palette.accent, palette.backgroundSolid),
        ).toBeGreaterThan(3);
      }
      if (hexToRgb(palette.surface) && hexToRgb(palette.surfaceText)) {
        expect(
          contrastRatio(palette.surface, palette.surfaceText),
        ).toBeGreaterThan(4.5);
      }
    }
  });
});

describe("bioThemeCssVars", () => {
  it("exposes every colour the page components read", () => {
    const vars = bioThemeCssVars(resolveBioTheme({
      bio_theme: "lagoon",
      theme_color: "#6366F1",
      accent_color: "#0F172A",
    }));

    expect(vars).toEqual({
      "--bio-bg": "#2E7D7B",
      "--bio-bg-solid": "#2E7D7B",
      "--bio-text": "#FFFFFF",
      "--bio-muted": "#D3EDEC",
      "--bio-surface": "#FFFFFF",
      "--bio-surface-text": "#123C3D",
      "--bio-border": "#FFFFFF",
      "--bio-accent": "#FFD9D2",
    });
  });
});
