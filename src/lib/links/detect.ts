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
}

/**
 * Table des plateformes. Les domaines sont comparés sur l'hôte exact ou un
 * sous-domaine, jamais en sous-chaîne : `instagram.com.phishing.example`
 * ne doit pas passer pour Instagram.
 */
const PLATFORMS: {
  hosts: string[];
  icon: LinkIconValue;
  label: string;
  /** Faux quand l'adresse ne désigne pas un profil (lien de partage court). */
  hasHandle?: boolean;
}[] = [
  { hosts: ["instagram.com", "instagr.am"], icon: "instagram", label: "Instagram", hasHandle: true },
  { hosts: ["tiktok.com"], icon: "tiktok", label: "TikTok", hasHandle: true },
  { hosts: ["vm.tiktok.com", "vt.tiktok.com"], icon: "tiktok", label: "TikTok" },
  { hosts: ["facebook.com", "fb.com", "fb.me"], icon: "facebook", label: "Facebook", hasHandle: true },
  { hosts: ["youtube.com"], icon: "youtube", label: "YouTube", hasHandle: true },
  { hosts: ["youtu.be"], icon: "youtube", label: "YouTube" },
  { hosts: ["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "whatsapp.com"], icon: "whatsapp", label: "WhatsApp" },
  { hosts: ["t.me", "telegram.me", "telegram.org"], icon: "telegram", label: "Telegram", hasHandle: true },
  // Reconnues pour le libellé, sans icône dédiée dans notre vocabulaire.
  { hosts: ["x.com", "twitter.com"], icon: "website", label: "X", hasHandle: true },
  { hosts: ["linkedin.com"], icon: "website", label: "LinkedIn" },
  { hosts: ["snapchat.com"], icon: "website", label: "Snapchat", hasHandle: true },
  { hosts: ["open.spotify.com", "spotify.com"], icon: "website", label: "Spotify" },
  { hosts: ["pinterest.com", "pin.it"], icon: "website", label: "Pinterest", hasHandle: true },
  { hosts: ["threads.net", "threads.com"], icon: "website", label: "Threads", hasHandle: true },
];

/** `www.` et `m.` ne changent pas la plateforme. */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

/** Hôte exact, ou sous-domaine — jamais une simple inclusion de texte. */
function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
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
    return { url, icon: "email", label: "Email", handle: null, recognized: true };
  }
  if (/^tel:/i.test(url)) {
    return { url, icon: "phone", label: "Téléphone", handle: null, recognized: true };
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

  const host = normalizeHost(parsed.hostname);

  for (const platform of PLATFORMS) {
    if (!platform.hosts.some((d) => hostMatches(host, d))) continue;
    return {
      url,
      icon: platform.icon,
      label: platform.label,
      handle: platform.hasHandle ? extractHandle(parsed) : null,
      recognized: true,
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
