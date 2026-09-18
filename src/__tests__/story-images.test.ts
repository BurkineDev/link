/**
 * Images de story (/api/story/[slug] et /api/story/[slug]/[productSlug]).
 *
 * Le décor des thèmes « Afrique de l'Ouest » y est rendu par satori, qui ne
 * connaît ni var(), ni color-mix, ni les pseudo-éléments, refuse une
 * propriété à `undefined` et exige `display: flex` sur tout div à plusieurs
 * enfants : on vérifie ces contraintes sur l'arbre réellement produit, pour
 * les quatorze thèmes. Et les dix thèmes historiques doivent recevoir
 * exactement les styles d'avant (vérifié pixel pour pixel à la main, ici
 * verrouillé sur les valeurs).
 */

import type { CSSProperties, ReactElement } from "react";
import {
  BIO_THEME_IDS,
  BIO_THEMES,
  contrastRatio,
  mixHex,
  resolveBioTheme,
  type BioPalette,
  type BioThemeId,
} from "@/lib/bio-themes";
import {
  STORY_BAND_HEIGHT,
  STORY_HEIGHT,
  STORY_WIDTH,
  StoryDivider,
  StoryHeaderDecor,
  scalePx,
  storyAvatarStyle,
  storyButtonStyle,
  storyCardStyle,
  storyFriezeColor,
  storyHasBand,
  storyHeaderHeight,
  storyPatternStyle,
  storyPillStyle,
  storyPriceBadgeStyle,
  storyRaise,
} from "@/app/api/story/story-decor";

// ---------------------------------------------------------------------------
// Doubles : next/og capture l'arbre au lieu de le rasteriser, Prisma renvoie
// la boutique de test.
// ---------------------------------------------------------------------------

const mockRendered: Array<{
  element: ReactElement;
  options: { width: number; height: number; headers?: Record<string, string> };
}> = [];

jest.mock("next/og", () => ({
  ImageResponse: class {
    status = 200;
    headers: Headers;
    constructor(
      element: ReactElement,
      options: { width: number; height: number; headers?: Record<string, string> },
    ) {
      mockRendered.push({ element, options });
      this.headers = new Headers(options.headers ?? {});
    }
  },
}));

let _shop: Record<string, unknown> | null = null;
let _product: Record<string, unknown> | null = null;
const mockPrisma = {
  shop: { findFirst: jest.fn(async () => _shop) },
  product: { findFirst: jest.fn(async () => _product) },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as getPageStory } from "@/app/api/story/[slug]/route";
import { GET as getProductStory } from "@/app/api/story/[slug]/[productSlug]/route";

const SHOP = {
  id: "a1b2c3d4-0000-4000-8000-000000000002",
  name: "Awa Couture",
  slug: "awa-couture",
  description: "Couture sur mesure en wax et pagne tissé.",
  logoUrl: null,
  bioTheme: "classic",
  themeColor: "#6366F1",
  accentColor: "#0F172A",
  currency: "XOF",
};
const PRODUCT = {
  name: "Ensemble pagne 3 pièces",
  slug: "ensemble-pagne",
  price: "28500",
  comparePrice: "35000",
  currency: "XOF",
  images: [],
};

beforeEach(() => {
  mockRendered.length = 0;
  _shop = { ...SHOP };
  _product = { ...PRODUCT };
  mockPrisma.shop.findFirst.mockClear();
  mockPrisma.product.findFirst.mockClear();
});

function pageStory(slug: string, query = "") {
  return getPageStory(new Request(`http://localhost:3000/api/story/${slug}${query}`), {
    params: Promise.resolve({ slug }),
  });
}

function productStory(slug: string, productSlug: string, query = "") {
  return getProductStory(
    new Request(`http://localhost:3000/api/story/${slug}/${productSlug}${query}`),
    { params: Promise.resolve({ slug, productSlug }) },
  );
}

// ---------------------------------------------------------------------------
// Parcours de l'arbre React tel que satori le voit : les composants fonction
// sont appelés, les fragments n'existent pas, null et booléens disparaissent.
// ---------------------------------------------------------------------------

interface Node {
  type: string;
  style: CSSProperties;
  children: Array<Node | string>;
}

function isElement(value: unknown): value is ReactElement {
  return typeof value === "object" && value !== null && "type" in value && "props" in value;
}

function expand(value: unknown): Array<Node | string> {
  if (value === null || value === undefined || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap(expand);
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (!isElement(value)) return [];
  const props = value.props as { style?: CSSProperties; children?: unknown };
  if (typeof value.type === "function") {
    return expand((value.type as (p: unknown) => unknown)(props));
  }
  return [
    {
      type: String(value.type),
      style: props.style ?? {},
      children: expand(props.children),
    },
  ];
}

function root(): Node {
  const last = mockRendered[mockRendered.length - 1];
  if (!last) throw new Error("aucune image rendue");
  const nodes = expand(last.element);
  if (nodes.length !== 1 || typeof nodes[0] === "string") {
    throw new Error("la racine doit être un seul élément");
  }
  return nodes[0];
}

function* walk(node: Node): Generator<Node> {
  yield node;
  for (const child of node.children) {
    if (typeof child !== "string") yield* walk(child);
  }
}

function find(node: Node, predicate: (n: Node) => boolean): Node | undefined {
  for (const n of walk(node)) if (predicate(n)) return n;
  return undefined;
}

function texts(node: Node): string[] {
  const out: string[] = [];
  for (const n of walk(node)) {
    for (const child of n.children) if (typeof child === "string") out.push(child);
  }
  return out;
}

/** Ce que satori refuse : un div à plusieurs enfants sans flex, une valeur `undefined`, un `var()`. */
function assertSatoriSafe(node: Node) {
  for (const n of walk(node)) {
    if (n.type === "div" && n.children.length > 1) {
      expect(n.style.display).toBe("flex");
    }
    for (const [key, value] of Object.entries(n.style)) {
      expect(`${key}=${String(value)}`).not.toMatch(/undefined|var\(|color-mix/);
    }
  }
}

const palette = (id: BioThemeId): BioPalette =>
  resolveBioTheme({ bio_theme: id, theme_color: "#6366F1", accent_color: "#0F172A" });

const DECOR_IDS: BioThemeId[] = ["bogolan", "wax", "indigo", "pagne"];
const LEGACY_IDS = BIO_THEME_IDS.filter((id) => !DECOR_IDS.includes(id));

// ---------------------------------------------------------------------------
// Helpers purs
// ---------------------------------------------------------------------------

describe("scalePx", () => {
  test("double chaque longueur en px et laisse le reste intact", () => {
    expect(scalePx("1px solid #1C1714")).toBe("2px solid #1C1714");
    expect(scalePx("0 3px 0 0 #C2643A")).toBe("0 6px 0 0 #C2643A");
    expect(scalePx("inset 5px 0 0 #23407A")).toBe("inset 10px 0 0 #23407A");
    expect(scalePx("0 0 0 4px #FFFBF2, 0 0 0 9px #F2B705")).toBe(
      "0 0 0 8px #FFFBF2, 0 0 0 18px #F2B705",
    );
    expect(scalePx("#1748A8")).toBe("#1748A8");
    expect(scalePx("24px 12px", 3)).toBe("72px 36px");
  });
});

describe("thèmes sans décor : les styles historiques de la story, à l'identique", () => {
  test.each(LEGACY_IDS)("%s", (id) => {
    const p = palette(id);
    const legacy = {
      backgroundColor: p.surface,
      color: p.surfaceText,
      border: `2px solid ${p.border}`,
    };
    expect(storyHeaderHeight(p)).toBe(0);
    expect(storyHasBand(p)).toBe(false);
    expect(StoryHeaderDecor({ palette: p })).toBeNull();
    expect(StoryDivider({ palette: p })).toBeNull();
    expect(storyPatternStyle(p)).toBeUndefined();
    expect(storyPillStyle(p)).toEqual(legacy);
    expect(storyButtonStyle(p)).toEqual(legacy);
    expect(storyButtonStyle(p, { pill: true })).toEqual(legacy);
    expect(storyCardStyle(p)).toEqual({
      backgroundColor: p.surface,
      border: `6px solid ${p.surface}`,
    });
    expect(storyAvatarStyle(p, "image")).toEqual({ border: `6px solid ${p.surface}` });
    expect(storyAvatarStyle(p, "initials")).toEqual(legacy);
    expect(storyPriceBadgeStyle(p)).toBeUndefined();
    expect(storyRaise(p)).toBeUndefined();
  });
});

describe("zone haute", () => {
  test("lavis à ×2,5 pour Bogolan et Indigo, bande fixe pour Wax et Pagne tissé", () => {
    expect(storyHeaderHeight(palette("bogolan"))).toBe(550);
    expect(storyHeaderHeight(palette("indigo"))).toBe(520);
    expect(storyHeaderHeight(palette("wax"))).toBe(STORY_BAND_HEIGHT);
    expect(storyHeaderHeight(palette("pagne"))).toBe(STORY_BAND_HEIGHT);
    expect(storyHasBand(palette("wax"))).toBe(true);
    expect(storyHasBand(palette("bogolan"))).toBe(false);
  });

  test("la tuile est la data-URI de la page, doublée, à une position numérique (satori ne lit pas « center top »)", () => {
    for (const id of DECOR_IDS) {
      const p = palette(id);
      const style = storyPatternStyle(p)!;
      expect(style.backgroundImage).toBe(p.decor!.pattern!.image);
      expect(String(style.backgroundImage)).toMatch(/^url\("data:image\/svg\+xml,/);
      expect(style.backgroundSize).toBe(scalePx(p.decor!.pattern!.size));
      expect(String(style.backgroundPosition)).toMatch(/^-?\d+px -?\d+px$/);
      expect(style.backgroundRepeat).toBe("repeat");
      expect(style.opacity).toBe(p.decor!.pattern!.opacity);
    }
    expect(storyPatternStyle(palette("wax"))!.backgroundPosition).toBe("48px 24px");
    // Tuile thioup de 112 px centrée sur 1080 : (1080 mod 112) / 2 = 36.
    expect(storyPatternStyle(palette("indigo"))!.backgroundPosition).toBe("36px 0px");
    expect(storyPatternStyle(palette("bogolan"))!.backgroundPosition).toBe("0px 0px");
  });

  test("le lavis fond vers le fond de page avec sa propre couleur à opacité 0, pas vers un noir transparent", () => {
    const nodes = expand(StoryHeaderDecor({ palette: palette("indigo") }));
    const wrapper = nodes[0] as Node;
    const fade = find(wrapper, (n) => String(n.style.backgroundImage).startsWith("linear-gradient"))!;
    expect(fade.style.backgroundImage).toBe(
      "linear-gradient(to bottom, rgba(20, 30, 61, 0) 46%, #141E3D 100%)",
    );
    expect(wrapper.style.height).toBe(520);
  });

  test("la bande Wax est festonnée de disques cobalt centrés sur son bord ; celle de Pagne porte fils et lisière", () => {
    const wax = expand(StoryHeaderDecor({ palette: palette("wax") }))[0] as Node;
    expect(wax.style.backgroundColor).toBe("#1748A8");
    expect(wax.style.height).toBe(STORY_BAND_HEIGHT);
    const scallop = find(wax, (n) => n.style.top === STORY_BAND_HEIGHT - 13)!;
    expect(scallop.children).toHaveLength(Math.ceil(STORY_WIDTH / 32));
    expect((scallop.children[0] as Node).style).toMatchObject({
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: "#1748A8",
    });

    const pagne = expand(StoryHeaderDecor({ palette: palette("pagne") }))[0] as Node;
    expect(pagne.style.boxShadow).toBe("0 4px 0 #F7F3EA, 0 8px 0 #23407A, 0 12px 0 #B5541C");
    const ochreThread = find(pagne, (n) => n.style.backgroundColor === "#B5541C")!;
    expect(ochreThread.style.width).toBe(6);
  });
});

describe("couture", () => {
  test("la frise bogolan a la couleur du color-mix de la page, en hex, et ne répète la tuile qu'en x", () => {
    expect(storyFriezeColor(palette("bogolan"))).toBe("#DED4C4");
    expect(storyFriezeColor(palette("bogolan"))).toBe(mixHex("#1C1714", "#F3E9D8", 0.1));
    const frieze = expand(StoryDivider({ palette: palette("bogolan") }))[0] as Node;
    expect(frieze.style).toMatchObject({
      width: STORY_WIDTH,
      height: 36,
      backgroundColor: "#DED4C4",
      backgroundRepeat: "repeat-x",
      backgroundPosition: "6px 2px",
      opacity: 1,
      borderTop: "2px solid #1C1714",
    });
  });

  test("points de Wax, toron d'Indigo et piqûre de Pagne sont des rangées de div (pas de dégradé répété)", () => {
    const dots = expand(StoryDivider({ palette: palette("wax") }))[0] as Node;
    expect(dots.children).toHaveLength(11);
    expect((dots.children[0] as Node).style.backgroundColor).toBe("#1748A8");

    const toron = expand(StoryDivider({ palette: palette("indigo") }))[0] as Node;
    expect(toron.children.length).toBeGreaterThan(30);
    expect((toron.children[0] as Node).style.backgroundColor).toBe(
      mixHex("#EAD9B8", "#141E3D", 0.55),
    );

    const stitch = expand(StoryDivider({ palette: palette("pagne") }))[0] as Node;
    expect(stitch.style.opacity).toBe(0.55);
    expect((stitch.children[0] as Node).style).toMatchObject({ width: 12, height: 2 });
  });
});

describe("reliefs des thèmes à décor", () => {
  test("Bogolan : filet d'encre et ombre dure doublés sur boutons et pastilles", () => {
    const p = palette("bogolan");
    expect(storyButtonStyle(p)).toEqual({
      backgroundColor: "#FBF7EF",
      color: "#1C1714",
      border: "2px solid #1C1714",
      boxShadow: "0 6px 0 0 #1C1714",
    });
    expect(storyPillStyle(p)).toMatchObject({
      backgroundColor: "#FBF7EF",
      boxShadow: "0 6px 0 0 #1C1714",
    });
    expect(storyRaise(p)).toBe("0 6px 0 0 #1C1714");
    expect(storyAvatarStyle(p, "initials")).toEqual({
      backgroundColor: "#FBF7EF",
      color: "#1C1714",
      border: "4px solid #1C1714",
      boxShadow: "0 0 0 6px #F3E9D8, 0 0 0 10px #1C1714",
    });
  });

  test("Wax : pastille inversée sur la bande, boutons cobalt bordés, carte blanche, anneaux moutarde", () => {
    const p = palette("wax");
    expect(storyPillStyle(p)).toEqual({
      backgroundColor: "#FFFBF2",
      color: "#1748A8",
      border: "2px solid #1748A8",
    });
    expect(storyButtonStyle(p)).toEqual({
      backgroundColor: "#1748A8",
      color: "#FFFFFF",
      border: "4px solid #1748A8",
    });
    expect(storyCardStyle(p)).toEqual({
      backgroundColor: "#FFFFFF",
      color: "#17171C",
      border: "4px solid #1748A8",
    });
    expect(storyAvatarStyle(p, "initials")).toEqual({
      backgroundColor: "#FFFBF2",
      color: "#1748A8",
      boxShadow: "0 0 0 8px #FFFBF2, 0 0 0 18px #F2B705",
    });
    expect(storyAvatarStyle(p, "image")).toEqual({
      boxShadow: "0 0 0 8px #FFFBF2, 0 0 0 18px #F2B705",
    });
    expect(storyPriceBadgeStyle(p)).toEqual({ backgroundColor: "#F2B705", color: "#17171C" });
  });

  test("Pagne tissé : lisière de 10 px sur les boutons, sauf en forme pilule", () => {
    const p = palette("pagne");
    expect(storyButtonStyle(p).boxShadow).toBe("inset 10px 0 0 #23407A");
    expect(storyButtonStyle(p, { pill: true }).boxShadow).toBeUndefined();
    expect(storyButtonStyle(p).border).toBe("4px solid #23407A");
  });

  test("Indigo : la pastille de prix passe en sable relevé, son rehaut étant le fond de page", () => {
    const p = palette("indigo");
    expect(storyPriceBadgeStyle(p)).toEqual({
      backgroundColor: "#EAD9B8",
      color: "#141E3D",
      boxShadow: "0 6px 0 0 #C2643A",
    });
    // L'anneau « raise » apporte son propre filet (1 px sur la page → 2 px),
    // qui l'emporte sur le filet standard, comme dans bio-profile.
    expect(storyAvatarStyle(p, "image")).toEqual({
      border: "2px solid #C2643A",
      boxShadow: "0 6px 0 0 #C2643A",
    });
  });

  test("la pastille de prix se lit (≥ 4,5:1) et se détache du fond sur les quatre thèmes", () => {
    for (const id of DECOR_IDS) {
      const p = palette(id);
      const badge = storyPriceBadgeStyle(p)!;
      expect(contrastRatio(String(badge.color), String(badge.backgroundColor))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(String(badge.backgroundColor), p.backgroundSolid)).toBeGreaterThanOrEqual(1.6);
    }
  });

  test("aucun style de story ne contient var(), color-mix, backdrop-filter ni undefined", () => {
    for (const id of BIO_THEME_IDS) {
      const p = palette(id);
      const styles = [
        storyPillStyle(p),
        storyButtonStyle(p),
        storyButtonStyle(p, { pill: true }),
        storyCardStyle(p),
        storyAvatarStyle(p, "image"),
        storyAvatarStyle(p, "initials"),
        storyPriceBadgeStyle(p) ?? {},
        storyPatternStyle(p) ?? {},
      ];
      for (const style of styles) {
        expect(style).not.toHaveProperty("backdropFilter");
        expect(style).not.toHaveProperty("fontFamily");
        for (const [key, value] of Object.entries(style)) {
          expect(`${key}=${String(value)}`).not.toMatch(/undefined|var\(|color-mix/);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

describe("GET /api/story/[slug]", () => {
  test("slug invalide → 404 sans lecture ; boutique inconnue ou non publiée → 404", async () => {
    expect((await pageStory("no")).status).toBe(404);
    expect(mockPrisma.shop.findFirst).not.toHaveBeenCalled();
    _shop = null;
    expect((await pageStory("inconnue")).status).toBe(404);
    expect(mockPrisma.shop.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "inconnue", isPublished: true } }),
    );
  });

  test("200, 1080×1920, cache d'une heure, palette de la boutique", async () => {
    const res = await pageStory("awa-couture");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(mockRendered[0].options).toMatchObject({ width: STORY_WIDTH, height: STORY_HEIGHT });
    const tree = root();
    expect(tree.style.background).toBe(BIO_THEMES.classic.background);
    expect(texts(tree)).toEqual(
      expect.arrayContaining(["Bio-Lien", "Awa Couture", "Découvre mes produits", "Commande en 2 minutes"]),
    );
  });

  test("thème historique : pas de zone haute, pastilles et boutons en pilule comme avant", async () => {
    await pageStory("awa-couture");
    const tree = root();
    expect(find(tree, (n) => n.style.position === "absolute")).toBeUndefined();
    const button = find(tree, (n) => n.children.includes("Découvre mes produits"))!;
    expect(button.style).toMatchObject({
      borderRadius: 999,
      backgroundColor: "#FFFFFF",
      border: "2px solid #E2E8F0",
    });
    expect(button.style.boxShadow).toBeUndefined();
    // Le bloc profil garde son écart historique de 88 px sous la pastille.
    const avatar = find(tree, (n) => n.children.includes("A"))!;
    expect(avatar.style).toMatchObject({ border: "2px solid #E2E8F0", backgroundColor: "#FFFFFF" });
    const profile = find(tree, (n) => n.children.includes(avatar))!;
    expect(profile.style.marginTop).toBe(88);
  });

  test("?theme=wax : bande cobalt, avatar à cheval sur la lisière, pastille inversée, couture de points", async () => {
    await pageStory("awa-couture", "?theme=wax");
    const tree = root();
    const band = find(tree, (n) => n.style.backgroundColor === "#1748A8" && n.style.height === STORY_BAND_HEIGHT)!;
    expect(band.style).toMatchObject({ position: "absolute", top: 0, width: STORY_WIDTH });
    expect(tree.children[0]).toBe(band);

    const avatar = find(tree, (n) => n.children.includes("A"))!;
    expect(avatar.style.boxShadow).toBe("0 0 0 8px #FFFBF2, 0 0 0 18px #F2B705");
    const profile = find(tree, (n) => n.children.includes(avatar))!;
    // Centre de l'avatar (220 px) sur le bord bas de la bande : 96 + 74 + gap + 110 = 320.
    expect(96 + 74 + Number(profile.style.marginTop) + 110).toBe(STORY_BAND_HEIGHT);

    const wordmark = find(tree, (n) => n.children.includes("Bio-Lien"))!;
    expect(wordmark.style).toMatchObject({ backgroundColor: "#FFFBF2", color: "#1748A8" });

    const button = find(tree, (n) => n.children.includes("Découvre mes produits"))!;
    expect(button.style).toMatchObject({ borderRadius: 28, backgroundColor: "#1748A8", border: "4px solid #1748A8" });

    const dots = find(tree, (n) => n.children.length === 11 && (n.children[0] as Node).style?.backgroundColor === "#1748A8");
    expect(dots).toBeDefined();
  });

  test("?theme=bogolan : lavis puis fondu, frise pleine largeur sous le profil, QR en relief", async () => {
    await pageStory("awa-couture", "?theme=bogolan");
    const tree = root();
    const wash = tree.children[0] as Node;
    expect(wash.style).toMatchObject({ position: "absolute", height: 550 });
    expect((wash.children[0] as Node).style.opacity).toBe(0.08);
    expect(String((wash.children[1] as Node).style.backgroundImage)).toMatch(/^linear-gradient\(to bottom, rgba\(243, 233, 216, 0\) 35%/);
    const frieze = find(tree, (n) => n.style.backgroundRepeat === "repeat-x")!;
    expect(frieze.style.width).toBe(STORY_WIDTH);
    const qr = find(tree, (n) => n.style.background === "#FFFFFF" && n.style.padding === 28)!;
    expect(qr.style.boxShadow).toBe("0 6px 0 0 #1C1714");
  });

  test("un ?theme inconnu est ignoré, un thème connu l'emporte sur celui de la boutique", async () => {
    await pageStory("awa-couture", "?theme=disco");
    expect(root().style.background).toBe(BIO_THEMES.classic.background);
    await pageStory("awa-couture", "?theme=indigo");
    expect(root().style.background).toBe("#141E3D");
  });

  test.each(BIO_THEME_IDS)("%s : l'arbre respecte les règles de satori", async (id) => {
    await pageStory("awa-couture", `?theme=${id}`);
    assertSatoriSafe(root());
  });
});

describe("GET /api/story/[slug]/[productSlug]", () => {
  test("produit inconnu ou non publié → 404 ; slug invalide → 404 sans lecture", async () => {
    expect((await productStory("awa couture", "x")).status).toBe(404);
    expect(mockPrisma.shop.findFirst).not.toHaveBeenCalled();
    _product = null;
    expect((await productStory("awa-couture", "rien")).status).toBe(404);
    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: SHOP.id, slug: "rien", isPublished: true },
      }),
    );
  });

  test("thème historique : prix en accent, badge promo rose, carte cadrée de surface, comme avant", async () => {
    const res = await productStory("awa-couture", "ensemble-pagne");
    expect(res.status).toBe(200);
    const tree = root();
    const price = find(tree, (n) => n.children.includes("28 500 FCFA"))!;
    expect(price.style).toMatchObject({ fontSize: 84, color: BIO_THEMES.classic.accent });
    const sale = find(tree, (n) => n.children.includes("−") && n.children.includes("19"))!;
    expect(sale.style).toMatchObject({ backgroundColor: "#F43F5E", color: "#FFFFFF" });
    const card = find(tree, (n) => n.style.width === 820)!;
    expect(card.style).toMatchObject({ borderRadius: 56, border: "6px solid #FFFFFF", backgroundColor: "#FFFFFF" });
    expect(find(tree, (n) => n.style.position === "absolute" && n.style.top === 0)).toBeUndefined();
  });

  test("?theme=wax : pastille moutarde « 28 500 » + « FCFA », badge promo moutarde, carte blanche bordée sur la bande", async () => {
    await productStory("awa-couture", "ensemble-pagne", "?theme=wax");
    const tree = root();
    const badge = find(tree, (n) => n.children.includes("28 500"))!;
    expect(badge.style).toMatchObject({ backgroundColor: "#F2B705", color: "#17171C", borderRadius: 999 });
    expect(texts(badge)).toEqual(["28 500", "FCFA"]);
    const struck = find(tree, (n) => n.style.textDecoration === "line-through")!;
    expect(struck.children).toEqual(["35 000 FCFA"]);
    const sale = find(tree, (n) => n.children.includes("−") && n.children.includes("19"))!;
    expect(sale.style).toMatchObject({ backgroundColor: "#F2B705", color: "#17171C" });
    const card = find(tree, (n) => n.style.width === 820)!;
    expect(card.style).toMatchObject({ borderRadius: 28, backgroundColor: "#FFFFFF", border: "4px solid #1748A8" });
    expect((tree.children[0] as Node).style.backgroundColor).toBe("#1748A8");
  });

  test("?theme=indigo : prix en pastille sable relevée, carte sable à ombre terracotta", async () => {
    await productStory("awa-couture", "ensemble-pagne", "?theme=indigo");
    const tree = root();
    const badge = find(tree, (n) => n.children.includes("28 500"))!;
    expect(badge.style).toMatchObject({ backgroundColor: "#EAD9B8", color: "#141E3D", boxShadow: "0 6px 0 0 #C2643A" });
    const card = find(tree, (n) => n.style.width === 820)!;
    expect(card.style).toMatchObject({ backgroundColor: "#EAD9B8", border: "2px solid #C2643A", boxShadow: "0 6px 0 0 #C2643A" });
  });

  test("une image WebP est ignorée (satori ne la décode pas) ; une JPEG est rendue", async () => {
    _product = { ...PRODUCT, images: [{ url: "https://cdn.example/legacy.webp" }] };
    await productStory("awa-couture", "ensemble-pagne");
    expect(find(root(), (n) => n.type === "img" && n.style.objectFit === "cover")).toBeUndefined();
    _product = { ...PRODUCT, images: [{ url: "https://cdn.example/photo.jpg" }] };
    await productStory("awa-couture", "ensemble-pagne", "?theme=pagne");
    expect(find(root(), (n) => n.type === "img" && n.style.objectFit === "cover")).toBeDefined();
  });

  test.each(BIO_THEME_IDS)("%s : l'arbre respecte les règles de satori", async (id) => {
    await productStory("awa-couture", "ensemble-pagne", `?theme=${id}`);
    assertSatoriSafe(root());
  });
});
