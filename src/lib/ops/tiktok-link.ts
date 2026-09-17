/**
 * Sonde TikTok — le lien de bio s'ouvre-t-il directement ?
 *
 * TikTok fait passer chaque lien de bio par `www.tiktok.com/link/v2`. Pour
 * un domaine qu'il connaît (linktr.ee, instagram.com, wa.me… et même
 * example.com), la réponse est un 302 vers la cible : le site s'ouvre dans
 * le navigateur intégré. Pour bio-lien.com (mesuré le 16 septembre 2026),
 * c'est un 200 : l'écran « Tu vas ouvrir un lien… Ouvrir quand même », puis
 * le navigateur externe. Rien côté site n'y change (robots, en-têtes,
 * redirections, réponse au robot ByteDance : tout vérifié) — la décision
 * est prise par domaine, chez TikTok, sans procédure publique.
 *
 * La sonde rejoue la même requête que l'app, une fois par jour dans le
 * passage de 03:00, pour savoir objectivement le jour où le domaine passe
 * — ou repasse — de l'autre côté, sans re-tester sur un téléphone. Elle ne
 * lève jamais : une sonde qui échoue est un statut « unknown », pas une
 * étape de cron en échec.
 */

import type { OpsEventInput } from "./alert";

export type TikTokLinkStatus = "direct" | "interstitial" | "unknown";

export interface TikTokLinkProbe {
  status: TikTokLinkStatus;
  /** L'URL soumise à TikTok (la page d'accueil : TikTok juge le domaine, pas la page). */
  target: string;
  httpStatus: number | null;
  /** Sur un 302, l'URL vers laquelle TikTok renvoie ; sinon null. */
  location: string | null;
  /** Réseau ou délai dépassé : le message, jamais une exception. */
  error: string | null;
}

/** Le domaine que les vendeurs collent dans leur bio ; TikTok le juge en bloc. */
export const TIKTOK_PROBE_TARGET = "https://www.bio-lien.com/";

const TIKTOK_LINK_ENDPOINT = "https://www.tiktok.com/link/v2";

// Le même user-agent que l'app iOS : la réponse ne dépend pas de lui
// (vérifié avec curl nu), mais autant rejouer la requête telle quelle.
const TIKTOK_APP_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.0.0";

const PROBE_TIMEOUT_MS = 10_000;

/** L'URL que l'app TikTok ouvre quand on tape un lien de bio (`scene=bio_url`). */
export function tiktokLinkUrl(target: string): string {
  const url = new URL(TIKTOK_LINK_ENDPOINT);
  url.searchParams.set("aid", "1988");
  url.searchParams.set("lang", "fr");
  url.searchParams.set("scene", "bio_url");
  url.searchParams.set("target", target);
  return url.toString();
}

/**
 * Lit la décision de TikTok dans sa réponse.
 * - 3xx vers la cible (même hôte) : ouverture directe.
 * - 200 : la page interstitielle.
 * - Tout le reste (403, 5xx, redirection ailleurs…) : on ne sait pas.
 */
export function classifyTikTokLinkResponse(
  httpStatus: number,
  location: string | null,
  target: string,
): TikTokLinkStatus {
  if (httpStatus >= 300 && httpStatus < 400) {
    return sameHost(location, target) ? "direct" : "unknown";
  }
  if (httpStatus === 200) return "interstitial";
  return "unknown";
}

function sameHost(location: string | null, target: string): boolean {
  if (!location) return false;
  try {
    return new URL(location).host === new URL(target).host;
  } catch {
    return false;
  }
}

export async function probeTikTokLink(
  options: { target?: string; fetchImpl?: typeof fetch } = {},
): Promise<TikTokLinkProbe> {
  const target = options.target ?? TIKTOK_PROBE_TARGET;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(tiktokLinkUrl(target), {
      method: "GET",
      // Le 302 est la réponse qu'on veut lire, pas suivre.
      redirect: "manual",
      headers: { "user-agent": TIKTOK_APP_USER_AGENT, "accept-language": "fr" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    return {
      status: classifyTikTokLinkResponse(response.status, location, target),
      target,
      httpStatus: response.status,
      location,
      error: null,
    };
  } catch (error) {
    return {
      status: "unknown",
      target,
      httpStatus: null,
      location: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Le statut que le passage précédent a laissé dans son battement de cœur
 * (`cron.run`, contexte `{ tiktok: { status } }`), ou null s'il n'y en a pas
 * de connu : passages antérieurs à la sonde, sonde en échec, contexte
 * tronqué par `boundContext`.
 */
export function readTikTokStatus(context: Record<string, unknown> | null | undefined): TikTokLinkStatus | null {
  const tiktok = context?.tiktok;
  if (!tiktok || typeof tiktok !== "object") return null;
  const status = (tiktok as { status?: unknown }).status;
  return status === "direct" || status === "interstitial" ? status : null;
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
 * ligne par bascule, pas une par jour. Une sonde en échec (« unknown »)
 * ne conclut rien. Le premier passage où TikTok ouvre directement compte
 * comme une bascule (avant, c'était l'écran : mesuré le 16 septembre 2026).
 */
export function tiktokLinkChange(
  previous: TikTokLinkStatus | null,
  probe: TikTokLinkProbe,
): OpsEventInput | null {
  const context = { target: probe.target, httpStatus: probe.httpStatus, location: probe.location, previous };
  if (probe.status === "direct" && previous !== "direct") {
    return {
      kind: "tiktok.link_direct",
      severity: "warning",
      title: "TikTok ouvre bio-lien.com directement, sans l'écran « Ouvrir quand même »",
      detail:
        "La sonde quotidienne a reçu un 302 de www.tiktok.com/link/v2 vers bio-lien.com. Vérifie sur un téléphone, puis mets à jour le protocole de lancement et la mission testeurs, qui parlent encore de l'écran.",
      context,
      dedupeKey: "tiktok.link_direct",
    };
  }
  if (probe.status === "interstitial" && previous === "direct") {
    return {
      kind: "tiktok.link_interstitial",
      severity: "warning",
      title: "TikTok remet l'écran « Ouvrir quand même » devant bio-lien.com",
      detail:
        "La sonde quotidienne reçoit de nouveau la page interstitielle (200) au lieu du 302. Rien n'a changé côté site ; TikTok a revu sa décision. Reprendre les consignes « appuie sur Ouvrir quand même » auprès des vendeurs.",
      context,
      dedupeKey: "tiktok.link_interstitial",
    };
  }
  return null;
}

/** La phrase du rapport quotidien et de l'écran Santé. */
export function describeTikTokLinkProbe(probe: TikTokLinkProbe | null | undefined): string {
  if (!probe) return "Lien TikTok : sonde non exécutée.";
  switch (probe.status) {
    case "direct":
      return "Lien TikTok : bio-lien.com s'ouvre directement dans TikTok (302), sans l'écran « Ouvrir quand même ».";
    case "interstitial":
      return "Lien TikTok : encore l'écran « Ouvrir quand même » (TikTok ne connaît pas bio-lien.com).";
    default:
      return `Lien TikTok : sonde impossible (${probe.error ?? `HTTP ${probe.httpStatus ?? "?"}`}).`;
  }
}
