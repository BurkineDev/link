/**
 * Bio page theming — contrast rules and palette resolution.
 *
 * These are the guards that stop a seller-chosen colour from producing an
 * unreadable public page, so they are worth pinning down.
 *
 * Les thèmes « Afrique de l'Ouest » ont en plus un test « soleil » (≥ 4,5:1
 * partout où du texte se pose) et des garde-fous sur ce que leur décor
 * ajoute : tuile SVG, piste des onglets, pastille de prix, polices.
 */

import {
  BIO_PATTERNS,
  BIO_THEME_GROUPS,
  BIO_THEME_IDS,
  BIO_THEME_LIST,
  BIO_THEMES,
  DEFAULT_BIO_THEME,
  bioAvatarInitialsStyle,
  bioAvatarRingStyle,
  bioBorderWidth,
  bioButtonStyle,
  bioCardStyle,
  bioChipStyle,
  bioFontVars,
  bioIconTileStyle,
  bioPatternDataUri,
  bioPriceBadgeStyle,
  bioRaise,
  bioSocialRingStyle,
  bioSurfaceMutedOn,
  bioTabStyle,
  bioTabTrackColor,
  bioTabTrackStyle,
  bioThemeCssVars,
  bioTopBarPillStyle,
  contrastRatio,
  groupBioThemes,
  hexToRgb,
  isBioThemeId,
  mixHex,
  primaryActionColor,
  readableTextOn,
  relativeLuminance,
  resolveBioTheme,
  whatsappButtonStyle,
  withAlpha,
  type BioPatternId,
  type BioThemeId,
} from "@/lib/bio-themes";
import { WHATSAPP_GREEN, WHATSAPP_INK } from "@/lib/constants";

/** Les quatre thèmes à décor, ceux qui doivent tenir en plein soleil. */
const AFRIQUE_IDS = ["bogolan", "wax", "indigo", "pagne"] as const;

const SHOP = { theme_color: "#6366F1", accent_color: "#0F172A" };

function palette(id: BioThemeId) {
  return resolveBioTheme({ ...SHOP, bio_theme: id });
}

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

describe("mixHex", () => {
  it("interpolates in sRGB, t being the share of the first colour", () => {
    expect(mixHex("#FFFFFF", "#000000", 0)).toBe("#000000");
    expect(mixHex("#FFFFFF", "#000000", 1)).toBe("#FFFFFF");
    expect(mixHex("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    // La frise bogolan : 10 % d'encre sur le fond, comme le color-mix du CSS.
    expect(mixHex("#1C1714", "#F3E9D8", 0.1)).toBe("#DED4C4");
  });

  it("clamps t and falls back to the parsable colour", () => {
    expect(mixHex("#FFFFFF", "#000000", 2)).toBe("#FFFFFF");
    expect(mixHex("linear-gradient(red, blue)", "#000000", 0.5)).toBe("#000000");
    expect(mixHex("#FFFFFF", "rgba(0,0,0,.5)", 0.5)).toBe("#FFFFFF");
  });
});

describe("isBioThemeId", () => {
  it("accepts known ids only", () => {
    expect(isBioThemeId("lagoon")).toBe(true);
    expect(isBioThemeId("pagne")).toBe(true);
    expect(isBioThemeId("does-not-exist")).toBe(false);
    expect(isBioThemeId(null)).toBe(false);
    expect(isBioThemeId(42)).toBe(false);
  });
});

describe("catalogue des thèmes", () => {
  it("garde l'ordre figé du sélecteur : Afrique de l'Ouest, classiques, Mes couleurs", () => {
    expect([...BIO_THEME_IDS]).toEqual([
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
    ]);
    expect(BIO_THEME_LIST.map((theme) => theme.id)).toEqual([...BIO_THEME_IDS]);
  });

  it("présélectionne Wax pour une nouvelle boutique", () => {
    expect(DEFAULT_BIO_THEME).toBe("wax");
    expect(BIO_THEMES[DEFAULT_BIO_THEME].group).toBe("afrique");
  });

  it("nomme les thèmes par l'étoffe, jamais par un mot banni", () => {
    expect(BIO_THEMES.pagne.label).toBe("Pagne tissé");
    for (const theme of BIO_THEME_LIST) {
      expect(`${theme.label} ${theme.description}`).not.toMatch(
        /tribal|ethnique|safari/i,
      );
    }
  });

  it("regroupe les presets dans l'ordre des intertitres", () => {
    const groups = groupBioThemes();
    expect(groups.map((group) => group.label)).toEqual([
      BIO_THEME_GROUPS.afrique,
      BIO_THEME_GROUPS.classique,
      BIO_THEME_GROUPS.perso,
    ]);
    expect(groups[0].themes.map((theme) => theme.id)).toEqual([
      "bogolan",
      "wax",
      "indigo",
      "pagne",
      "sahel",
      "kente",
    ]);
    expect(groups[1].themes.map((theme) => theme.id)).toEqual([
      "classic",
      "noir",
      "lagoon",
      "sunset",
      "mint",
      "lavender",
      "midnight",
    ]);
    expect(groups[2].themes.map((theme) => theme.id)).toEqual(["brand"]);
  });

  it("efface un groupe vide — l'onboarding retire « Mes couleurs »", () => {
    const groups = groupBioThemes(
      BIO_THEME_LIST.filter((theme) => theme.id !== "brand"),
    );
    expect(groups.map((group) => group.group)).toEqual(["afrique", "classique"]);
  });

  it("ne donne un décor qu'aux quatre thèmes afrique", () => {
    for (const id of BIO_THEME_IDS) {
      const hasDecor = BIO_THEMES[id].decor !== undefined;
      expect(hasDecor).toBe((AFRIQUE_IDS as readonly string[]).includes(id));
    }
  });
});

describe("resolveBioTheme", () => {
  it("returns the preset untouched for every non-brand theme", () => {
    for (const id of BIO_THEME_IDS) {
      if (id === "brand") continue;
      expect(palette(id)).toEqual(BIO_THEMES[id]);
    }
  });

  it("falls back to the default theme for a missing or unknown value", () => {
    expect(resolveBioTheme({ ...SHOP, bio_theme: null }).id).toBe(DEFAULT_BIO_THEME);
    expect(resolveBioTheme({ ...SHOP, bio_theme: "neon-pink" }).id).toBe(
      DEFAULT_BIO_THEME,
    );
    expect(resolveBioTheme(SHOP).id).toBe(DEFAULT_BIO_THEME);
  });

  describe("brand", () => {
    it("builds the page from the shop's own colours", () => {
      const brand = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#2E7D7B",
        accent_color: "#FFFFFF",
      });

      expect(brand.background).toBe("#2E7D7B");
      expect(brand.surface).toBe("#FFFFFF");
      expect(brand.text).toBe("#FFFFFF");
      expect(brand.surfaceText).toBe("#0F172A");
      expect(brand.decor).toBeUndefined();
    });

    it("keeps buttons visible when both shop colours are nearly identical", () => {
      const brand = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#2E7D7B",
        accent_color: "#2E7D7B",
      });

      expect(brand.surface).not.toBe("#2E7D7B");
      expect(contrastRatio(brand.surface, brand.background)).toBeGreaterThan(1.6);
    });

    it("keeps text readable on a light brand colour", () => {
      const brand = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "#FFE066",
        accent_color: "#111111",
      });

      expect(brand.text).toBe("#0F172A");
      expect(brand.scheme).toBe("light");
      expect(contrastRatio(brand.text, brand.background)).toBeGreaterThan(3);
    });

    it("survives a malformed colour instead of rendering a blank page", () => {
      const brand = resolveBioTheme({
        bio_theme: "brand",
        theme_color: "not-a-colour",
        accent_color: "also-not",
      });

      expect(hexToRgb(brand.background)).not.toBeNull();
      expect(contrastRatio(brand.text, brand.background)).toBeGreaterThan(3);
    });
  });

  it("keeps every preset's text, secondary text and buttons legible", () => {
    for (const id of BIO_THEME_IDS) {
      const p = palette(id);
      // Gradients and rgba surfaces aren't measurable — check the solid ones.
      if (hexToRgb(p.backgroundSolid) && hexToRgb(p.text)) {
        expect(contrastRatio(p.text, p.backgroundSolid)).toBeGreaterThan(3);
      }
      if (hexToRgb(p.backgroundSolid) && hexToRgb(p.muted)) {
        expect(contrastRatio(p.muted, p.backgroundSolid)).toBeGreaterThan(3);
      }
      if (hexToRgb(p.backgroundSolid) && hexToRgb(p.accent)) {
        expect(contrastRatio(p.accent, p.backgroundSolid)).toBeGreaterThan(3);
      }
      if (hexToRgb(p.surface) && hexToRgb(p.surfaceText)) {
        expect(contrastRatio(p.surface, p.surfaceText)).toBeGreaterThan(4.5);
      }
    }
  });
});

describe("thèmes afrique — lisibles en plein soleil (≥ 4,5:1 partout)", () => {
  it.each(AFRIQUE_IDS)("%s : texte, muted et accent sur le fond", (id) => {
    const p = palette(id);
    expect(hexToRgb(p.backgroundSolid)).not.toBeNull();
    expect(contrastRatio(p.text, p.backgroundSolid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.muted, p.backgroundSolid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.accent, p.backgroundSolid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.surfaceText, p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(AFRIQUE_IDS)("%s : pastille de prix, petit texte de surface et carte", (id) => {
    const decor = palette(id).decor;
    const p = palette(id);
    expect(decor).toBeDefined();
    if (!decor) return;

    expect(decor.highlight).toBeDefined();
    if (decor.highlight) {
      expect(contrastRatio(decor.highlight.text, decor.highlight.bg)).toBeGreaterThanOrEqual(4.5);
    }
    // surfaceMuted est fait pour la surface des boutons (sous-titres).
    if (decor.surfaceMuted) {
      expect(contrastRatio(decor.surfaceMuted, p.surface)).toBeGreaterThanOrEqual(4.5);
    }
    if (decor.card) {
      expect(contrastRatio(decor.card.text, decor.card.bg)).toBeGreaterThanOrEqual(4.5);
    }
    // Le petit texte choisi pour la carte lit sur la carte, quelle qu'elle soit.
    const cardBg = decor.card?.bg ?? p.surface;
    expect(contrastRatio(bioSurfaceMutedOn(p, cardBg), cardBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(bioSurfaceMutedOn(p), p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("wax : le petit texte des cartes blanches n'est pas le gris bleuté des boutons cobalt", () => {
    const wax = palette("wax");
    expect(bioSurfaceMutedOn(wax)).toBe("#DCE4F2");
    expect(bioSurfaceMutedOn(wax, "#FFFFFF")).toBe("#5A5A64");
  });

  it.each(AFRIQUE_IDS)("%s : le prix est une pastille lisible, en police d'affiche", (id) => {
    const badge = bioPriceBadgeStyle(palette(id));
    expect(badge).toBeDefined();
    expect(contrastRatio(String(badge?.color), String(badge?.backgroundColor))).toBeGreaterThanOrEqual(4.5);
    expect(badge?.fontFamily).toBe("var(--bio-font-display, inherit)");
    expect(bioPriceBadgeStyle(palette("classic"))).toBeUndefined();
  });

  it.each(AFRIQUE_IDS)("%s : porte la paire Ojuju + Atkinson et une tuile", (id) => {
    const decor = palette(id).decor;
    expect(decor?.fontPreset).toEqual({ display: "ojuju", body: "atkinson" });
    expect(decor?.pattern?.image.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(decor?.header).toBeDefined();
    expect(decor?.divider).toBeDefined();
  });

  it("wax : le compteur moutarde lit aussi sur le cobalt des boutons", () => {
    const wax = palette("wax");
    expect(contrastRatio(wax.decor!.highlight!.bg, wax.surface)).toBeGreaterThanOrEqual(3);
  });

  it("pagne tissé : une bande de 104 px à lisière, une couture en point de piqûre", () => {
    const decor = palette("pagne").decor!;
    expect(decor.header).toEqual({
      kind: "band",
      height: 104,
      fill: "#23407A",
      edge: "selvedge",
    });
    expect(decor.divider).toBe("stitch");
    expect(decor.buttonBorder).toBe("bold");
    expect(palette("pagne").buttonVariant).toBe("solid");
  });
});

describe("bioPatternDataUri", () => {
  const ids = Object.keys(BIO_PATTERNS) as BioPatternId[];

  it("couvre les quatre tuiles", () => {
    expect(ids.sort()).toEqual(["bogolan", "pagne", "thioup", "wax"]);
  });

  it.each(ids)("%s : data-URI encodé, encre cuite, sous 1 Ko", (id) => {
    const uri = bioPatternDataUri(id, "#1C1714");
    expect(uri.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(uri.endsWith('")')).toBe(true);
    // Un « # » brut terminerait l'URL : il doit être encodé, comme < et >.
    expect(uri).not.toContain("#");
    expect(uri).not.toContain("<");
    expect(uri).not.toContain(">");
    expect(uri).toContain("%231C1714");
    expect(uri).not.toContain("{{ink}}");
    expect(Buffer.byteLength(uri, "utf8")).toBeLessThan(1024);
  });

  it("cuit l'encre demandée, pas une couleur par défaut", () => {
    expect(bioPatternDataUri("wax", "#FFFBF2")).toContain("%23FFFBF2");
    expect(bioPatternDataUri("wax", "#FFFBF2")).not.toContain("%231C1714");
  });
});

describe("primaryActionColor", () => {
  it("stands out from the card surface in every preset", () => {
    for (const id of BIO_THEME_IDS) {
      const p = palette(id);
      const action = primaryActionColor(p);

      if (hexToRgb(p.surface)) {
        expect(contrastRatio(action, p.surface)).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(action, readableTextOn(action))).toBeGreaterThan(4.5);
    }
  });

  it("accepte la surface d'une carte qui ne suit pas le thème (Wax)", () => {
    const wax = palette("wax");
    const action = primaryActionColor(wax, wax.decor!.card!.bg);
    expect(contrastRatio(action, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    expect(action).toBe("#1748A8");
  });

  it("falls back to ink when neither brand colour reads on the surface", () => {
    // Classic paints a white card on a white page: no brand colour qualifies.
    const classic = resolveBioTheme({
      bio_theme: "classic",
      theme_color: "#FFFFFF",
      accent_color: "#FFFFFF",
    });
    expect(primaryActionColor(classic)).toBe("#0F172A");
  });

  it("nudges a borderline brand colour until its label clears AA", () => {
    // Indigo #6366F1 carries white at 4.47:1 — just under the threshold.
    const brand = resolveBioTheme({
      bio_theme: "brand",
      theme_color: "#6366F1",
      accent_color: "#0F172A",
    });
    const action = primaryActionColor(brand);

    expect(action).not.toBe("#6366F1");
    expect(contrastRatio(action, readableTextOn(action))).toBeGreaterThanOrEqual(4.5);
  });

  it("prefers the page colour when it reads on the card", () => {
    expect(primaryActionColor(palette("lagoon"))).toBe("#2E7D7B");
  });
});

describe("WhatsApp", () => {
  it("l'encre lit sur le vert là où le blanc ne le faisait pas", () => {
    expect(contrastRatio(WHATSAPP_INK, WHATSAPP_GREEN)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FFFFFF", WHATSAPP_GREEN)).toBeLessThan(3);
  });

  it("le même vert et la même encre sur le bouton flottant et sur « Commander »", () => {
    expect(whatsappButtonStyle("fab")).toEqual({
      backgroundColor: WHATSAPP_GREEN,
      color: WHATSAPP_INK,
      border: `2px solid ${WHATSAPP_INK}`,
      boxShadow: `0 3px 0 0 ${WHATSAPP_INK}`,
    });
    expect(whatsappButtonStyle("inline")).toEqual({
      backgroundColor: WHATSAPP_GREEN,
      color: WHATSAPP_INK,
      border: `1px solid ${WHATSAPP_INK}`,
    });
  });
});

describe("bioButtonStyle", () => {
  it("rend les quatre variants historiques exactement comme avant", () => {
    expect(bioButtonStyle(palette("classic"))).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      border: "1px solid #E2E8F0",
      boxShadow: "0 3px 0 0 #E2E8F0",
    });
    expect(bioButtonStyle(palette("noir"))).toEqual({
      backgroundColor: "#18181B",
      color: "#FAFAFA",
      border: "1px solid transparent",
    });
    expect(bioButtonStyle(palette("midnight"))).toEqual({
      backgroundColor: "rgba(255, 255, 255, 0.10)",
      color: "#F8FAFC",
      border: "1px solid rgba(255, 255, 255, 0.22)",
      backdropFilter: "blur(12px)",
    });
    const brand = resolveBioTheme({
      bio_theme: "brand",
      theme_color: "#2E7D7B",
      accent_color: "#FFFFFF",
    });
    expect(bioButtonStyle(brand)).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      border: "1px solid transparent",
    });
  });

  it("marque la bordure des boutons wax et pagne, sans jamais flouter", () => {
    expect(bioButtonStyle(palette("wax"))).toEqual({
      backgroundColor: "#1748A8",
      color: "#FFFFFF",
      border: "2px solid #1748A8",
    });
    const pagne = bioButtonStyle(palette("pagne"));
    expect(pagne.border).toBe("2px solid #23407A");
    expect(pagne.boxShadow).toBe("inset 5px 0 0 #23407A");
    expect(bioButtonStyle(palette("pagne"), { pill: true }).boxShadow).toBeUndefined();
    for (const id of AFRIQUE_IDS) {
      expect(bioButtonStyle(palette(id)).backdropFilter).toBeUndefined();
    }
  });
});

describe("bioRaise / bioCardStyle / bioAvatarRingStyle", () => {
  it("n'étend l'ombre dure qu'aux thèmes à décor qui la demandent", () => {
    expect(bioRaise(palette("classic"))).toBeUndefined();
    expect(bioRaise(palette("sahel"))).toBeUndefined();
    expect(bioRaise(palette("wax"))).toBeUndefined();
    expect(bioRaise(palette("pagne"))).toBeUndefined();
    expect(bioRaise(palette("bogolan"))).toBe("0 3px 0 0 #1C1714");
    expect(bioRaise(palette("indigo"))).toBe("0 3px 0 0 #C2643A");
  });

  it("laisse la carte produit historique intacte", () => {
    expect(bioCardStyle(palette("classic"))).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      border: "1px solid #E2E8F0",
      backdropFilter: undefined,
    });
    expect(bioCardStyle(palette("midnight")).backdropFilter).toBe("blur(12px)");
  });

  it("peint la carte wax en blanc bordé de cobalt, la carte bogolan en relief", () => {
    expect(bioCardStyle(palette("wax"))).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#17171C",
      border: "2px solid #1748A8",
      backdropFilter: undefined,
    });
    expect(bioCardStyle(palette("bogolan")).boxShadow).toBe("0 3px 0 0 #1C1714");
  });

  it("ne donne un anneau qu'aux thèmes à décor", () => {
    expect(bioAvatarRingStyle(palette("classic"))).toBeUndefined();
    expect(bioAvatarRingStyle(palette("bogolan"))).toEqual({
      boxShadow: "0 0 0 3px #F3E9D8, 0 0 0 5px #1C1714",
    });
    expect(bioAvatarRingStyle(palette("wax"))).toEqual({
      boxShadow: "0 0 0 4px #FFFBF2, 0 0 0 9px #F2B705",
    });
    expect(bioAvatarRingStyle(palette("indigo"))).toEqual({
      border: "1px solid #C2643A",
      boxShadow: "0 3px 0 0 #C2643A",
    });
  });
});

describe("bioAvatarInitialsStyle — le même disque pour la page, la story et les aperçus", () => {
  it("sans décor : la surface et son texte, rien d'autre (chaque rendu garde son filet)", () => {
    for (const id of BIO_THEME_IDS) {
      if ((AFRIQUE_IDS as readonly string[]).includes(id)) continue;
      const p = palette(id);
      expect(bioAvatarInitialsStyle(p)).toEqual({
        backgroundColor: p.surface,
        color: p.surfaceText,
      });
    }
  });

  it("sur une bande, fond de page + accent, sinon surface ; filet 2 px sauf sous les anneaux de Wax", () => {
    expect(bioAvatarInitialsStyle(palette("wax"))).toEqual({
      backgroundColor: "#FFFBF2",
      color: "#1748A8",
      boxShadow: "0 0 0 4px #FFFBF2, 0 0 0 9px #F2B705",
    });
    expect(bioAvatarInitialsStyle(palette("pagne"))).toEqual({
      backgroundColor: "#F7F3EA",
      color: "#23407A",
      border: "2px solid #23407A",
      boxShadow: "0 0 0 3px #F7F3EA, 0 0 0 5px #23407A",
    });
    expect(bioAvatarInitialsStyle(palette("bogolan"))).toEqual({
      backgroundColor: "#FBF7EF",
      color: "#1C1714",
      border: "2px solid #1C1714",
      boxShadow: "0 0 0 3px #F3E9D8, 0 0 0 5px #1C1714",
    });
    // L'anneau « raise » apporte son propre filet, qui l'emporte.
    expect(bioAvatarInitialsStyle(palette("indigo"))).toEqual({
      backgroundColor: "#EAD9B8",
      color: "#141E3D",
      border: "1px solid #C2643A",
      boxShadow: "0 3px 0 0 #C2643A",
    });
  });

  it("les initiales lisent sur le disque (≥ 4,5:1) sur les quatre thèmes", () => {
    for (const id of AFRIQUE_IDS) {
      const style = bioAvatarInitialsStyle(palette(id));
      expect(contrastRatio(String(style.color), String(style.backgroundColor))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("bioIconTileStyle — une seule règle pour la page et les aperçus", () => {
  it("s'inverse sur Wax, se teinte d'accent sur Pagne tissé, reste historique ailleurs", () => {
    expect(bioIconTileStyle(palette("wax"))).toEqual({
      backgroundColor: "#FFFBF2",
      color: "#1748A8",
    });
    expect(bioIconTileStyle(palette("pagne"))).toEqual({
      backgroundColor: "color-mix(in oklab, #23407A 10%, transparent)",
      color: "#23407A",
    });
    const legacy = { backgroundColor: "color-mix(in oklab, currentColor 10%, transparent)" };
    expect(bioIconTileStyle(palette("bogolan"))).toEqual(legacy);
    expect(bioIconTileStyle(palette("indigo"))).toEqual(legacy);
    for (const id of BIO_THEME_IDS) {
      if ((AFRIQUE_IDS as readonly string[]).includes(id)) continue;
      expect(bioIconTileStyle(palette(id))).toEqual(legacy);
    }
  });

  it("laisse la tuile transparente sur un bouton contour", () => {
    expect(bioIconTileStyle({ ...palette("classic"), buttonVariant: "outline" })).toEqual({
      backgroundColor: "transparent",
    });
  });

  it("l'icône lit sur la tuile là où elle est colorée", () => {
    const wax = bioIconTileStyle(palette("wax"));
    expect(contrastRatio(String(wax.color), String(wax.backgroundColor))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("bioBorderWidth / bioChipStyle / bioSocialRingStyle", () => {
  it("2 px seulement quand les boutons sont bordés (Wax, Pagne tissé)", () => {
    expect(bioBorderWidth(palette("wax"))).toBe(2);
    expect(bioBorderWidth(palette("pagne"))).toBe(2);
    expect(bioBorderWidth(palette("bogolan"))).toBe(1);
    expect(bioBorderWidth(palette("indigo"))).toBe(1);
    expect(bioBorderWidth(palette("classic"))).toBe(1);
    // La même épaisseur partout : cartes, piste des onglets, puces.
    for (const id of AFRIQUE_IDS) {
      const p = palette(id);
      const width = `${bioBorderWidth(p)}px solid ${p.border}`;
      expect(bioCardStyle(p).border).toBe(width);
      expect(bioChipStyle(p).border).toBe(width);
      if (p.decor?.tabs === "outline") expect(bioTabTrackStyle(p).border).toBe(width);
    }
  });

  it("puces SOCIAL : la puce historique sans décor, bordée ou en relief avec", () => {
    expect(bioChipStyle(palette("classic"))).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      border: "1px solid #E2E8F0",
    });
    expect(bioChipStyle(palette("wax"))).toEqual({
      backgroundColor: "#1748A8",
      color: "#FFFFFF",
      border: "2px solid #1748A8",
    });
    expect(bioChipStyle(palette("bogolan"))).toEqual({
      backgroundColor: "#FBF7EF",
      color: "#1C1714",
      border: "1px solid #1C1714",
      boxShadow: "0 3px 0 0 #1C1714",
    });
  });

  it("cercles des réseaux : rien sans décor, filet d'encre ou d'accent avec", () => {
    expect(bioSocialRingStyle(palette("classic"))).toBeUndefined();
    expect(bioSocialRingStyle(palette("bogolan"))).toEqual({
      color: "#1C1714",
      border: "1px solid #1C1714",
    });
    expect(bioSocialRingStyle(palette("indigo"))).toEqual({
      color: "#F2EBDC",
      border: "1px solid #C2643A",
    });
    expect(bioSocialRingStyle(palette("wax"))).toEqual({
      color: "#1748A8",
      border: "2px solid #1748A8",
    });
    expect(bioSocialRingStyle(palette("pagne"))).toEqual({
      color: "#23407A",
      border: "2px solid #23407A",
    });
    // L'icône lit sur le fond de page sur les quatre thèmes.
    for (const id of AFRIQUE_IDS) {
      const p = palette(id);
      const ring = bioSocialRingStyle(p)!;
      expect(contrastRatio(String(ring.color), p.backgroundSolid)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("bioTopBarPillStyle", () => {
  it("garde le rendu historique sans décor, même au-dessus d'une bannière", () => {
    const legacy = {
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      border: "1px solid #E2E8F0",
    };
    expect(bioTopBarPillStyle(palette("classic"))).toEqual(legacy);
    expect(bioTopBarPillStyle(palette("classic"), { overHeader: true })).toEqual(legacy);
  });

  it("inverse la pastille sur la bande cobalt de wax", () => {
    expect(bioTopBarPillStyle(palette("wax"), { overHeader: true })).toEqual({
      backgroundColor: "#FFFBF2",
      color: "#1748A8",
      border: "1px solid #1748A8",
    });
    expect(bioTopBarPillStyle(palette("bogolan")).boxShadow).toBe("0 3px 0 0 #1C1714");
  });
});

describe("onglets Liens / Boutique", () => {
  it("garde le libellé inactif lisible sur la piste, pour tous les presets", () => {
    for (const id of BIO_THEME_IDS) {
      const p = palette(id);
      expect(contrastRatio(p.text, bioTabTrackColor(p))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("garde le libellé de l'onglet actif lisible, pour tous les presets", () => {
    for (const id of BIO_THEME_IDS) {
      const p = palette(id);
      const active = bioTabStyle(p, true);
      if (hexToRgb(String(active.backgroundColor)) && hexToRgb(String(active.color))) {
        expect(
          contrastRatio(String(active.color), String(active.backgroundColor)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("ne change rien pour un thème historique dont la piste lisait déjà", () => {
    // Classique : le variant shadow peignait la piste en `border`.
    expect(bioTabTrackStyle(palette("classic"))).toEqual({ backgroundColor: "#E2E8F0" });
    // Noir : le texte à 16 % sur le fond.
    expect(bioTabTrackStyle(palette("noir"))).toEqual({
      backgroundColor: "color-mix(in oklab, #FAFAFA 16%, transparent)",
    });
    expect(bioTabStyle(palette("classic"), true)).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      boxShadow: "0 1px 3px rgba(0,0,0,.12)",
    });
  });

  it("écarte la piste du texte quand le rendu historique ne lisait plus (Lagune)", () => {
    const lagoon = palette("lagoon");
    expect(contrastRatio(lagoon.text, mixHex(lagoon.text, lagoon.backgroundSolid, 0.16))).toBeLessThan(4.5);
    const track = bioTabTrackColor(lagoon);
    expect(hexToRgb(track)).not.toBeNull();
    expect(bioTabTrackStyle(lagoon)).toEqual({ backgroundColor: track });
  });

  it("peint le tampon (outline) et la piste relevée (raised)", () => {
    expect(bioTabTrackStyle(palette("bogolan"))).toEqual({
      backgroundColor: "#F3E9D8",
      border: "1px solid #1C1714",
    });
    expect(bioTabTrackStyle(palette("wax"))).toEqual({
      backgroundColor: "#FFFBF2",
      border: "2px solid #1748A8",
    });
    expect(bioTabStyle(palette("wax"), true)).toEqual({
      backgroundColor: "#1748A8",
      color: "#FFFBF2",
    });
    expect(bioTabStyle(palette("indigo"), true)).toEqual({
      backgroundColor: "#EAD9B8",
      color: "#141E3D",
      boxShadow: "0 2px 0 0 #C2643A",
    });
    expect(bioTabTrackStyle(palette("indigo"))).toEqual({
      backgroundColor: mixHex("#F2EBDC", "#141E3D", 0.08),
    });
  });
});

describe("bioThemeCssVars", () => {
  it("exposes every colour the page components read, with neutral decor values", () => {
    expect(bioThemeCssVars(palette("lagoon"))).toEqual({
      "--bio-bg": "#2E7D7B",
      "--bio-bg-solid": "#2E7D7B",
      "--bio-text": "#FFFFFF",
      "--bio-muted": "#D3EDEC",
      "--bio-surface": "#FFFFFF",
      "--bio-surface-text": "#123C3D",
      "--bio-border": "#FFFFFF",
      "--bio-accent": "#FFD9D2",
      "--bio-pattern": "none",
      "--bio-pattern-size": "0 0",
      "--bio-pattern-position": "0 0",
      "--bio-pattern-opacity": "0",
      "--bio-band-fill": "#2E7D7B",
      "--bio-highlight": "#FFD9D2",
      "--bio-highlight-text": "#0F172A",
    });
  });

  it("pose la tuile, la bande et la pastille d'un thème à décor", () => {
    const vars = bioThemeCssVars(palette("wax"));
    expect(vars["--bio-pattern"]).toBe(bioPatternDataUri("wax", "#FFFBF2"));
    expect(vars["--bio-pattern-size"]).toBe("96px 96px");
    expect(vars["--bio-pattern-position"]).toBe("24px 12px");
    expect(vars["--bio-pattern-opacity"]).toBe("0.2");
    expect(vars["--bio-band-fill"]).toBe("#1748A8");
    expect(vars["--bio-highlight"]).toBe("#F2B705");
    expect(vars["--bio-highlight-text"]).toBe("#17171C");
    // Un lavis n'a pas de bande : la variable retombe sur le fond.
    expect(bioThemeCssVars(palette("bogolan"))["--bio-band-fill"]).toBe("#F3E9D8");
  });
});

describe("bioFontVars", () => {
  it("applique la paire du thème seulement si le vendeur n'a pas choisi de police", () => {
    const expected = {
      "--bio-font-display": "var(--font-ojuju)",
      "--bio-font-body": "var(--font-atkinson)",
    };
    expect(bioFontVars(palette("bogolan"), "sans")).toEqual(expected);
    expect(bioFontVars(palette("bogolan"), null)).toEqual(expected);
    expect(bioFontVars(palette("bogolan"), undefined)).toEqual(expected);
    expect(bioFontVars(palette("bogolan"), "serif")).toEqual({});
    expect(bioFontVars(palette("bogolan"), "atkinson")).toEqual({});
  });

  it("ne pose rien pour un thème sans paire", () => {
    expect(bioFontVars(palette("classic"), "sans")).toEqual({});
    expect(bioFontVars(palette("sahel"), null)).toEqual({});
  });
});
