/**
 * Identifiants de blocs — sans dépendance.
 *
 * Ce module est séparé de `blocks/types.ts` volontairement : ce dernier porte
 * les schémas Zod de validation, et la page publique n'a besoin que de savoir
 * où compter un clic. Les garder ensemble embarquerait Zod dans le bundle de
 * chaque BioPage — plusieurs dizaines de kilo-octets envoyés à des visiteurs
 * en 3G pour du code qui ne s'exécute jamais chez eux.
 */

/**
 * Préfixe des blocs synthétisés depuis `shop_links`.
 *
 * Il rend l'origine d'un bloc lisible partout où son id circule — et c'est ce
 * qui permet de continuer à compter les clics sur la bonne table tant que la
 * boutique n'a pas adopté sa composition.
 */
export const LEGACY_LINK_PREFIX = "legacy-link:";

/**
 * Endpoint de comptage d'un tap sur un bloc.
 *
 * Un bloc synthétisé n'existe pas en base : son compteur est celui du
 * `shop_links` dont il vient. Un bloc enregistré a le sien. Router ici plutôt
 * que dans le composant évite qu'une page mixte perde la moitié de ses clics.
 */
export function blockClickEndpoint(blockId: string): string {
  return blockId.startsWith(LEGACY_LINK_PREFIX)
    ? `/api/shop-links/${blockId.slice(LEGACY_LINK_PREFIX.length)}/click`
    : `/api/blocks/${blockId}/click`;
}
