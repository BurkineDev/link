/**
 * Reconnaissance d'une plateforme à partir d'une adresse collée.
 *
 * Dans son tutoriel Linktree, une créatrice résume le geste ainsi : « il
 * suffit de prendre le lien et de le mettre là où c'est indiqué, et ils vont
 * le trouver direct — t'as rien à faire ». C'est le geste le plus répété de
 * tout l'onboarding : cinq liens, cinq fois. Chez nous il fallait, pour
 * chacun, dérouler une liste d'icônes et taper un libellé.
 *
 * Cette fonction fait le travail : elle rend l'icône et le nom de la
 * plateforme, et l'adresse normalisée.
 */

import { LINK_ICON_VALUES, type LinkIconValue } from "./icons";
import { findLinkPlatform, normalizeLinkHost } from "./platforms";

export interface DetectedLink {
  /** Adresse utilisable telle quelle : schéma ajouté, espaces retirés. */
  url: string;
  /** Icône de notre vocabulaire — `custom` quand rien n'est reconnu. */
  icon: LinkIconValue;
  /** Nom de la plateforme, ou le domaine à défaut. */
  label: string;
  /** Identifiant extrait de l'adresse (`@moncompte`), quand il s'en dégage un. */
  handle: string | null;
  /** Vrai seulement si une plateforme connue a été reconnue. */
  recognized: boolean;
  /** Identifiant stable de la plateforme, utilisé pour l'ouverture native. */
  platformId: string | null;
}

/**
 * Ajoute le schéma manquant.
 *
 * Les gens collent `instagram.com/moi`, `@moi`, parfois une adresse complète.
 * Refuser la forme courte pour un slash manquant serait absurde. En revanche
 * on n'ajoute JAMAIS de schéma à ce qui en a déjà un : `javascript:alert(1)`
 * doit rester tel quel pour être rejeté ensuite par la validation du bloc.
 */
function withScheme(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `https://${value}`;
}

const FALLBACK: Omit<DetectedLink, "url"> = {
  icon: "custom",
  label: "",
  handle: null,
  recognized: false,
  platformId: null,
};

/**
 * Reconnaît la plateforme d'une adresse.
 *
 * Ne lève jamais : une saisie incompréhensible rend simplement un résultat
 * non reconnu, et l'appelant garde la main.
 */
export function detectLink(raw: string): DetectedLink {
  const url = withScheme(raw);
  if (!url) return { ...FALLBACK, url: "" };

  // mailto: et tel: se reconnaissent avant toute analyse d'hôte.
  if (/^mailto:/i.test(url)) {
    return { url, icon: "email", label: "Email", handle: null, recognized: true, platformId: "email" };
  }
  if (/^tel:/i.test(url)) {
    return { url, icon: "phone", label: "Téléphone", handle: null, recognized: true, platformId: "phone" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ...FALLBACK, url };
  }

  // Tout le reste n'est pas un lien sortant légitime — `javascript:`,
  // `data:`… On le rend inchangé et non reconnu ; la validation du bloc
  // s'occupe de le refuser.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ...FALLBACK, url };
  }

  const host = normalizeLinkHost(parsed.hostname);
  const platform = findLinkPlatform(parsed);

  if (platform) {
    return {
      url,
      icon: platform.icon,
      label: platform.label,
      handle: platform.hasHandle ? extractHandle(parsed) : null,
      recognized: true,
      platformId: platform.id,
    };
  }

  // Domaine inconnu : le nom de domaine fait un bien meilleur libellé que
  // « Lien », et c'est ce que le vendeur aurait tapé lui-même.
  return {
    url,
    icon: "website",
    label: host,
    handle: null,
    recognized: false,
    platformId: null,
  };
}

/** Premier segment de chemin, quand il ressemble à un identifiant. */
function extractHandle(parsed: URL): string | null {
  const segment = parsed.pathname.split("/").filter(Boolean)[0];
  if (!segment) return null;

  const cleaned = decodeURIComponent(segment).replace(/^@/, "");
  // Les segments techniques ne sont pas des pseudos.
  if (/^(p|reel|reels|shorts|watch|video|channel|c|in|company|pin|playlist|status|share)$/i.test(cleaned)) {
    return null;
  }
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(cleaned)) return null;
  return `@${cleaned}`;
}

export { LINK_ICON_VALUES };
