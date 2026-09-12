/**
 * Route serveur /go : la décision app/web prise avant hydratation
 * (src/lib/links/go.ts).
 */

import { decideGo, isCrawler, isIos, renderIosBridge } from "@/lib/links/go";
import { blockGoHref, LEGACY_LINK_PREFIX } from "@/lib/blocks/ids";

const ANDROID = "Mozilla/5.0 (Linux; Android 12; Infinix X6816) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120 Safari/537.36";

describe("decideGo", () => {
  test("Android + TikTok : 302 vers un intent HTTPS forcé par paquet, avec repli web", () => {
    expect(decideGo("https://www.tiktok.com/@amy.creator", ANDROID)).toEqual({
      kind: "redirect",
      location:
        "intent://www.tiktok.com/@amy.creator#Intent;scheme=https;package=com.zhiliaoapp.musically;S.browser_fallback_url=https%3A%2F%2Fwww.tiktok.com%2F%40amy.creator;end",
    });
  });

  test("Android + Instagram : intent sur le schéma natif", () => {
    const d = decideGo("https://instagram.com/amy.creator", ANDROID);
    expect(d.kind).toBe("redirect");
    expect((d as { location: string }).location).toMatch(
      /^intent:\/\/user\?username=amy\.creator#Intent;scheme=instagram;package=com\.instagram\.android;/,
    );
  });

  test("Android + site inconnu : simple redirection web", () => {
    expect(decideGo("https://example.com/promo", ANDROID)).toEqual({ kind: "redirect", location: "https://example.com/promo" });
  });

  test("iOS + Facebook : page-pont qui tente le schéma puis le web", () => {
    expect(decideGo("https://www.facebook.com/wax.and.co", IOS)).toEqual({
      kind: "ios-bridge",
      nativeUrl: "fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax.and.co",
      webUrl: "https://www.facebook.com/wax.and.co",
      appName: "Facebook",
    });
  });

  test("iOS + TikTok (pas de schéma par nom) : redirection web, l'Universal Link fait le reste", () => {
    expect(decideGo("https://www.tiktok.com/@amy.creator", IOS)).toEqual({
      kind: "redirect",
      location: "https://www.tiktok.com/@amy.creator",
    });
  });

  test("ordinateur ou robot : redirection web, jamais de schéma", () => {
    expect(decideGo("https://instagram.com/amy.creator", DESKTOP)).toEqual({
      kind: "redirect",
      location: "https://instagram.com/amy.creator",
    });
    expect(decideGo("https://instagram.com/amy.creator", "")).toMatchObject({ kind: "redirect" });
  });

  test("robots et aperçus (Googlebot Android, WhatsApp) : toujours le web", () => {
    const googlebot = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    expect(decideGo("https://www.tiktok.com/@amy.creator", googlebot)).toEqual({
      kind: "redirect",
      location: "https://www.tiktok.com/@amy.creator",
    });
    expect(decideGo("https://www.facebook.com/wax", "WhatsApp/2.23.20.0 A")).toMatchObject({ kind: "redirect" });
    expect(isCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isCrawler(ANDROID)).toBe(false);
  });

  test("isIos reconnaît iPhone et iPad, pas Android ni Mac", () => {
    expect(isIos(IOS)).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos(ANDROID)).toBe(false);
    expect(isIos(DESKTOP)).toBe(false);
  });
});

describe("renderIosBridge", () => {
  test("page autonome : schéma, repli web, noscript, sans injection", () => {
    const html = renderIosBridge({
      kind: "ios-bridge",
      nativeUrl: "fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax",
      webUrl: 'https://www.facebook.com/wax?x="<script>',
      appName: 'Face<book>',
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('"fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax"');
    expect(html).toContain("location.assign(n)");
    expect(html).toContain("1100");
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=https://www.facebook.com/wax?x=&quot;&lt;script&gt;">');
    expect(html).toContain("Ouvrir dans Face&lt;book&gt;");
    expect(html).not.toContain("<script>'");
    expect(html.length).toBeLessThan(2_000);
  });
});

describe("blockGoHref", () => {
  test("un bloc synthétisé renvoie à son lien d'origine, un bloc enregistré à lui-même", () => {
    expect(blockGoHref(`${LEGACY_LINK_PREFIX}11111111-1111-4111-8111-111111111111`)).toBe(
      "/go/11111111-1111-4111-8111-111111111111",
    );
    expect(blockGoHref("22222222-2222-4222-8222-222222222222")).toBe("/go/22222222-2222-4222-8222-222222222222");
  });
});
