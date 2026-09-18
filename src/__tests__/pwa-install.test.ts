/**
 * « Ajouter à l'écran d'accueil » : quoi montrer à qui — bouton, gestes
 * iPhone, « ouvre dans Chrome » depuis TikTok, rien si déjà installé — et
 * la carte qui ne revient pas avant un mois une fois fermée.
 */

import { detectPlatform, installAdvice, INSTALL_DISMISS_MS, isDismissed, isInAppBrowser } from "@/lib/pwa/install";

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 13; TECNO CH6n) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const TIKTOK_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.0.0";
const INSTAGRAM_ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 Instagram 330.0.0.0";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

describe("detectPlatform / isInAppBrowser", () => {
  test("reconnaît Android, iPhone, et les navigateurs intégrés", () => {
    expect(detectPlatform(ANDROID_CHROME)).toBe("android");
    expect(detectPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(detectPlatform(MAC_CHROME)).toBe("other");
    expect(isInAppBrowser(TIKTOK_IOS)).toBe(true);
    expect(isInAppBrowser(INSTAGRAM_ANDROID)).toBe(true);
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
  });
});

describe("installAdvice", () => {
  test("déjà installé : rien à dire", () => {
    expect(installAdvice({ userAgent: ANDROID_CHROME, standalone: true, promptAvailable: true })).toEqual({ kind: "installed" });
  });

  test("Android/Chrome : le bouton dès que le navigateur a proposé l'installation, rien avant", () => {
    expect(installAdvice({ userAgent: ANDROID_CHROME, standalone: false, promptAvailable: true })).toEqual({ kind: "prompt" });
    expect(installAdvice({ userAgent: ANDROID_CHROME, standalone: false, promptAvailable: false })).toEqual({ kind: "unsupported" });
  });

  test("iPhone/Safari : les deux gestes, Safari ne proposant jamais rien", () => {
    expect(installAdvice({ userAgent: IPHONE_SAFARI, standalone: false, promptAvailable: false })).toEqual({ kind: "ios-steps" });
  });

  test("depuis TikTok ou Instagram : d'abord ouvrir dans le vrai navigateur", () => {
    expect(installAdvice({ userAgent: TIKTOK_IOS, standalone: false, promptAvailable: false })).toEqual({ kind: "open-in-browser", platform: "ios" });
    expect(installAdvice({ userAgent: INSTAGRAM_ANDROID, standalone: false, promptAvailable: true })).toEqual({ kind: "open-in-browser", platform: "android" });
  });

  test("ordinateur sans proposition : rien plutôt qu'un bouton mort", () => {
    expect(installAdvice({ userAgent: MAC_CHROME, standalone: false, promptAvailable: false })).toEqual({ kind: "unsupported" });
  });
});

describe("isDismissed", () => {
  test("fermée il y a moins d'un mois : reste fermée ; au-delà, ou jamais fermée : revient", () => {
    const now = Date.parse("2026-09-18T12:00:00Z");
    expect(isDismissed(String(now - 1000), now)).toBe(true);
    expect(isDismissed(String(now - INSTALL_DISMISS_MS + 1), now)).toBe(true);
    expect(isDismissed(String(now - INSTALL_DISMISS_MS - 1), now)).toBe(false);
    expect(isDismissed(null, now)).toBe(false);
    expect(isDismissed("pas-un-nombre", now)).toBe(false);
    expect(isDismissed("0", now)).toBe(false);
  });
});
