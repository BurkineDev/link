/**
 * Validation d'une destination de redirection interne.
 *
 * Un paramètre `?next=` traverse l'inscription pour ramener le visiteur là où
 * il allait — la page Tarifs quand il avait déjà choisi son plan. C'est aussi
 * la forme classique d'une redirection ouverte : une valeur non filtrée permet
 * d'envoyer quelqu'un depuis un lien bio-lien.com vers un site tiers, avec la
 * confiance que le domaine inspire. On n'accepte donc qu'un chemin interne.
 *
 * Sont refusés : les URL absolues, `//evil.com` (relatif au protocole), les
 * antislashs (que certains navigateurs normalisent en `/`), les caractères de
 * contrôle, et tout ce qui dépasse une longueur raisonnable.
 */

const MAX_LENGTH = 512;

/** Caractères de contrôle et espaces : jamais légitimes dans un chemin. */
const FORBIDDEN = /[\x00-\x20\x7f]/;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  if (FORBIDDEN.test(raw)) return null;
  return raw;
}
