/**
 * Rendu serveur de la page publique et de la fiche produit, thème par thème.
 *
 * Les helpers de bio-themes.ts sont testés à part ; ici on vérifie que les
 * pages les branchent au bon endroit : décor d'en-tête seulement sans
 * bannière, couture rendue même sans réseaux, encre WhatsApp sur le vert
 * partout, « Commander » en toutes lettres sur chaque carte, et surtout que
 * les dix thèmes historiques ne reçoivent aucun décor.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Next et les dialogues chargés à la demande n'ont rien à faire dans un
// rendu statique : on les remplace par leur équivalent HTML le plus simple.
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: Record<string, unknown> & { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));
jest.mock("next/script", () => ({ __esModule: true, default: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/use-cart", () => ({
  useCart: (selector: (s: unknown) => unknown) =>
    selector({ items: [], addItem: jest.fn(), getItemCount: () => 0 }),
}));
jest.mock("@/components/shop/cart-drawer", () => ({ CartDrawer: () => null }));
jest.mock("@/components/shop/bio-share-sheet", () => ({ BioShareSheet: () => null }));
jest.mock("@/components/shop/tracking-pixels", () => ({ TrackingPixels: () => null }));

import { ShopPage } from "@/app/(shop)/[username]/shop-page";
import { ProductPage } from "@/app/(shop)/[username]/[productSlug]/product-page";
import { splitPriceSymbol } from "@/components/shop/bio-product-card";
import { BIO_THEME_IDS, BIO_THEMES, type BioThemeId } from "@/lib/bio-themes";
import { WHATSAPP_GREEN, WHATSAPP_INK } from "@/lib/constants";
import type { ResolvedBlock } from "@/lib/blocks/types";
import type { CategoryRow, ProductRow, ShopRow } from "@/lib/types/database";

const AFRIQUE: BioThemeId[] = ["bogolan", "wax", "indigo", "pagne"];
const HISTORIQUES = BIO_THEME_IDS.filter(
  (id) => !AFRIQUE.includes(id) && id !== "brand",
);

function shop(theme: BioThemeId, overrides: Partial<ShopRow> = {}): ShopRow {
  return {
    id: "shop-1",
    owner_id: "user-1",
    name: "Awa Couture",
    slug: "awa-couture",
    description: "Couture sur mesure.",
    logo_url: null,
    banner_url: null,
    template_id: null,
    is_published: true,
    theme_color: "#6366F1",
    accent_color: "#FFFFFF",
    font_family: "sans",
    border_radius: "lg",
    card_style: "flat",
    cta_shape: "rounded",
    cta_style: "solid",
    bio_theme: theme,
    currency: "XOF",
    contact_email: null,
    contact_phone: null,
    social_links: null,
    tiktok_pixel_id: null,
    meta_pixel_id: null,
    whatsapp_number: "+22670123456",
    checkout_mode: "whatsapp",
    intentions: [],
    featured_until: null,
    custom_domain: null,
    custom_domain_verified_at: null,
    show_biolien_badge: true,
    shipping_enabled: false,
    cash_on_delivery: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ShopRow;
}

const product = (id: string, name: string, price: number): ProductRow => ({
  id,
  shop_id: "shop-1",
  name,
  slug: id,
  description: null,
  price,
  compare_price: null,
  currency: "XOF",
  images: [],
  category_id: null,
  is_published: true,
  is_digital: false,
  stock_quantity: null,
  has_variants: false,
  metadata: null,
  created_at: "",
  updated_at: "",
});

const products = [product("robe", "Robe", 12500), product("boubou", "Boubou", 18000)];
const categories: CategoryRow[] = [];

const block = (
  type: ResolvedBlock["type"],
  config: unknown,
  id: string,
  title: string | null = null,
): ResolvedBlock =>
  ({ id, type, position: 0, title, config, style: {}, visible: true }) as ResolvedBlock;

const blocks: ResolvedBlock[] = [
  block("LINK", { url: "https://instagram.com/awa", label: "Instagram", icon: "instagram" }, "l1"),
  block("TEXT", { body: "Paiement à la livraison", align: "center" }, "t1", "Boutique"),
  block("PRODUCT_COLLECTION", { limit: 12, productIds: [] }, "pc1"),
];

function renderShop(theme: BioThemeId, overrides: Partial<ShopRow> = {}, pageBlocks = blocks) {
  return renderToStaticMarkup(
    <ShopPage
      shop={shop(theme, overrides)}
      products={products}
      categories={categories}
      blocks={pageBlocks}
      pageUrl="https://bio-lien.com/awa-couture"
    />,
  );
}

function renderProduct(theme: BioThemeId) {
  return renderToStaticMarkup(
    <ProductPage
      shop={shop(theme)}
      product={products[0]}
      variants={[]}
      related={[products[1]]}
      pageUrl="https://bio-lien.com/awa-couture/robe"
      shopUrl="https://bio-lien.com/awa-couture"
    />,
  );
}

/** Ce que React écrit pour `backgroundColor: WHATSAPP_GREEN; color: WHATSAPP_INK`. */
const WHATSAPP_STYLE = `background-color:${WHATSAPP_GREEN};color:${WHATSAPP_INK}`;

/**
 * Présence d'un utilitaire de décor comme classe — et non comme fragment
 * d'une variable (`--bio-band-fill` est posée sur tous les thèmes).
 */
function hasDecorClass(html: string, name: string): boolean {
  return new RegExp(`class="[^"]*\\b${name}\\b`).test(html);
}

describe("page publique — décor des thèmes afrique", () => {
  it.each(AFRIQUE)("%s : la bio passe à 16 px/500 avec l'interligne 1,5 des maquettes", (theme) => {
    const bio = /<p class="([^"]*)"[^>]*>Couture sur mesure\.<\/p>/.exec(renderShop(theme));
    expect(bio).not.toBeNull();
    const classes = bio![1].split(" ");
    expect(classes).toEqual(expect.arrayContaining(["text-base", "font-medium"]));
    expect(classes).not.toContain("text-sm");
  });

  it.each(AFRIQUE)("%s : zone haute en premier enfant, effacée par une bannière", (theme) => {
    const header = BIO_THEMES[theme].decor!.header!;
    const html = renderShop(theme);
    const klass = header.kind === "band" ? "bio-band" : "bio-wash";
    expect(hasDecorClass(html, klass)).toBe(true);
    // La bande de Wax est festonnée, celle du Pagne tissé a sa lisière.
    if (header.kind === "band" && header.edge) {
      expect(hasDecorClass(html, `bio-band-${header.edge}`)).toBe(true);
    }

    const withBanner = renderShop(theme, { banner_url: "https://cdn.test/banner.jpg" });
    expect(hasDecorClass(withBanner, klass)).toBe(false);
  });

  it.each(AFRIQUE)("%s : la couture est rendue même sans réseaux", (theme) => {
    const divider = BIO_THEMES[theme].decor!.divider!;
    expect(hasDecorClass(renderShop(theme, { social_links: null }), `bio-${divider}`)).toBe(true);
  });

  it.each(AFRIQUE)("%s : l'avatar chevauche la bande, pas le lavis", (theme) => {
    const header = BIO_THEMES[theme].decor!.header!;
    const html = renderShop(theme);
    const headerEl = /<header[^>]*>/.exec(html)![0];
    if (header.kind === "band") {
      // Le centre de l'avatar (48 px) tombe sur la lisière : hauteur de la
      // bande moins 48, moins les 80 px de barre haute et d'espacement.
      expect(headerEl).toContain(`margin-top:${header.height - 48 - 80}px`);
    } else {
      expect(headerEl).not.toContain("margin-top");
    }
    // Avec une bannière, le décalage est laissé aux classes de point de rupture.
    const withBanner = renderShop(theme, { banner_url: "https://cdn.test/banner.jpg" });
    expect(/<header[^>]*>/.exec(withBanner)![0]).toContain("mt-12 sm:mt-24");
  });

  it("wax : les pastilles de la barre haute s'inversent sur la bande cobalt", () => {
    const html = renderShop("wax");
    const share = /<button[^>]*aria-label="Partager cette page"[^>]*>/.exec(html)![0];
    expect(share).toContain(`background-color:${BIO_THEMES.wax.backgroundSolid}`);
    expect(share).toContain(`color:${BIO_THEMES.wax.accent}`);
  });

  it("bogolan : les pastilles gardent la surface, avec l'ombre dure", () => {
    const html = renderShop("bogolan");
    const share = /<button[^>]*aria-label="Partager cette page"[^>]*>/.exec(html)![0];
    expect(share).toContain(`background-color:${BIO_THEMES.bogolan.surface}`);
    expect(share).toContain(`box-shadow:0 3px 0 0 ${BIO_THEMES.bogolan.border}`);
  });

  it.each(AFRIQUE)("%s : compteur d'articles en rehaut sur l'onglet Boutique", (theme) => {
    const html = renderShop(theme);
    expect(html).toContain("background-color:var(--bio-highlight)");
    expect(html).toMatch(/Boutique<span[^>]*>2<\/span>/);
  });

  it.each(AFRIQUE)("%s : pastille de prix en police d'affiche, « FCFA » à part", (theme) => {
    const highlight = BIO_THEMES[theme].decor!.highlight!;
    const html = renderShop(theme, {}, blocks.filter((b) => b.type === "PRODUCT_COLLECTION"));
    expect(html).toContain(`background-color:${highlight.bg};color:${highlight.text}`);
    expect(html).toContain("var(--bio-font-display, inherit)");
    expect(html).toMatch(/12 500<\/span><span[^>]*>FCFA<\/span>/);
  });

  it.each(AFRIQUE)("%s : la fiche produit pose les variables du thème et son décor", (theme) => {
    const html = renderProduct(theme);
    expect(html).toContain("--bio-pattern:url(");
    expect(html).toContain("--bio-font-display:var(--font-ojuju)");
    const klass = BIO_THEMES[theme].decor!.header!.kind === "band" ? "bio-band" : "bio-wash";
    expect(hasDecorClass(html, klass)).toBe(true);
  });

  it("la police du vendeur gagne sur la paire du thème", () => {
    const html = renderShop("wax", { font_family: "serif" });
    expect(html).not.toContain("--bio-font-display:");
    expect(html).toContain("var(--font-playfair)");
  });
});

describe("page publique — les dix thèmes historiques rendent comme avant", () => {
  it.each(HISTORIQUES)("%s : aucun décor, aucun compteur, titres tronqués", (theme) => {
    const html = renderShop(theme);
    for (const name of ["bio-wash", "bio-band", "bio-frieze", "bio-dots", "bio-toron", "bio-stitch"]) {
      expect(hasDecorClass(html, name)).toBe(false);
    }
    expect(html).not.toContain("var(--bio-highlight)");
    expect(html).not.toContain("--bio-font-display:");
    expect(html).toContain("text-[15px] font-semibold truncate");
    expect(html).toContain("text-xs opacity-60");
    expect(/<header[^>]*>/.exec(html)![0]).not.toContain("margin-top");
    // Les pastilles de la barre haute et l'avatar restent ceux d'avant.
    expect(/<header[^>]*>\s*<div class="[^"]*\bshadow-lg\b/.test(html)).toBe(true);
  });

  // Régression vue en capture : `cn("… leading-relaxed", "text-sm")` laissait
  // tailwind-merge effacer l'interligne (la taille porte la sienne), et la bio
  // perdait 8 px sur les dix thèmes historiques.
  it.each(HISTORIQUES)("%s : la bio garde 14 px et l'interligne relâché d'avant", (theme) => {
    const bio = /<p class="([^"]*)"[^>]*>Couture sur mesure\.<\/p>/.exec(renderShop(theme));
    expect(bio).not.toBeNull();
    const classes = bio![1].split(" ");
    expect(classes).toEqual(expect.arrayContaining(["mt-3", "max-w-md", "text-sm", "leading-relaxed"]));
    expect(classes).not.toContain("text-base");
  });

  it("garde le prix historique sur la carte, sans pastille", () => {
    const html = renderShop("classic", {}, blocks.filter((b) => b.type === "PRODUCT_COLLECTION"));
    expect(html).toContain("text-sm font-bold\">12 500 FCFA<");
  });
});

describe("page publique — corrections globales", () => {
  it.each(BIO_THEME_IDS.filter((id) => id !== "brand"))(
    "%s : encre sombre sur le vert WhatsApp, flottant et « Commander »",
    (theme) => {
      const html = renderShop(theme, {}, blocks.filter((b) => b.type === "PRODUCT_COLLECTION"));
      const fab = /<a[^>]*aria-label="Commander sur WhatsApp"[^>]*>/.exec(html)![0];
      expect(fab).toContain(WHATSAPP_STYLE);
      expect(fab).toContain(`border:2px solid ${WHATSAPP_INK}`);
      expect(fab).toContain(`box-shadow:0 3px 0 0 ${WHATSAPP_INK}`);
      expect(fab).not.toContain("text-white");

      // Une carte par produit, chacune avec le mot et pleine largeur.
      const orders = html.match(/aria-label="Commander [^"]+ sur WhatsApp"/g) ?? [];
      expect(orders).toHaveLength(products.length);
      expect(html).toContain(`h-10 w-full`);
      expect(html).toMatch(new RegExp(`${WHATSAPP_STYLE};border:1px solid ${WHATSAPP_INK}[^>]*>.*?Commander</button>`));
    },
  );

  it("le bouton « Commander sur WhatsApp » de la fiche produit suit la même règle", () => {
    const html = renderProduct("classic");
    expect(html).toMatch(new RegExp(`${WHATSAPP_STYLE};border:1px solid ${WHATSAPP_INK}[^>]*>.*?Commander sur WhatsApp`));
  });

  it("le bloc WhatsApp du vendeur remplace le flottant, avec la même encre", () => {
    const html = renderShop("classic", {}, [
      block("WHATSAPP", { label: "Écris-moi", phone: null, prefilledMessage: null }, "w1"),
    ]);
    expect(html).not.toContain('aria-label="Écrire sur WhatsApp"');
    expect(html).toMatch(new RegExp(`${WHATSAPP_STYLE};border:1px solid ${WHATSAPP_INK}[^>]*>.*?Écris-moi`));
  });
});

describe("splitPriceSymbol", () => {
  it("détache un symbole qui suit le nombre après une insécable", () => {
    expect(splitPriceSymbol("12 500 FCFA")).toEqual({ amount: "12 500", symbol: "FCFA" });
    expect(splitPriceSymbol("2 500 DH")).toEqual({ amount: "2 500", symbol: "DH" });
  });

  it("laisse entier un prix dont le symbole précède le nombre", () => {
    expect(splitPriceSymbol("₦2,500.00")).toEqual({ amount: "₦2,500.00" });
    expect(splitPriceSymbol("$9.99")).toEqual({ amount: "$9.99" });
  });
});
