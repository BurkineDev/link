import { detectLink } from "./detect";

export interface AppLinkDestination {
  /** URL sûre utilisée sans JavaScript et comme repli si l'app est absente. */
  webUrl: string;
  /** Schéma natif à tenter depuis un navigateur mobile, quand il est fiable. */
  nativeUrl: string | null;
  /** Nom affichable de l'application reconnue. */
  appName: string | null;
  /** Les Universal Links / App Links doivent naviguer dans le même onglet. */
  opensInApp: boolean;
  /** Identifiant du paquet Android, pour un lien intent:// avec repli. */
  androidPackage: string | null;
}

const TECHNICAL_PROFILE_SEGMENTS = new Set([
  "about",
  "accounts",
  "channel",
  "company",
  "explore",
  "home",
  "in",
  "intent",
  "login",
  "p",
  "pin",
  "playlist",
  "reel",
  "reels",
  "share",
  "shorts",
  "status",
  "video",
  "watch",
]);

function firstSegment(url: URL): string | null {
  const value = url.pathname.split("/").filter(Boolean)[0];
  return value ? decodeURIComponent(value).replace(/^@/, "") : null;
}

function isProfileSegment(value: string | null): value is string {
  return !!value && !TECHNICAL_PROFILE_SEGMENTS.has(value.toLowerCase());
}

function whatsappUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "chat.whatsapp.com") {
    const code = firstSegment(url);
    return code ? `whatsapp://chat?code=${encodeURIComponent(code)}` : null;
  }

  const fromPath = host === "wa.me" ? firstSegment(url) : null;
  const phone = (fromPath ?? url.searchParams.get("phone") ?? "").replace(/\D/g, "");
  const text = url.searchParams.get("text");
  if (!phone && !text) return "whatsapp://send";

  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (text) params.set("text", text);
  return `whatsapp://send?${params.toString()}`;
}

function telegramUrl(url: URL): string | null {
  const segment = firstSegment(url);
  if (!segment) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (segment === "share" && parts[1] === "url") {
    const params = new URLSearchParams();
    const sharedUrl = url.searchParams.get("url");
    const text = url.searchParams.get("text");
    if (sharedUrl) params.set("url", sharedUrl);
    if (text) params.set("text", text);
    return `tg://msg_url?${params.toString()}`;
  }
  if (segment.startsWith("+")) {
    return `tg://join?invite=${encodeURIComponent(segment.slice(1))}`;
  }
  if (segment === "joinchat") {
    const invite = url.pathname.split("/").filter(Boolean)[1];
    return invite ? `tg://join?invite=${encodeURIComponent(invite)}` : null;
  }

  const params = new URLSearchParams({ domain: segment });
  const post = parts[1];
  if (post && /^\d+$/.test(post)) params.set("post", post);
  const start = url.searchParams.get("start");
  if (start) params.set("start", start);
  return `tg://resolve?${params.toString()}`;
}

function youtubeUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = host === "youtu.be" ? firstSegment(url) : url.searchParams.get("v");
  if (!videoId) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) videoId = parts[1];
  }
  return videoId ? `youtube://watch?v=${encodeURIComponent(videoId)}` : null;
}

function spotifyUrl(url: URL): string | null {
  const [kind, id] = url.pathname.split("/").filter(Boolean);
  const supported = new Set(["album", "artist", "episode", "playlist", "show", "track", "user"]);
  return kind && id && supported.has(kind) ? `spotify:${kind}:${id}` : null;
}

function xUrl(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const username = parts[0]?.replace(/^@/, "");
  if (!isProfileSegment(username)) return null;
  if (parts[1] === "status" && parts[2]) {
    return `twitter://status?id=${encodeURIComponent(parts[2])}`;
  }
  return `twitter://user?screen_name=${encodeURIComponent(username)}`;
}

/**
 * Paquets Android des apps que l'on sait ouvrir. Sans paquet, Chrome et les
 * WebView Android ne savent pas quoi ouvrir ni où retomber : un lien
 * intent:// « package=… ; S.browser_fallback_url=… ; end » ouvre l'app si
 * elle est là, sinon l'URL de repli, sans page d'erreur.
 *
 * Deux familles :
 *   - apps avec un schéma natif fiable (instagram://, whatsapp://…) : le
 *     lien intent:// reprend ce schéma ;
 *   - apps sans schéma exploitable depuis un nom d'utilisateur (TikTok ne
 *     connaît que des identifiants numériques, LinkedIn, Pinterest, Threads)
 *     ou dont le schéma iOS est incertain : le lien intent:// garde l'URL
 *     HTTPS et force le paquet — c'est l'App Link vérifié de l'app, qui
 *     marche aussi depuis le navigateur intégré de TikTok ou d'Instagram,
 *     là où un simple tap sur l'URL reste coincé dans la WebView.
 */
const ANDROID_PACKAGES: Record<string, string> = {
  instagram: "com.instagram.android",
  whatsapp: "com.whatsapp",
  telegram: "org.telegram.messenger",
  youtube: "com.google.android.youtube",
  spotify: "com.spotify.music",
  x: "com.twitter.android",
  snapchat: "com.snapchat.android",
  waze: "com.waze",
  tiktok: "com.zhiliaoapp.musically",
  facebook: "com.facebook.katana",
  messenger: "com.facebook.orca",
  linkedin: "com.linkedin.android",
  pinterest: "com.pinterest",
  threads: "com.instagram.barcelona",
};

function facebookUrl(url: URL): string | null {
  // Pas de schéma par nom d'utilisateur (fb://profile/ exige un identifiant
  // numérique) : l'app Facebook sait en revanche ouvrir n'importe quelle URL
  // facebook.com dans sa propre vue.
  const segment = firstSegment(url);
  if (!segment) return null;
  return `fb://facewebmodal/f?href=${encodeURIComponent(url.toString())}`;
}

function messengerUrl(url: URL): string | null {
  // m.me/<nom> ou messenger.com/t/<nom> → fil de discussion avec la page.
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const name = host === "m.me" ? parts[0] : parts[0] === "t" ? parts[1] : null;
  return isProfileSegment(name ?? null)
    ? `fb-messenger://user-thread/${encodeURIComponent(name!)}`
    : null;
}

/**
 * Schémas natifs documentés et stables pour les destinations les plus
 * fréquentes. Pour toutes les autres apps reconnues, le lien HTTPS reste la
 * meilleure adresse : iOS/Android l'ouvrent via leur association de domaine.
 */
function nativeUrlFor(platformId: string, url: URL): string | null {
  switch (platformId) {
    case "instagram": {
      const username = firstSegment(url);
      return isProfileSegment(username)
        ? `instagram://user?username=${encodeURIComponent(username)}`
        : null;
    }
    case "whatsapp":
      return whatsappUrl(url);
    case "telegram":
      return telegramUrl(url);
    case "youtube":
      return youtubeUrl(url);
    case "spotify":
      return spotifyUrl(url);
    case "x":
      return xUrl(url);
    case "snapchat": {
      const parts = url.pathname.split("/").filter(Boolean);
      const username = parts[0] === "add" ? parts[1] : null;
      return username ? `snapchat://add/${encodeURIComponent(username)}` : null;
    }
    case "waze":
      return url.pathname === "/ul" ? `waze://?${url.searchParams.toString()}` : null;
    case "facebook":
      return facebookUrl(url);
    case "messenger":
      return messengerUrl(url);
    // TikTok : snssdk1233://user/profile/<uid> n'accepte qu'un identifiant
    // numérique, jamais le @nom que colle le vendeur. Sur iOS, l'Universal
    // Link HTTPS fait le travail ; sur Android, l'intent:// avec paquet.
    default:
      return null;
  }
}

/** Résout une adresse une seule fois pour l'ancre et son gestionnaire de tap. */
export function getAppLinkDestination(raw: string): AppLinkDestination {
  const detected = detectLink(raw);
  const fallback: AppLinkDestination = {
    webUrl: detected.url || raw,
    nativeUrl: null,
    appName: detected.recognized ? detected.label : null,
    opensInApp: detected.recognized,
    androidPackage: null,
  };

  if (!detected.platformId || !/^https?:\/\//i.test(detected.url)) return fallback;

  try {
    const url = new URL(detected.url);
    return {
      ...fallback,
      nativeUrl: nativeUrlFor(detected.platformId, url),
      androidPackage: ANDROID_PACKAGES[detected.platformId] ?? null,
    };
  } catch {
    return fallback;
  }
}

export function isMobileBrowser(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    // Depuis iPadOS 13, Safari peut annoncer un Mac. Le tactile le distingue
    // d'un vrai ordinateur sans élargir le test à tous les Mac.
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * Convertit une adresse en lien intent:// Android.
 *
 * `instagram://user?username=x` devient
 * `intent://user?username=x#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=<web>;end`.
 * C'est le mécanisme documenté par Chrome : le système ouvre l'app si elle
 * est installée, sinon charge l'URL de repli. Un schéma brut, lui, remplace
 * la page par « ERR_UNKNOWN_URL_SCHEME » dans une WebView qui ne le relaie
 * pas — exactement le navigateur intégré de TikTok ou d'Instagram sur les
 * téléphones d'entrée de gamme — et la minuterie de repli meurt avec elle.
 *
 * Une URL HTTPS n'est convertie que si l'on connaît le paquet : l'intent
 * garde alors `scheme=https` et force l'app par son App Link vérifié
 * (`intent://www.tiktok.com/@x#Intent;scheme=https;package=com.zhiliaoapp.musically;…`).
 * Sans paquet, une URL web reste une URL web.
 */
export function toAndroidIntentUrl(
  targetUrl: string,
  fallbackUrl: string,
  androidPackage: string | null,
): string | null {
  const match = /^([a-z][a-z0-9+.-]*):(?:\/\/)?([^#]*)/i.exec(targetUrl);
  if (!match) return null;
  const [, scheme, rest] = match;
  if (!scheme) return null;
  const isWeb = scheme.toLowerCase() === "http" || scheme.toLowerCase() === "https";
  if (isWeb && !androidPackage) return null;
  const parts = [
    `scheme=${isWeb ? "https" : scheme}`,
    androidPackage ? `package=${androidPackage}` : null,
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`,
  ].filter(Boolean);
  return `intent://${rest}#Intent;${parts.join(";")};end`;
}

/**
 * Tente l'app, puis ouvre le web si la page est toujours visible.
 *
 * Sur Android, un lien intent:// porte lui-même son repli : on navigue et
 * le système décide — avec le schéma natif quand il existe, avec l'URL
 * HTTPS et le paquet sinon. Sur iOS, il n'existe pas d'équivalent : on
 * tente le schéma, et si la page est toujours visible après un court délai,
 * l'app n'est pas là et on ouvre le web. Le changement de visibilité est le seul
 * signal inter-navigateurs indiquant que l'application a pris la main. Tous
 * les listeners sont retirés afin de ne rien laisser vivre si l'utilisateur
 * revient plus tard sur la BioPage.
 */
export function openNativeApp(
  nativeUrl: string | null,
  fallbackUrl: string,
  options: { androidPackage?: string | null; userAgent?: string } = {},
): void {
  const ua = options.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");

  if (isAndroid(ua)) {
    // Sans schéma natif mais avec un paquet connu : intent HTTPS (App Link).
    const intentUrl = toAndroidIntentUrl(
      nativeUrl ?? fallbackUrl,
      fallbackUrl,
      options.androidPackage ?? null,
    );
    window.location.assign(intentUrl ?? fallbackUrl);
    return;
  }

  // iOS sans schéma natif : l'Universal Link HTTPS est la seule voie.
  if (!nativeUrl) {
    window.location.assign(fallbackUrl);
    return;
  }

  let timer = 0;

  const cleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", cleanup);
  };
  const onVisibilityChange = () => {
    if (document.hidden) cleanup();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", cleanup, { once: true });
  timer = window.setTimeout(() => {
    cleanup();
    if (!document.hidden) window.location.assign(fallbackUrl);
  }, 1100);

  try {
    window.location.assign(nativeUrl);
  } catch {
    cleanup();
    window.location.assign(fallbackUrl);
  }
}
