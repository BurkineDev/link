/**
 * « Ajouter à l'écran d'accueil » — la partie pure, sans DOM.
 *
 * Il n'y a pas encore d'application Bio-Lien dans les magasins. Épingler
 * la page web sur l'écran d'accueil est le geste qui la remplace : un
 * vendeur retrouve son espace sans repasser par un lien, un client retrouve
 * la page d'une vendeuse comme une appli. Chaque système le propose à sa
 * manière ; ici on décide seulement quoi montrer à qui.
 */

export type InstallPlatform = "android" | "ios" | "other";

export interface InstallEnvironment {
  userAgent: string;
  /** `display-mode: standalone` ou `navigator.standalone` (iOS). */
  standalone: boolean;
  /** Le navigateur a émis `beforeinstallprompt` : Android/Chrome, Edge… */
  promptAvailable: boolean;
}

export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

/** Le navigateur intégré de TikTok/Instagram/Facebook ne sait pas installer : il faut d'abord ouvrir dans Chrome ou Safari. */
export function isInAppBrowser(userAgent: string): boolean {
  return /musical_ly|bytedance|tiktok|instagram|fban|fbav|fb_iab|snapchat|line\//i.test(userAgent);
}

export type InstallAdvice =
  | { kind: "installed" }
  | { kind: "prompt" }
  | { kind: "ios-steps" }
  | { kind: "open-in-browser"; platform: InstallPlatform }
  | { kind: "unsupported" };

/**
 * Quoi montrer :
 * - déjà installé → rien ;
 * - un vrai bouton quand le navigateur a proposé l'installation ;
 * - sur iOS, les deux gestes (Partager → Sur l'écran d'accueil), Safari ne
 *   proposant jamais rien de lui-même ;
 * - depuis TikTok/Instagram, d'abord « ouvrir dans le navigateur » ;
 * - ailleurs, rien plutôt qu'un bouton qui ne fait rien.
 */
export function installAdvice(env: InstallEnvironment): InstallAdvice {
  if (env.standalone) return { kind: "installed" };
  const platform = detectPlatform(env.userAgent);
  if (isInAppBrowser(env.userAgent)) return { kind: "open-in-browser", platform };
  if (env.promptAvailable) return { kind: "prompt" };
  if (platform === "ios") return { kind: "ios-steps" };
  return { kind: "unsupported" };
}

/** Clé de rangement : la carte se ferme d'un geste et ne revient pas avant trente jours. */
export const INSTALL_DISMISSED_KEY = "biolien:install-dismissed-at";
export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function isDismissed(storedAt: string | null | undefined, now: number): boolean {
  const at = Number(storedAt);
  return Number.isFinite(at) && at > 0 && now - at < INSTALL_DISMISS_MS;
}
