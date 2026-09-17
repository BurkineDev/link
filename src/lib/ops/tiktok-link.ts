/**
 * Sonde TikTok — le lien de bio s'ouvre-t-il directement ?
 *
 * TikTok fait passer chaque lien de bio par `www.tiktok.com/link/v2`. Pour
 * un domaine de sa liste (linktr.ee, wa.me… et même example.com), la
 * réponse est un 302 vers la cible : le site s'ouvre dans le navigateur
 * intégré. Pour tout le reste — bio-lien.com, mais aussi instagram.com ou
 * youtube.com (mesuré les 16-17 septembre 2026) — c'est un 200 : l'écran
 * « Tu quittes TikTok… », bouton « Ouvrir ». Rien côté site n'y change
 * (robots, en-têtes, redirections, réponse au robot ByteDance : tout
 * vérifié) — la liste est tenue par TikTok, sans procédure publique.
 *
 * Le 200 recouvre en fait trois gabarits, reconnus à la classe de leur
 * conteneur (`normal`, `suspicious`, `malicious`) :
 * - `normal` : l'écran ordinaire, franchissable par « Ouvrir » ;
 * - `suspicious` : « Alerte de sécurité : ce site peut être dangereux »,
 *   en rouge, franchissable par « Ouvrir quand même » ;
 * - `malicious` : « Pour protéger notre communauté, nous limitons certains
 *   contenus », sans bouton — le lien est bloqué.
 * Le code HTTP ne suffit donc pas : c'est le corps qui dit laquelle des
 * pages on a reçue, et un 200 qui n'est aucune des trois (défi anti-robot,
 * page de connexion) reste « unknown » plutôt qu'un faux statut.
 *
 * TikTok tient deux listes légèrement différentes selon le client (`aid`) :
 * celle de l'app (1233) et celle du site tiktok.com (1988) — youtube.com
 * passe sur le web mais a l'écran dans l'app, bit.ly l'inverse. Le verdict
 * qui compte pour un vendeur est celui de l'app : c'est `status`. Celui du
 * web est gardé à côté (`webStatus`).
 *
 * La sonde rejoue la même requête que l'app, une fois par jour dans le
 * passage de 03:00, pour savoir objectivement le jour où le domaine change
 * de côté, sans re-tester sur un téléphone. Elle ne lève jamais : une sonde
 * qui échoue est un statut « unknown », pas une étape de cron en échec.
 */

import type { OpsEventInput } from "./alert";

export type TikTokLinkStatus = "direct" | "interstitial" | "suspicious" | "blocked" | "unknown";

const ALL_STATUSES: ReadonlyArray<string> = ["direct", "interstitial", "suspicious", "blocked", "unknown"];

/** Les statuts qui disent quelque chose de TikTok (« unknown » ne conclut rien). */
const KNOWN_STATUSES: ReadonlyArray<TikTokLinkStatus> = ["direct", "interstitial", "suspicious", "blocked"];

function isTikTokStatus(value: unknown): value is TikTokLinkStatus {
  return typeof value === "string" && ALL_STATUSES.includes(value);
}

export interface TikTokLinkProbe {
  /** Le verdict de l'app TikTok (`aid=1233`) : celui que voit un visiteur venu d'une vidéo. */
  status: TikTokLinkStatus;
  /** L'URL soumise à TikTok (la page d'accueil : TikTok juge le domaine, pas la page). */
  target: string;
  httpStatus: number | null;
  /** Sur une redirection, l'URL vers laquelle TikTok renvoie ; sinon null. */
  location: string | null;
  /** Réseau, délai dépassé ou 200 illisible : le message, jamais une exception. */
  error: string | null;
  /** Le verdict du site tiktok.com (`aid=1988`), pour information ; null sur les sondes antérieures. */
  webStatus: TikTokLinkStatus | null;
}

/** Les identifiants client (`aid`) que TikTok distingue. */
export const TIKTOK_AID = { app: "1233", web: "1988" } as const;

/** Le domaine que les vendeurs collent dans leur bio ; TikTok le juge en bloc. */
export const TIKTOK_PROBE_TARGET = "https://www.bio-lien.com/";

const TIKTOK_LINK_ENDPOINT = "https://www.tiktok.com/link/v2";

// Le même user-agent que l'app iOS : la réponse ne dépend pas de lui
// (vérifié avec curl nu), mais autant rejouer la requête telle quelle.
const TIKTOK_APP_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.0.0";

const PROBE_TIMEOUT_MS = 10_000;

// Les pages font 2 à 3 Ko ; on n'en garde jamais plus que ça.
const BODY_LIMIT = 64_000;

// Marqueurs relevés dans les pages réelles (16-17/09/2026). L'état est la
// classe du conteneur (`<div class="container normal tiktok">` côté app,
// `<body class="normal pc_body tiktok">` côté site) ; le bouton confirme
// l'écran franchissable : `continue-button` (app) ou `open-anyway-button`
// (site). La page de blocage n'a aucun bouton.
const TEMPLATE_STATE = /<(?:div|body)\b[^>]*\bclass="[^"]*\b(normal|suspicious|malicious)\b[^"]*"/i;
const CONTINUE_MARKERS = ['id="continue-button"', 'id="open-anyway-button"'];

/** Les alertes qui disent où en est le domaine : une seule reste ouverte à la fois. */
export const TIKTOK_STATUS_ALERT_KINDS = [
  "tiktok.link_direct",
  "tiktok.link_interstitial",
  "tiktok.link_suspicious",
  "tiktok.link_blocked",
] as const;

/** La sonde a reçu une page qu'elle ne sait pas lire : gabarit renommé ou défi anti-robot. */
export const TIKTOK_PROBE_UNREADABLE_KIND = "tiktok.probe_unreadable";

/** Toutes les familles d'alertes de la sonde. */
export const TIKTOK_ALERT_KINDS = [...TIKTOK_STATUS_ALERT_KINDS, TIKTOK_PROBE_UNREADABLE_KIND] as const;

/** L'URL que l'app TikTok ouvre quand on tape un lien de bio (`scene=bio_url`). */
export function tiktokLinkUrl(target: string, aid: string = TIKTOK_AID.app): string {
  const url = new URL(TIKTOK_LINK_ENDPOINT);
  url.searchParams.set("aid", aid);
  url.searchParams.set("lang", "fr");
  url.searchParams.set("scene", "bio_url");
  url.searchParams.set("target", target);
  return url.toString();
}

/**
 * Lit la décision de TikTok dans sa réponse.
 * - 3xx vers la cible (même hôte, `Location` relative résolue contre
 *   l'endpoint) : ouverture directe.
 * - 200 : l'état est dans la classe du gabarit — `malicious` = bloqué,
 *   `suspicious` = alerte de sécurité, `normal` avec son bouton = l'écran.
 * - Tout le reste (redirection ailleurs, 200 inconnu, 403, 5xx) : on ne sait pas.
 */
export function classifyTikTokLinkResponse(
  httpStatus: number,
  location: string | null,
  target: string,
  body: string | null = null,
): TikTokLinkStatus {
  if (httpStatus >= 300 && httpStatus < 400) {
    return sameHost(location, target) ? "direct" : "unknown";
  }
  if (httpStatus === 200) {
    if (!body) return "unknown";
    const state = TEMPLATE_STATE.exec(body)?.[1]?.toLowerCase();
    if (state === "malicious") return "blocked";
    if (state === "suspicious") return "suspicious";
    if (state === "normal" && CONTINUE_MARKERS.some((marker) => body.includes(marker))) return "interstitial";
    return "unknown";
  }
  return "unknown";
}

/**
 * Ce qu'on peut dire d'un 200 illisible, pour distinguer depuis l'e-mail
 * un gabarit renommé (état trouvé, bouton absent) d'un défi anti-robot
 * (titre « verify », « captcha », « challenge »).
 */
export function describeUnreadableBody(body: string): string {
  const state = TEMPLATE_STATE.exec(body)?.[1]?.toLowerCase() ?? "aucun";
  const title = /<title[^>]*>([^<]{0,80})/i.exec(body)?.[1]?.trim() ?? "";
  const challenge = /verify|captcha|challenge|robot/i.test(body) ? "oui" : "non";
  return `200 sans la page attendue — gabarit : ${state}, titre : « ${title} », ${body.length} caractères, défi anti-robot : ${challenge}`;
}

function sameHost(location: string | null, target: string): boolean {
  if (!location) return false;
  try {
    return new URL(location, TIKTOK_LINK_ENDPOINT).host === new URL(target).host;
  } catch {
    return false;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url, TIKTOK_LINK_ENDPOINT).host;
  } catch {
    return null;
  }
}

/** « fetch failed » ne dit rien : la cause (ENOTFOUND, ECONNRESET…) si Node la donne. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause && typeof error.cause === "object" ? (error.cause as { code?: unknown; message?: unknown }) : null;
  const detail = typeof cause?.code === "string" ? cause.code : typeof cause?.message === "string" ? cause.message : null;
  return detail ? `${error.message} — ${detail}` : error.message;
}

interface RawVerdict {
  status: TikTokLinkStatus;
  httpStatus: number | null;
  location: string | null;
  error: string | null;
}

async function fetchVerdict(fetchImpl: typeof fetch, target: string, aid: string): Promise<RawVerdict> {
  try {
    const response = await fetchImpl(tiktokLinkUrl(target, aid), {
      method: "GET",
      // Le 302 est la réponse qu'on veut lire, pas suivre.
      redirect: "manual",
      headers: { "user-agent": TIKTOK_APP_USER_AGENT, "accept-language": "fr" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    // Lire le corps (ou l'abandonner) rend la connexion tout de suite, au
    // lieu de la laisser pendre jusqu'au délai.
    let body: string | null = null;
    if (response.status === 200) body = (await response.text()).slice(0, BODY_LIMIT);
    else await response.body?.cancel();

    const status = classifyTikTokLinkResponse(response.status, location, target, body);
    return {
      status,
      httpStatus: response.status,
      location,
      error: status === "unknown" && response.status === 200 ? describeUnreadableBody(body ?? "") : null,
    };
  } catch (error) {
    return { status: "unknown", httpStatus: null, location: null, error: describeError(error) };
  }
}

export async function probeTikTokLink(
  options: { target?: string; fetchImpl?: typeof fetch } = {},
): Promise<TikTokLinkProbe> {
  const target = options.target ?? TIKTOK_PROBE_TARGET;
  const fetchImpl = options.fetchImpl ?? fetch;
  // Les deux clients en parallèle ; le verdict de l'app fait foi.
  const [app, web] = await Promise.all([
    fetchVerdict(fetchImpl, target, TIKTOK_AID.app),
    fetchVerdict(fetchImpl, target, TIKTOK_AID.web),
  ]);
  return { ...app, target, webStatus: web.status };
}

/**
 * La sonde telle que le passage précédent l'a laissée dans son battement
 * de cœur (`cron.run`, contexte `{ tiktok: {...} }`), ou null : passages
 * antérieurs à la sonde, contexte tronqué par `boundContext` en chaîne.
 */
export function readTikTokProbe(context: Record<string, unknown> | null | undefined): TikTokLinkProbe | null {
  const tiktok = context?.tiktok;
  if (!tiktok || typeof tiktok !== "object") return null;
  const probe = tiktok as Partial<TikTokLinkProbe>;
  if (!isTikTokStatus(probe.status)) return null;
  return {
    status: probe.status,
    target: typeof probe.target === "string" ? probe.target : TIKTOK_PROBE_TARGET,
    httpStatus: typeof probe.httpStatus === "number" ? probe.httpStatus : null,
    location: typeof probe.location === "string" ? probe.location : null,
    error: typeof probe.error === "string" ? probe.error : null,
    webStatus: isTikTokStatus(probe.webStatus) ? probe.webStatus : null,
  };
}

/** Le statut connu (pas « unknown ») que ce battement de cœur a laissé, sinon null. */
export function readTikTokStatus(context: Record<string, unknown> | null | undefined): TikTokLinkStatus | null {
  const status = readTikTokProbe(context)?.status ?? null;
  return status && KNOWN_STATUSES.includes(status) ? status : null;
}

/** Le dernier statut connu parmi les passages, du plus récent au plus ancien. */
export function previousKnownTikTokStatus(
  contexts: Array<Record<string, unknown> | null | undefined>,
): TikTokLinkStatus | null {
  for (const context of contexts) {
    const status = readTikTokStatus(context);
    if (status) return status;
  }
  return null;
}

/**
 * L'alerte à ouvrir quand le statut change — et seulement alors : une
 * ligne par bascule, pas une par jour. Sans passage connu, l'écran est
 * l'état de référence (mesuré le 16 septembre 2026) : le premier
 * « direct », « suspicious » ou « blocked » compte comme une bascule, le
 * premier « écran » non.
 *
 * Un 200 que la sonde ne sait pas lire n'est pas un incident réseau : c'est
 * un gabarit qui a changé ou un défi anti-robot, et sans alerte les autres
 * deviendraient muettes en silence. Il ouvre donc sa propre ligne, que le
 * premier statut connu referme (voir le cron).
 */
export function tiktokLinkChange(
  previous: TikTokLinkStatus | null,
  probe: TikTokLinkProbe,
): OpsEventInput | null {
  const context = {
    target: probe.target,
    httpStatus: probe.httpStatus,
    location: probe.location,
    webStatus: probe.webStatus,
    previous,
  };
  if (probe.status === "unknown") {
    if (probe.httpStatus !== 200) return null;
    return {
      kind: TIKTOK_PROBE_UNREADABLE_KIND,
      severity: "warning",
      title: "Sonde TikTok : la page reçue n'est pas lisible",
      detail:
        "TikTok a répondu 200 mais ni l'écran, ni l'alerte de sécurité, ni la page de blocage n'ont été reconnus : gabarit renommé ou défi anti-robot servi à Vercel. Tant que ça dure, la sonde ne verra aucune bascule. Rejouer la commande curl du README depuis un poste et comparer.",
      context: { ...context, error: probe.error },
      dedupeKey: TIKTOK_PROBE_UNREADABLE_KIND,
    };
  }
  if (probe.status === "blocked" && previous !== "blocked") {
    return {
      kind: "tiktok.link_blocked",
      severity: "critical",
      title: "TikTok bloque bio-lien.com : « nous limitons certains contenus »",
      detail:
        "La sonde quotidienne a reçu la page de blocage de www.tiktok.com/link/v2, sans aucun bouton : les liens de bio des vendeurs ne s'ouvrent plus depuis TikTok. Vérifie sur un téléphone, puis contacte le support TikTok for Business (domaine classé à tort) et préviens les vendeurs.",
      context,
      dedupeKey: "tiktok.link_blocked",
    };
  }
  if (probe.status === "suspicious" && previous !== "suspicious") {
    return {
      kind: "tiktok.link_suspicious",
      severity: "critical",
      title: "TikTok affiche « Alerte de sécurité : ce site peut être dangereux » devant bio-lien.com",
      detail:
        "La sonde quotidienne a reçu l'avertissement rouge de www.tiktok.com/link/v2 (franchissable par « Ouvrir quand même », mais chaque visiteur venu d'une vidéo le voit). C'est souvent l'étape avant le blocage. Vérifie sur un téléphone, contacte le support TikTok for Business et préviens les vendeurs.",
      context,
      dedupeKey: "tiktok.link_suspicious",
    };
  }
  if (probe.status === "direct" && previous !== "direct") {
    return {
      kind: "tiktok.link_direct",
      severity: "warning",
      title: "TikTok ouvre bio-lien.com directement, sans l'écran « Tu quittes TikTok »",
      detail:
        "La sonde quotidienne a reçu un 302 de www.tiktok.com/link/v2 vers bio-lien.com. Vérifie sur un téléphone, puis corrige les consignes données aux vendeurs et aux testeurs, qui parlent encore de l'écran.",
      context,
      dedupeKey: "tiktok.link_direct",
    };
  }
  if (probe.status === "interstitial" && (previous === "direct" || previous === "blocked" || previous === "suspicious")) {
    const back = previous !== "direct";
    return {
      kind: "tiktok.link_interstitial",
      severity: "warning",
      title: back
        ? previous === "blocked"
          ? "TikTok débloque bio-lien.com : l'écran ordinaire est de retour"
          : "TikTok retire l'alerte de sécurité : l'écran ordinaire est de retour devant bio-lien.com"
        : "TikTok remet l'écran « Tu quittes TikTok » devant bio-lien.com",
      detail: back
        ? "La sonde quotidienne reçoit de nouveau l'écran ordinaire (« Ouvrir ») : les liens s'ouvrent comme avant, en un clic de plus."
        : "La sonde quotidienne reçoit de nouveau l'écran (200) au lieu du 302. Rien n'a changé côté site ; TikTok a revu sa décision. Reprendre la consigne « appuie sur Ouvrir » auprès des vendeurs.",
      context,
      dedupeKey: "tiktok.link_interstitial",
    };
  }
  return null;
}

const WEB_LABEL: Record<TikTokLinkStatus, string> = {
  direct: "ouverture directe",
  interstitial: "l'écran",
  suspicious: "alerte de sécurité",
  blocked: "bloqué",
  unknown: "sonde impossible",
};

/**
 * La phrase du rapport quotidien et de l'écran Santé : le verdict de l'app,
 * puis celui du site tiktok.com seulement s'il diffère (les deux listes
 * ne sont pas tout à fait les mêmes).
 */
export function describeTikTokLinkProbe(probe: TikTokLinkProbe | null | undefined): string {
  if (!probe) return "Lien TikTok : sonde non exécutée.";
  const web =
    probe.webStatus && probe.webStatus !== probe.status ? ` Sur le site tiktok.com : ${WEB_LABEL[probe.webStatus]}.` : "";
  switch (probe.status) {
    case "direct":
      return `Lien TikTok : bio-lien.com s'ouvre directement dans l'app (302), sans l'écran « Tu quittes TikTok ».${web}`;
    case "interstitial":
      return `Lien TikTok : encore l'écran « Tu quittes TikTok » de l'app (le traitement par défaut : instagram.com et youtube.com l'ont aussi).${web}`;
    case "suspicious":
      return `Lien TikTok : ALERTE DE SÉCURITÉ — l'app TikTok affiche « ce site peut être dangereux » devant bio-lien.com (franchissable par « Ouvrir quand même »).${web}`;
    case "blocked":
      return `Lien TikTok : BLOQUÉ — l'app TikTok affiche « nous limitons certains contenus » devant bio-lien.com, sans bouton.${web}`;
    default: {
      if (probe.httpStatus !== null && probe.httpStatus >= 300 && probe.httpStatus < 400 && probe.location) {
        const host = hostOf(probe.location);
        return `Lien TikTok : sonde impossible (TikTok redirige vers ${host ?? "une autre adresse"} au lieu de bio-lien.com).${web}`;
      }
      return `Lien TikTok : sonde impossible (${probe.error ?? `HTTP ${probe.httpStatus ?? "?"}`}).${web}`;
    }
  }
}
