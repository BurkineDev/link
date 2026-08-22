/**
 * Modèle de blocs : validation des configs et résolution rétrocompatible.
 *
 * Ces tests protègent la promesse centrale de la Phase 1 — introduire les
 * blocs sans casser une seule page en ligne.
 */

import {
  BLOCK_TYPES,
  BLOCK_TYPE_META,
  isBlockType,
  parseBlockConfig,
} from "@/lib/blocks/types";
import {
  resolveBioPageBlocks,
  resolveStoredBlocks,
  synthesizeLegacyBlocks,
  type LegacyLink,
  type RawBlockRow,
} from "@/lib/blocks/resolve";

const link = (over: Partial<LegacyLink> = {}): LegacyLink => ({
  id: "l1",
  label: "Mon TikTok",
  url: "https://tiktok.com/@eva",
  icon: "tiktok",
  thumbnail_url: null,
  position: 0,
  ...over,
});

const row = (over: Partial<RawBlockRow> = {}): RawBlockRow => ({
  id: "b1",
  type: "LINK",
  position: 0,
  title: null,
  config: { url: "https://example.com", label: "Test" },
  style: {},
  visible: true,
  ...over,
});

describe("registre des types de blocs", () => {
  it("déclare un schéma et des métadonnées pour chaque type", () => {
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_TYPE_META[type]).toBeDefined();
      expect(BLOCK_TYPE_META[type].type).toBe(type);
      expect(BLOCK_TYPE_META[type].label.length).toBeGreaterThan(0);
    }
  });

  it("reconnaît les types connus et rejette les autres", () => {
    expect(isBlockType("LINK")).toBe(true);
    expect(isBlockType("PODCAST")).toBe(false);
    expect(isBlockType(null)).toBe(false);
  });
});

describe("parseBlockConfig", () => {
  it("applique les valeurs par défaut déclarées", () => {
    const config = parseBlockConfig("LINK", {
      url: "https://tiktok.com/@eva",
      label: "Mon TikTok",
    });
    expect(config?.icon).toBe("custom");
  });

  it("refuse une URL javascript: (injection via un bloc)", () => {
    expect(
      parseBlockConfig("LINK", {
        // eslint-disable-next-line no-script-url
        url: "javascript:alert(1)",
        label: "Piège",
      }),
    ).toBeNull();
  });

  it("accepte mailto: et tel:, refuse le http simple pour un média", () => {
    expect(
      parseBlockConfig("LINK", { url: "mailto:a@b.com", label: "Mail" }),
    ).not.toBeNull();
    expect(
      parseBlockConfig("IMAGE", { url: "http://example.com/a.jpg" }),
    ).toBeNull();
    expect(
      parseBlockConfig("IMAGE", { url: "https://example.com/a.jpg" }),
    ).not.toBeNull();
  });

  it("renvoie null plutôt que de lever sur une config absente", () => {
    expect(parseBlockConfig("PRODUCT", undefined)).toBeNull();
    expect(parseBlockConfig("PRODUCT", { productId: "pas-un-uuid" })).toBeNull();
  });
});

describe("resolveStoredBlocks", () => {
  it("trie par position et masque les blocs invisibles sur la page publique", () => {
    const blocks = resolveStoredBlocks([
      row({ id: "b2", position: 2 }),
      row({ id: "b1", position: 0 }),
      row({ id: "b3", position: 1, visible: false }),
    ]);
    expect(blocks.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("garde les blocs masqués pour l'éditeur", () => {
    const blocks = resolveStoredBlocks(
      [row({ id: "b3", visible: false })],
      { includeHidden: true },
    );
    expect(blocks).toHaveLength(1);
  });

  it("écarte un type inconnu sans faire tomber la page", () => {
    const blocks = resolveStoredBlocks([
      row({ id: "ok" }),
      row({ id: "futur", type: "HOLOGRAM" }),
    ]);
    expect(blocks.map((b) => b.id)).toEqual(["ok"]);
  });

  it("écarte une config invalide sans faire tomber la page", () => {
    const blocks = resolveStoredBlocks([
      row({ id: "ok" }),
      row({ id: "cassé", config: { label: "sans url" } }),
    ]);
    expect(blocks.map((b) => b.id)).toEqual(["ok"]);
  });

  it("retire une promotion expirée du public mais la garde dans l'éditeur", () => {
    const promo = row({
      id: "promo",
      type: "PROMOTION",
      config: {
        headline: "-20 %",
        expiresAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const now = new Date("2026-06-01T00:00:00.000Z");

    expect(resolveStoredBlocks([promo], { now })).toHaveLength(0);
    expect(
      resolveStoredBlocks([promo], { now, includeHidden: true }),
    ).toHaveLength(1);
  });
});

describe("synthesizeLegacyBlocks", () => {
  it("reproduit l'agencement historique : liens puis collection", () => {
    const blocks = synthesizeLegacyBlocks({
      links: [link({ id: "a", position: 1 }), link({ id: "b", position: 0 })],
      hasProducts: true,
    });

    expect(blocks.map((b) => b.type)).toEqual([
      "LINK",
      "LINK",
      "PRODUCT_COLLECTION",
    ]);
    expect(blocks[0].id).toBe("legacy-link:b");
    expect(blocks.map((b) => b.position)).toEqual([0, 1, 2]);
  });

  it("n'ajoute pas de collection quand la boutique n'a aucun produit", () => {
    const blocks = synthesizeLegacyBlocks({
      links: [link()],
      hasProducts: false,
    });
    expect(blocks.map((b) => b.type)).toEqual(["LINK"]);
  });

  it("ignore un lien historique invalide sans perdre les autres", () => {
    const blocks = synthesizeLegacyBlocks({
      links: [link({ id: "ok" }), link({ id: "ko", url: "ftp://x.test" })],
      hasProducts: false,
    });
    expect(blocks.map((b) => b.id)).toEqual(["legacy-link:ok"]);
  });

  it("reporte la vignette du lien dans la config du bloc", () => {
    const [block] = synthesizeLegacyBlocks({
      links: [link({ thumbnail_url: "https://cdn.test/a.jpg" })],
      hasProducts: false,
    });
    expect((block.config as { thumbnailUrl?: string }).thumbnailUrl).toBe(
      "https://cdn.test/a.jpg",
    );
  });
});

describe("resolveBioPageBlocks", () => {
  it("synthétise tant qu'aucun bloc n'est enregistré", () => {
    const { blocks, source } = resolveBioPageBlocks({
      rows: [],
      links: [link()],
      hasProducts: true,
    });
    expect(source).toBe("legacy");
    expect(blocks).toHaveLength(2);
  });

  it("laisse la composition du vendeur faire foi dès qu'il en a une", () => {
    const { blocks, source } = resolveBioPageBlocks({
      rows: [row({ id: "seul" })],
      links: [link(), link({ id: "l2" })],
      hasProducts: true,
    });
    expect(source).toBe("stored");
    expect(blocks.map((b) => b.id)).toEqual(["seul"]);
  });

  it("respecte un vendeur qui a volontairement retiré tous ses blocs visibles", () => {
    const { blocks, source } = resolveBioPageBlocks({
      rows: [row({ visible: false })],
      links: [link()],
      hasProducts: true,
    });
    expect(source).toBe("stored");
    expect(blocks).toHaveLength(0);
  });
});
