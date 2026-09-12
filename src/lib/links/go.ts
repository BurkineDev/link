/**
 * Route serveur `/go/<id>` : la décision « app ou web » prise avant toute
 * hydratation.
 *
 * Sur un téléphone d'entrée de gamme en 3G, le tap arrive souvent avant que
 * le JavaScript de la BioPage ne soit chargé : l'ancre navigue alors vers
 * l'URL web et l'app n'est jamais tentée. En faisant passer l'ancre par
 * `/go/<id>`, c'est le serveur qui lit le User-Agent et répond :
 *
 *   - Android, app connue : redirection 302 vers le lien intent:// (schéma
 *     natif ou App Link HTTPS forcé par paquet) — le geste utilisateur est
 *     conservé à travers la redirection, Chrome et les WebView ouvrent l'app
 *     ou retombent sur l'URL de repli ;
 *   - iOS, schéma natif connu : une page HTML d'un kilo-octet qui tente le
 *     schéma et ouvre le web si la page est toujours visible après 1,1 s ;
 *   - tout le reste (ordinateur, robot, app sans schéma sur iOS) :
 *     redirection 302 vers l'URL web.
 *
 * Le clic est compté ici, côté serveur : un visiteur sans JavaScript compte
 * enfin. Quand le JavaScript est là et que le tap est intercepté côté client,
 * l'ancre n'est pas suivie et c'est le client qui compte, comme avant.
 */

import { getAppLinkDestination, isAndroid, toAndroidIntentUrl, type AppLinkDestination } from "./app-link";

export type GoDecision =
  | { kind: "redirect"; location: string }
  | { kind: "ios-bridge"; nativeUrl: string; webUrl: string; appName: string | null };

export function isIos(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Robots et générateurs d'aperçus (Google, WhatsApp, Facebook, Telegram…) :
 * ils ne savent pas ouvrir une app, ils veulent la page web.
 */
export function isCrawler(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|Discordbot|preview/i.test(
    userAgent,
  );
}

/** Décide, sans réseau ni DOM, ce que le serveur doit répondre. */
export function decideGo(rawUrl: string, userAgent: string): GoDecision {
  const destination: AppLinkDestination = getAppLinkDestination(rawUrl);
  const webUrl = destination.webUrl;

  if (isCrawler(userAgent)) return { kind: "redirect", location: webUrl };

  if (isAndroid(userAgent)) {
    const intentUrl = toAndroidIntentUrl(
      destination.nativeUrl ?? webUrl,
      webUrl,
      destination.androidPackage,
    );
    return { kind: "redirect", location: intentUrl ?? webUrl };
  }

  if (isIos(userAgent) && destination.nativeUrl) {
    return {
      kind: "ios-bridge",
      nativeUrl: destination.nativeUrl,
      webUrl,
      appName: destination.appName,
    };
  }

  return { kind: "redirect", location: webUrl };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

/**
 * Page-pont iOS : aucun framework, aucune requête supplémentaire. Le script
 * reproduit `openNativeApp` : schéma d'abord, web si la page reste visible.
 */
export function renderIosBridge(decision: Extract<GoDecision, { kind: "ios-bridge" }>): string {
  const native = JSON.stringify(decision.nativeUrl);
  const web = JSON.stringify(decision.webUrl);
  const label = decision.appName ? `Ouvrir dans ${decision.appName}` : "Continuer";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ouverture…</title><noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(decision.webUrl)}"></noscript><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,system-ui,sans-serif;background:#f6f5fb;color:#111}a{display:inline-block;padding:14px 22px;border-radius:999px;background:#c6ff00;color:#111;font-weight:700;text-decoration:none;border:2px solid #111}</style></head><body><a href="${escapeHtml(decision.webUrl)}" id="w">${escapeHtml(label)}</a><script>(function(){var n=${native},w=${web},t=0;function c(){clearTimeout(t);document.removeEventListener("visibilitychange",v);window.removeEventListener("pagehide",c)}function v(){if(document.hidden)c()}document.addEventListener("visibilitychange",v);window.addEventListener("pagehide",c);t=setTimeout(function(){c();if(!document.hidden)location.replace(w)},1100);try{location.assign(n)}catch(e){c();location.replace(w)}})();</script></body></html>`;
}
