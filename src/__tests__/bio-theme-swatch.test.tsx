/**
 * Aperçus du tableau de bord — la miniature partagée des sélecteurs et les
 * deux aperçus de page (réglages/onboarding et Page Builder).
 *
 * Ce qui compte ici : que la miniature montre le décor d'un thème (ruban
 * de tête, barres de bouton, point de rehaut, couture) avec les mêmes
 * fonctions de style que la page, et que les dix thèmes historiques n'en
 * reçoivent rien. Rendu statique côté serveur, sans DOM : on lit le HTML.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BIO_THEME_IDS,
  BIO_THEME_LIST,
  DEFAULT_BIO_THEME,
  bioButtonStyle,
  bioTabTrackColor,
  bioTabTrackStyle,
  groupBioThemes,
  resolveBioTheme,
  type BioThemeId,
} from "@/lib/bio-themes";
import { WHATSAPP_GREEN, WHATSAPP_INK } from "@/lib/constants";
import { BioThemeSwatch } from "@/components/dashboard/bio-theme-swatch";
import { ThemePreview } from "@/components/dashboard/theme-preview";
import { BioPagePreview } from "@/app/(dashboard)/dashboard/page/bio-page-preview";
import type { ResolvedBlock } from "@/lib/blocks/types";
import type { ShopRow } from "@/lib/types/database";

const AFRIQUE_IDS = ["bogolan", "wax", "indigo", "pagne"] as const;
const LEGACY_IDS = BIO_THEME_IDS.filter(
  (id) => !(AFRIQUE_IDS as readonly string[]).includes(id),
);

const PRIMARY = "#6366F1";
const ACCENT = "#0F172A";

function swatch(themeId: BioThemeId, primary = PRIMARY, accent = ACCENT) {
  return renderToStaticMarkup(
    createElement(BioThemeSwatch, {
      themeId,
      primaryColor: primary,
      accentColor: accent,
    }),
  );
}

function palette(id: BioThemeId) {
  return resolveBioTheme({ bio_theme: id, theme_color: PRIMARY, accent_color: ACCENT });
}

/** Un style inline React tel que le HTML le sérialise (`box-shadow:…`). */
function css(property: string, value: string | undefined) {
  return `${property}:${value}`;
}

describe("BioThemeSwatch", () => {
  it("rend chacun des 14 thèmes sans lever, sur le fond de sa palette", () => {
    for (const id of BIO_THEME_IDS) {
      const html = swatch(id);
      expect(html).toContain(`background:${palette(id).background}`);
    }
  });

  it("montre le ruban de tête du thème : lavis pour Bogolan et Indigo, bande pour Wax et Pagne tissé", () => {
    expect(swatch("bogolan")).toContain('class="bio-wash"');
    expect(swatch("bogolan")).toContain('class="bio-wash-fade"');
    expect(swatch("indigo")).toContain("--bio-wash-fade:46%");
    expect(swatch("wax")).toContain("bio-band bio-band-scallop");
    expect(swatch("pagne")).toContain("bio-band bio-band-selvedge");
  });

  it("pose les variables --bio-* dont les utilitaires du ruban ont besoin", () => {
    const html = swatch("wax");
    expect(html).toContain("--bio-band-fill:#1748A8");
    expect(html).toContain("--bio-pattern:url(");
    expect(html).toContain("--bio-pattern-opacity:0.2");
  });

  it("peint les deux barres avec bioButtonStyle, comme les boutons de la page", () => {
    for (const id of AFRIQUE_IDS) {
      const p = palette(id);
      const pill = !p.decor?.selvedge;
      const style = bioButtonStyle(p, { pill });
      const html = swatch(id);
      expect(html).toContain(css("background-color", style.backgroundColor as string));
      expect(html).toContain(css("border", style.border as string));
      if (style.boxShadow) expect(html).toContain(css("box-shadow", style.boxShadow as string));
    }
  });

  it("garde un bord droit aux barres de Pagne tissé pour que la lisière se voie", () => {
    const html = swatch("pagne");
    expect(html).toContain("rounded-[3px]");
    expect(html).toContain("inset 5px 0 0 #23407A");
    // Les autres restent des pilules.
    expect(swatch("wax")).not.toContain("rounded-[3px]");
  });

  it("ajoute le point de rehaut et le trait de couture aux seuls thèmes à décor", () => {
    for (const id of AFRIQUE_IDS) {
      const highlight = palette(id).decor?.highlight;
      expect(highlight).toBeDefined();
      const html = swatch(id);
      expect(html).toContain(css("background-color", highlight!.bg));
      expect(html).toContain(`1px dashed ${palette(id).border}`);
    }
    for (const id of LEGACY_IDS) {
      const html = swatch(id);
      expect(html).not.toContain("1px dashed");
      expect(html).not.toContain('class="bio-wash');
      expect(html).not.toContain('class="bio-band');
    }
  });

  it("n'embarque jamais de flou, même pour le variant verre de Minuit", () => {
    for (const id of BIO_THEME_IDS) {
      expect(swatch(id)).not.toContain("backdrop-filter");
    }
  });

  it("« Mes couleurs » montre les couleurs de la boutique, pas un substitut", () => {
    const html = swatch("brand", "#B45309", "#FFFFFF");
    expect(html).toContain("background:#B45309");
    expect(html).not.toContain("#6366F1");
  });
});

describe("groupBioThemes pour les sélecteurs", () => {
  it("réglages : trois groupes dans l'ordre, 14 cartes, l'Afrique de l'Ouest en tête", () => {
    const groups = groupBioThemes();
    expect(groups.map((g) => g.label)).toEqual([
      "Afrique de l'Ouest",
      "Classiques",
      "Mes couleurs",
    ]);
    expect(groups.flatMap((g) => g.themes).length).toBe(14);
    expect(groups[0].themes.map((t) => t.id)).toEqual([
      "bogolan",
      "wax",
      "indigo",
      "pagne",
      "sahel",
      "kente",
    ]);
  });

  it("onboarding : sans « Mes couleurs », 13 cartes et pas d'intertitre orphelin", () => {
    const groups = groupBioThemes(BIO_THEME_LIST.filter((t) => t.id !== "brand"));
    expect(groups.map((g) => g.group)).toEqual(["afrique", "classique"]);
    expect(groups.flatMap((g) => g.themes).length).toBe(13);
  });

  it("présélectionne Wax pour une nouvelle boutique", () => {
    expect(DEFAULT_BIO_THEME).toBe("wax");
  });
});

// ---------------------------------------------------------------------------

function preview(bioTheme: BioThemeId, extra: Partial<Parameters<typeof ThemePreview>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ThemePreview, {
      shopName: "Awa Couture",
      slug: "awa-couture",
      bioTheme,
      primaryColor: PRIMARY,
      accentColor: ACCENT,
      fontFamily: "sans",
      borderRadius: "lg",
      ctaShape: "rounded",
      ...extra,
    }),
  );
}

describe("ThemePreview", () => {
  it("rend le décor de tête et la couture des thèmes à décor, rien pour les historiques", () => {
    expect(preview("bogolan")).toContain('class="bio-wash"');
    expect(preview("bogolan")).toContain("bio-frieze");
    expect(preview("wax")).toContain("bio-band bio-band-scallop");
    expect(preview("wax")).toContain("bio-dots");
    expect(preview("indigo")).toContain("bio-toron");
    expect(preview("pagne")).toContain("bio-band-selvedge");
    expect(preview("pagne")).toContain("bio-stitch");
    for (const id of LEGACY_IDS) {
      const html = preview(id);
      expect(html).not.toContain('class="bio-wash');
      expect(html).not.toContain('class="bio-band');
      expect(html).not.toContain("bio-frieze");
    }
  });

  it("efface le lavis ou la bande quand la boutique a une bannière", () => {
    const html = preview("wax", { bannerUrl: "https://cdn.example/banner.jpg" });
    expect(html).not.toContain('class="bio-band');
    expect(html).toContain('src="https://cdn.example/banner.jpg"');
    // Les pastilles de la barre haute s'inversent sur la bannière.
    expect(html).toContain("background-color:#FFFBF2;color:#1748A8");
  });

  it("peint la piste des onglets avec bioTabTrackStyle, garde-fou de contraste compris", () => {
    for (const id of BIO_THEME_IDS) {
      const track = bioTabTrackStyle(palette(id));
      expect(preview(id)).toContain(css("background-color", track.backgroundColor as string));
    }
    // Lagune : la piste historique (blanc à 16 %) ne portait pas le libellé
    // blanc ; le garde-fou la remplace par un hex plus sombre.
    expect(preview("lagoon")).toContain(`background-color:${bioTabTrackColor(palette("lagoon"))}`);
  });

  it("écrit le prix en pastille de rehaut et « Commander » en encre sur vert", () => {
    const html = preview("wax");
    expect(html).toContain("12 000 FCFA");
    expect(html).toContain("background-color:#F2B705;color:#17171C");
    expect(html).toContain(`background-color:${WHATSAPP_GREEN};color:${WHATSAPP_INK}`);
    // Le prix historique reste un simple texte sur les thèmes sans décor.
    expect(preview("classic")).not.toContain("--bio-font-display, inherit);font-variant-numeric");
    expect(preview("classic")).toContain(`background-color:${WHATSAPP_GREEN};color:${WHATSAPP_INK}`);
  });

  it("applique la paire de polices du thème seulement si le vendeur n'a pas choisi de police", () => {
    expect(preview("bogolan")).toContain("--bio-font-display:var(--font-ojuju)");
    expect(preview("bogolan")).toContain("font-family:var(--bio-font-body)");
    expect(preview("bogolan", { fontFamily: "serif" })).not.toContain("--bio-font-display:");
    expect(preview("classic")).not.toContain("--bio-font-display:");
  });

  it("descend le profil pour que l'avatar chevauche la lisière de la bande", () => {
    // Wax : bande 172 px réduite à 60 % = 103 px ; avatar 56 px ; barre haute 36 px.
    expect(preview("wax")).toContain("margin-top:39.2px");
    // Pagne tissé : bande de 104 px → l'avatar part juste sous la barre haute.
    expect(preview("pagne")).toContain("margin-top:0");
    expect(preview("bogolan")).not.toContain("margin-top:");
  });
});

// ---------------------------------------------------------------------------

function shopRow(overrides: Partial<ShopRow> = {}): ShopRow {
  return {
    id: "shop-1",
    user_id: "u1",
    name: "Awa Couture",
    slug: "awa-couture",
    description: "Couture sur mesure",
    logo_url: null,
    banner_url: null,
    bio_theme: "wax",
    theme_color: PRIMARY,
    accent_color: ACCENT,
    font_family: "sans",
    border_radius: "lg",
    cta_shape: "rounded",
    ...overrides,
  } as ShopRow;
}

const LINK_BLOCK = {
  id: "b1",
  type: "LINK",
  title: null,
  visible: true,
  config: { label: "Mon TikTok", url: "https://tiktok.com/@awa" },
} as unknown as ResolvedBlock;

const PRODUCT_BLOCK = {
  id: "b2",
  type: "PRODUCT_COLLECTION",
  title: "Boutique",
  visible: true,
  config: {},
} as unknown as ResolvedBlock;

function builderPreview(shop: ShopRow, blocks: ResolvedBlock[] = [LINK_BLOCK, PRODUCT_BLOCK]) {
  return renderToStaticMarkup(
    createElement(BioPagePreview, { shop, palette: resolveBioTheme(shop), blocks }),
  );
}

describe("BioPagePreview", () => {
  it("rend la bande, la couture et les boutons bordés de Wax", () => {
    const html = builderPreview(shopRow());
    expect(html).toContain("bio-band bio-band-scallop");
    expect(html).toContain("bio-dots");
    expect(html).toContain("border:2px solid #1748A8");
    // Cartes produit crème (decor.card), pas cobalt.
    expect(html).toContain("background-color:#FFFFFF;color:#17171C");
    expect(html).toContain("background-color:#F2B705");
  });

  it("garde le rendu historique pour un thème sans décor", () => {
    const html = builderPreview(shopRow({ bio_theme: "classic" }));
    expect(html).not.toContain('class="bio-band');
    expect(html).not.toContain("bio-dots");
    expect(html).not.toContain("margin-top:");
    expect(html).toContain("background-color:#FFFFFF;color:#0F172A;border:1px solid #E2E8F0");
  });

  it("efface la bande derrière une bannière", () => {
    const html = builderPreview(shopRow({ banner_url: "https://cdn.example/b.jpg" }));
    expect(html).not.toContain('class="bio-band');
    expect(html).toContain('src="https://cdn.example/b.jpg"');
  });
});
