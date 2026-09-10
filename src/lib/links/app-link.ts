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
  };

  if (!detected.platformId || !/^https?:\/\//i.test(detected.url)) return fallback;

  try {
    const url = new URL(detected.url);
    return {
      ...fallback,
      nativeUrl: nativeUrlFor(detected.platformId, url),
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

/**
 * Tente l'app, puis ouvre le web si la page est toujours visible.
 *
 * Le changement de visibilité est le seul signal inter-navigateurs indiquant
 * que l'application a pris la main. Tous les listeners sont retirés afin de
 * ne rien laisser vivre si l'utilisateur revient plus tard sur la BioPage.
 */
export function openNativeApp(nativeUrl: string, fallbackUrl: string): void {
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
