/**
 * Résolution des blocs d'une BioPage.
 *
 * Deux sources possibles, dans cet ordre :
 *
 *  1. **Les blocs enregistrés** (`page_blocks`) — dès que le vendeur a touché
 *     au Page Builder, sa composition fait foi.
 *
 *  2. **Une composition synthétisée** depuis ses liens (`shop_links`) et ses
 *     produits publiés — pour les vendeurs qui existaient avant les blocs.
 *
 * C'est cette bascule qui permet d'introduire le modèle de blocs sans migrer
 * de données ni casser une seule page en ligne : la synthèse produit exactement
 * ce que la page affichait déjà. La matérialisation en base se fera au premier
 * enregistrement dans le Page Builder, sous le contrôle du vendeur.
 */

import {
  blockStyleSchema,
  isBlockType,
  parseBlockConfig,
  type BlockStyle,
  type BlockType,
  type ResolvedBlock,
} from "@/lib/blocks/types";

/** Ligne brute de `page_blocks`, telle qu'elle sort de Supabase. */
export interface RawBlockRow {
  id: string;
  type: string;
  position: number;
  title: string | null;
  config: unknown;
  style: unknown;
  visible: boolean;
}

/** Lien existant, source de la synthèse rétrocompatible. */
export interface LegacyLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  thumbnail_url: string | null;
  position: number;
}

export interface ResolveOptions {
  /** Inclure les blocs masqués — vrai dans l'éditeur, faux sur la page publique. */
  includeHidden?: boolean;
  /** Date de référence, pour l'expiration des promotions (tests déterministes). */
  now?: Date;
}

function parseStyle(value: unknown): BlockStyle {
  const result = blockStyleSchema.safeParse(value ?? {});
  return result.success ? result.data : {};
}

/**
 * Un bloc PROMOTION expiré disparaît de la page publique sans que le vendeur
 * ait à le supprimer — il le retrouve dans son éditeur pour le réactiver.
 */
function isExpired(block: ResolvedBlock, now: Date): boolean {
  if (block.type !== "PROMOTION") return false;
  const expiresAt = (block.config as { expiresAt?: string | null }).expiresAt;
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime();
}

/**
 * Convertit les lignes brutes en blocs prêts à rendre.
 *
 * Les lignes dont le type est inconnu (base plus récente que le code, en plein
 * déploiement) ou dont la config est invalide sont écartées silencieusement :
 * une page publique ne doit jamais tomber à cause d'un bloc.
 */
export function resolveStoredBlocks(
  rows: RawBlockRow[],
  options: ResolveOptions = {},
): ResolvedBlock[] {
  const { includeHidden = false, now = new Date() } = options;

  return rows
    .filter((row) => includeHidden || row.visible)
    .flatMap((row) => {
      if (!isBlockType(row.type)) return [];
      const config = parseBlockConfig(row.type as BlockType, row.config);
      if (config === null) return [];

      const block: ResolvedBlock = {
        id: row.id,
        type: row.type,
        position: row.position,
        title: row.title,
        config,
        style: parseStyle(row.style),
        visible: row.visible,
      };

      if (!includeHidden && isExpired(block, now)) return [];
      return [block];
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * Compose une page pour une boutique qui n'a pas encore de blocs.
 *
 * Reproduit l'agencement historique : les liens dans l'ordre, puis la
 * collection de tous les produits publiés. Les identifiants sont préfixés
 * (`legacy-link:…`) pour être stables entre deux rendus tout en restant
 * reconnaissables — ce ne sont pas des identifiants de `page_blocks`.
 */
export function synthesizeLegacyBlocks(args: {
  links: LegacyLink[];
  hasProducts: boolean;
}): ResolvedBlock[] {
  const { links, hasProducts } = args;
  const blocks: ResolvedBlock[] = [];

  links
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((link, index) => {
      const config = parseBlockConfig("LINK", {
        url: link.url,
        label: link.label,
        icon: link.icon,
        thumbnailUrl: link.thumbnail_url,
      });
      // Un lien historique invalide (URL exotique) est ignoré plutôt que de
      // faire échouer toute la synthèse.
      if (config === null) return;

      blocks.push({
        id: `legacy-link:${link.id}`,
        type: "LINK",
        position: index,
        title: null,
        config,
        style: {},
        visible: true,
      });
    });

  if (hasProducts) {
    const config = parseBlockConfig("PRODUCT_COLLECTION", {
      layout: "grid",
      limit: 50,
    });
    if (config !== null) {
      blocks.push({
        id: "legacy-collection:all",
        type: "PRODUCT_COLLECTION",
        position: blocks.length,
        title: null,
        config,
        style: {},
        visible: true,
      });
    }
  }

  return blocks;
}

/**
 * Point d'entrée unique de la page publique et de l'éditeur.
 *
 * Bascule sur la synthèse uniquement si la boutique n'a *aucun* bloc
 * enregistré : dès qu'elle en a un, sa composition est la vérité — y compris
 * si elle est plus courte que ce que la synthèse aurait produit (le vendeur a
 * pu retirer volontairement sa grille de produits).
 */
export function resolveBioPageBlocks(args: {
  rows: RawBlockRow[];
  links: LegacyLink[];
  hasProducts: boolean;
  options?: ResolveOptions;
}): { blocks: ResolvedBlock[]; source: "stored" | "legacy" } {
  const { rows, links, hasProducts, options } = args;

  if (rows.length > 0) {
    return { blocks: resolveStoredBlocks(rows, options), source: "stored" };
  }

  return {
    blocks: synthesizeLegacyBlocks({ links, hasProducts }),
    source: "legacy",
  };
}
