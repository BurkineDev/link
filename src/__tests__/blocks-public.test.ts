import { isProductBlock, selectProductsForBlocks } from "@/lib/blocks/public";
import { blockClickEndpoint } from "@/lib/blocks/ids";
import type { ResolvedBlock } from "@/lib/blocks/types";

const block = (
  type: ResolvedBlock["type"],
  config: unknown,
  id = `${type}-1`,
): ResolvedBlock => ({
  id,
  type,
  position: 0,
  title: null,
  config: config as ResolvedBlock["config"],
  style: {},
  visible: true,
});

const products = [
  { id: "11111111-1111-1111-1111-111111111111", category_id: "cat-a" },
  { id: "22222222-2222-2222-2222-222222222222", category_id: "cat-b" },
  { id: "33333333-3333-3333-3333-333333333333", category_id: "cat-a" },
];

describe("isProductBlock", () => {
  it("ne retient que les blocs qui alimentent la vitrine", () => {
    expect(isProductBlock(block("PRODUCT", {}))).toBe(true);
    expect(isProductBlock(block("PRODUCT_COLLECTION", {}))).toBe(true);
    expect(isProductBlock(block("LINK", {}))).toBe(false);
    expect(isProductBlock(block("TEXT", {}))).toBe(false);
  });
});

describe("selectProductsForBlocks", () => {
  it("prend tout le catalogue pour une collection sans filtre", () => {
    const selected = selectProductsForBlocks(
      [block("PRODUCT_COLLECTION", { limit: 12, productIds: [] })],
      products,
    );
    expect(selected).toEqual(products);
  });

  it("respecte la catégorie choisie", () => {
    const selected = selectProductsForBlocks(
      [block("PRODUCT_COLLECTION", { categoryId: "cat-a", limit: 12 })],
      products,
    );
    expect(selected.map((p) => p.id)).toEqual([products[0].id, products[2].id]);
  });

  it("respecte la limite", () => {
    const selected = selectProductsForBlocks(
      [block("PRODUCT_COLLECTION", { limit: 2, productIds: [] })],
      products,
    );
    expect(selected).toHaveLength(2);
  });

  it("suit l'ordre d'une liste explicite", () => {
    const selected = selectProductsForBlocks(
      [
        block("PRODUCT_COLLECTION", {
          productIds: [products[2].id, products[0].id],
          limit: 12,
        }),
      ],
      products,
    );
    expect(selected.map((p) => p.id)).toEqual([products[2].id, products[0].id]);
  });

  it("ne montre pas deux fois un produit mis en avant plus haut", () => {
    const selected = selectProductsForBlocks(
      [
        block("PRODUCT", { productId: products[1].id }, "p"),
        block("PRODUCT_COLLECTION", { limit: 12, productIds: [] }, "c"),
      ],
      products,
    );
    expect(selected.map((p) => p.id)).toEqual([
      products[1].id,
      products[0].id,
      products[2].id,
    ]);
  });

  it("ignore un identifiant de produit qui n'existe plus", () => {
    const selected = selectProductsForBlocks(
      [block("PRODUCT", { productId: "44444444-4444-4444-4444-444444444444" })],
      products,
    );
    expect(selected).toEqual([]);
  });

  it("ne rend rien quand la page n'a aucun bloc produit", () => {
    expect(selectProductsForBlocks([], products)).toEqual([]);
  });
});

describe("blockClickEndpoint", () => {
  it("compte un bloc enregistré sur page_blocks", () => {
    expect(blockClickEndpoint("abc-123")).toBe("/api/blocks/abc-123/click");
  });

  it("renvoie un bloc synthétisé vers le lien dont il vient", () => {
    expect(blockClickEndpoint("legacy-link:abc-123")).toBe(
      "/api/shop-links/abc-123/click",
    );
  });
});
