/**
 * Nettoyage des propositions de bio renvoyées par le modèle.
 *
 * Le modèle reçoit la consigne « trois lignes, sans numérotation, sans
 * guillemets ». Il la suit presque toujours. « Presque » ne suffit pas quand
 * le résultat atterrit dans le champ que verront les visiteurs : une bio qui
 * commence par « 1. » est un défaut visible par tout le monde.
 *
 * On nettoie plutôt que de rejeter — une réponse par ailleurs utilisable ne
 * mérite pas de faire échouer la génération.
 */

/** Limite du champ `description` d'une boutique. */
const MAX_BIO_LENGTH = 500;

const LEADING_MARKER = /^\s*(?:[-*•—]|\d+\s*[.)])\s*/;
const WRAPPING_QUOTES = /^["«»“”']+|["«»“”']+$/g;

export function parseBioOptions(text: string, limit = 3): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(LEADING_MARKER, ""))
    .map((line) => line.replace(WRAPPING_QUOTES, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, MAX_BIO_LENGTH))
    .slice(0, limit);
}
