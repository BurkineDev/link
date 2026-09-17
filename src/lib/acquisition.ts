/**
 * D'où vient une inscription — la partie pure, sans serveur.
 *
 * Avant de dépenser un franc en publicité, il faut pouvoir répondre à
 * « combien de vendeurs cette campagne a-t-elle amenés, et combien ont
 * payé ? ». Jusqu'ici rien ne le mesurait : ni UTM lu, ni source gardée.
 *
 * Le mécanisme, en trois temps, tous ici sauf l'écriture en base :
 * 1. le proxy lit les paramètres `utm_*` (et `ref`) de la première visite
 *    et les garde trente jours dans un cookie (premier contact : une visite
 *    ultérieure sans UTM ne l'écrase pas) ;
 * 2. à la création du compte, Better Auth relit ce cookie et l'écrit dans
 *    `user.acquisition` ;
 * 3. le rapport quotidien et l'analyste croissance regroupent inscriptions
 *    et abonnements par source.
 *
 * Le cookie ne contient que ce que l'annonceur a mis dans l'URL, borné et
 * sans rien de personnel.
 */

export const ACQUISITION_COOKIE = "biolien_acq";

/** Trente jours : la fenêtre d'attribution habituelle des régies. */
export const ACQUISITION_MAX_AGE = 30 * 24 * 60 * 60;

/** Aucune valeur n'est gardée au-delà : un UTM n'est pas un roman. */
const MAX_VALUE = 80;

export interface Acquisition {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Le chemin de la première page vue (sans la query). */
  landing?: string;
  /** Date ISO du premier contact. */
  at: string;
}

const clean = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_VALUE) : undefined;
};

/**
 * Lit une URL de visite. Sans `utm_source` ni `ref`, il n'y a rien à
 * retenir : la visite est organique ou déjà attribuée.
 */
export function acquisitionFromUrl(url: URL, now: Date = new Date()): Acquisition | null {
  const params = url.searchParams;
  const source = clean(params.get("utm_source")) ?? clean(params.get("ref"));
  if (!source) return null;
  return {
    source,
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    term: clean(params.get("utm_term")),
    landing: url.pathname.slice(0, 120),
    at: now.toISOString(),
  };
}

/**
 * Selon qui a posé et qui relit le cookie, la valeur arrive encodée une fois
 * (notre `encodeAcquisition`) ou deux (l'API cookies de Next encode encore
 * par-dessus, et tous les lecteurs ne décodent pas). On décode jusqu'à
 * tomber sur du JSON, deux fois au plus.
 */
function parseCookieJson(value: string): unknown {
  let current = value;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return JSON.parse(current);
    } catch {
      const decoded = decodeURIComponent(current);
      if (decoded === current) throw new Error("cookie illisible");
      current = decoded;
    }
  }
  throw new Error("cookie illisible");
}

/** JSON encodé pour un cookie : pas de guillemets, pas de point-virgule. */
export function encodeAcquisition(acquisition: Acquisition): string {
  return encodeURIComponent(JSON.stringify(acquisition));
}

/**
 * Relit le cookie. Il vient du navigateur, donc de n'importe qui : chaque
 * champ est revalidé et reborné, et un cookie tordu vaut « rien ».
 */
export function decodeAcquisition(value: string | null | undefined): Acquisition | null {
  if (!value) return null;
  try {
    const parsed = parseCookieJson(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const raw = parsed as Record<string, unknown>;
    const source = clean(typeof raw.source === "string" ? raw.source : null);
    if (!source) return null;
    const at = typeof raw.at === "string" && !Number.isNaN(Date.parse(raw.at)) ? raw.at : new Date().toISOString();
    const field = (key: string) => clean(typeof raw[key] === "string" ? (raw[key] as string) : null);
    return {
      source,
      medium: field("medium"),
      campaign: field("campaign"),
      content: field("content"),
      term: field("term"),
      landing: field("landing"),
      at,
    };
  } catch {
    return null;
  }
}
