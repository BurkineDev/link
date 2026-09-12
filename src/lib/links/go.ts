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
 * Qui passe par `/go` : l'ancre garde toujours la vraie URL (les Universal
 * Links iOS et les App Links Android ne se déclenchent que sur l'URL tapée,
 * jamais sur la cible d'une redirection). Un script inline de la BioPage,
 * exécuté bien avant React, envoie vers `/go/<id>` les taps Android tant que
 * la page n'est pas hydratée ; tout le reste tape l'URL directe. `/go` sert
 * aussi de lien court partageable.
 *
 * Le clic est compté ici pour ces navigations ; quand le tap est intercepté
 * côté client, l'ancre n'est pas suivie et c'est le client qui compte.
 * Robots, aperçus de lien et requêtes HEAD ne comptent pas.
 */

import { getAppLinkDestination, isAndroid, toAndroidIntentUrl, type AppLinkDestination } from "./app-link";

export type GoDecision =
  | { kind: "redirect"; location: string }
  | {
      kind: "ios-bridge";
      nativeUrl: string;
      webUrl: string;
      appName: string | null;
      /** Page de la boutique, pour y revenir une fois l'app ouverte. */
      shopUrl: string;
    };

export function isIos(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Robots et générateurs d'aperçus (Google, WhatsApp, Facebook, Telegram…) :
 * ils ne savent pas ouvrir une app, ils veulent la page web.
 */
export function isCrawler(userAgent: string): boolean {
  // « bot » suivi d'une version ou d'une parenthèse (Googlebot/2.1,
  // bingbot;…), pas les téléphones Cubot ni tout ce qui contient « bot »
  // par hasard.
  return /bot[/;)]|crawl|spider|slurp|facebookexternalhit|Facebot|WhatsApp\/|TelegramBot|Twitterbot|LinkedInBot|Discordbot|Slackbot|Applebot|PetalBot|LinkPreview|Iframely|Embedly/i.test(
    userAgent,
  );
}

/**
 * Navigateurs à rendu distant : Opera Mini en mode « économie extrême »
 * (moteur Presto côté serveur) annonce « Android » mais c'est le proxy
 * d'Opera qui suit la redirection, et il ne sait pas ouvrir un intent://.
 */
export function isRemoteRenderedBrowser(userAgent: string): boolean {
  return /Opera Mini/i.test(userAgent);
}

/**
 * URL telle qu'elle sera envoyée dans un en-tête : `new URL().href` encode
 * les caractères non ASCII (emoji d'un message WhatsApp, alphabet non
 * latin) et retire tabulations et retours à la ligne — sinon `Headers`
 * refuse la valeur et le visiteur voit une erreur 500. Null si illisible.
 */
export function normalizeTargetUrl(raw: string): string | null {
  try {
    const href = new URL(raw.trim()).href;
    return /^(https?:|mailto:|tel:)/i.test(href) ? href : null;
  } catch {
    return null;
  }
}

/** Décide, sans réseau ni DOM, ce que le serveur doit répondre. */
export function decideGo(rawUrl: string, userAgent: string, shopUrl = "/"): GoDecision {
  const destination: AppLinkDestination = getAppLinkDestination(rawUrl);
  const webUrl = destination.webUrl;

  if (isCrawler(userAgent) || isRemoteRenderedBrowser(userAgent)) {
    return { kind: "redirect", location: webUrl };
  }

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
      shopUrl,
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
 * Littéral JavaScript sûr dans un <script> inline : JSON.stringify n'échappe
 * ni « < » ni « > », et le tokenizer HTML fermerait le script au premier
 * « </script> » contenu dans l'URL enregistrée par un vendeur.
 */
export function toScriptLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Page-pont iOS : aucun framework, aucune requête supplémentaire. Le script
 * reproduit `openNativeApp` : schéma d'abord, web si la page reste visible.
 * Une fois l'app ouverte puis refermée, la page revient à la boutique au
 * lieu de laisser le visiteur sur un écran vide. `nonce` protège le script
 * par la Content-Security-Policy de la réponse.
 */
export function renderIosBridge(
  decision: Extract<GoDecision, { kind: "ios-bridge" }>,
  nonce: string,
): string {
  const native = toScriptLiteral(decision.nativeUrl);
  const web = toScriptLiteral(decision.webUrl);
  const shop = toScriptLiteral(decision.shopUrl);
  const app = decision.appName ?? "l'application";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ouverture de ${escapeHtml(app)}…</title><noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(decision.webUrl)}"></noscript><style nonce="${escapeHtml(nonce)}">body{margin:0;min-height:100vh;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;font-family:-apple-system,system-ui,sans-serif;background:#f6f5fb;color:#111;text-align:center;padding:24px}p{margin:0;color:#555}a{display:inline-block;padding:14px 22px;border-radius:999px;font-weight:700;text-decoration:none;border:2px solid #111;color:#111}.p{background:#c6ff00}.s{background:#fff}</style></head><body><p>Ouverture de ${escapeHtml(app)}…</p><a class="p" href="${escapeHtml(decision.shopUrl)}">Retour à la boutique</a><a class="s" href="${escapeHtml(decision.webUrl)}">Ouvrir ${escapeHtml(app)} sur le web</a><script nonce="${escapeHtml(nonce)}">(function(){var n=${native},w=${web},s=${shop},t=0,h=false;function c(){clearTimeout(t);window.removeEventListener("pagehide",c)}function v(){if(document.hidden){h=true;c()}else if(h){document.removeEventListener("visibilitychange",v);if(history.length>1)history.back();else location.replace(s)}}document.addEventListener("visibilitychange",v);window.addEventListener("pagehide",c);t=setTimeout(function(){c();if(!document.hidden)location.replace(w)},1100);try{location.assign(n)}catch(e){c();location.replace(w)}})();</script></body></html>`;
}
