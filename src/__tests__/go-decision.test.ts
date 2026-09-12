/**
 * Route serveur /go : la décision app/web prise avant hydratation
 * (src/lib/links/go.ts).
 */

import {
  decideGo,
  isCrawler,
  isIos,
  isRemoteRenderedBrowser,
  normalizeTargetUrl,
  renderIosBridge,
  toScriptLiteral,
} from "@/lib/links/go";
import { ANDROID_GO_SCRIPT } from "@/components/shop/android-go-script";
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

  test("iOS + Facebook : page-pont qui tente le schéma puis le web, avec retour boutique", () => {
    expect(decideGo("https://www.facebook.com/wax.and.co", IOS, "/wax")).toEqual({
      kind: "ios-bridge",
      nativeUrl: "fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax.and.co",
      webUrl: "https://www.facebook.com/wax.and.co",
      appName: "Facebook",
      shopUrl: "/wax",
    });
  });

  test("Opera Mini (rendu distant) : toujours le web, même avec « Android » dans l'UA", () => {
    const mini = "Opera/9.80 (Android; Opera Mini/15.0.2125/37.8025; U; en) Presto/2.12.423 Version/12.16";
    expect(decideGo("https://wa.me/22670000000", mini)).toEqual({ kind: "redirect", location: "https://wa.me/22670000000" });
    expect(decideGo("https://www.tiktok.com/@amy.creator", mini)).toMatchObject({ location: "https://www.tiktok.com/@amy.creator" });
    expect(isRemoteRenderedBrowser(mini)).toBe(true);
    expect(isRemoteRenderedBrowser(ANDROID)).toBe(false);
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
    expect(isCrawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
    expect(isCrawler(ANDROID)).toBe(false);
    // Les téléphones Cubot, courants en Afrique de l'Ouest, ne sont pas des robots.
    expect(isCrawler("Mozilla/5.0 (Linux; Android 11; CUBOT KING KONG 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false);
    expect(isCrawler("Mozilla/5.0 (Linux; Android 10; CUBOT_X30) Chrome/120 Mobile")).toBe(false);
  });

  test("isIos reconnaît iPhone et iPad, pas Android ni Mac", () => {
    expect(isIos(IOS)).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos(ANDROID)).toBe(false);
    expect(isIos(DESKTOP)).toBe(false);
  });
});

describe("normalizeTargetUrl", () => {
  test("encode l'unicode et retire les retours à la ligne, pour tenir dans un en-tête", () => {
    expect(normalizeTargetUrl("https://wa.me/22670000000?text=Salut 👋")).toBe(
      "https://wa.me/22670000000?text=Salut%20%F0%9F%91%8B",
    );
    expect(normalizeTargetUrl("https://www.tiktok.com/@名前")).toBe("https://www.tiktok.com/@%E5%90%8D%E5%89%8D");
    expect(normalizeTargetUrl("https://ex.com/a\nb")).toBe("https://ex.com/ab");
    expect(normalizeTargetUrl("  https://ex.com/x  ")).toBe("https://ex.com/x");
  });

  test("refuse javascript:, data: et les chaînes illisibles", () => {
    expect(normalizeTargetUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeTargetUrl("data:text/html,hi")).toBeNull();
    expect(normalizeTargetUrl("pas une url")).toBeNull();
    expect(normalizeTargetUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
  });
});

describe("renderIosBridge", () => {
  const decision = {
    kind: "ios-bridge" as const,
    nativeUrl: "fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax",
    webUrl: 'https://www.facebook.com/wax?x="<script>',
    appName: "Face<book>",
    shopUrl: "/wax",
  };

  test("page autonome : schéma, repli web, retour boutique, noscript, nonce", () => {
    const html = renderIosBridge(decision, "abc123");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<script nonce="abc123">');
    expect(html).toContain('"fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fwax"');
    expect(html).toContain("location.assign(n)");
    expect(html).toContain("1100");
    expect(html).toContain("history.back()");
    expect(html).toContain('href="/wax">Retour à la boutique</a>');
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=https://www.facebook.com/wax?x=&quot;&lt;script&gt;">');
    expect(html).toContain("Ouvrir Face&lt;book&gt; sur le web");
    expect(html.length).toBeLessThan(2_500);
  });

  test("une URL de vendeur contenant </script> ne ferme pas le script inline", () => {
    const html = renderIosBridge(
      { ...decision, webUrl: "https://instagram.com/monshop?x=</script><script>alert(document.domain)</script>" },
      "n0nce",
    );
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toContain("<script>alert");
  });

  test("toScriptLiteral échappe < > et les séparateurs de ligne Unicode", () => {
    expect(toScriptLiteral("<a>\u2028b\u2029")).toBe('"\\u003ca\\u003e\\u2028b\\u2029"');
  });
});

describe("AndroidGoScript", () => {
  test("constante sans donnée injectée : Android seulement, jamais Opera Mini, s'efface après hydratation", () => {
    expect(ANDROID_GO_SCRIPT).toContain("/Android/i.test(u)");
    expect(ANDROID_GO_SCRIPT).toContain("/Opera Mini/i.test(u)");
    expect(ANDROID_GO_SCRIPT).toContain('hasAttribute("data-hydrated")');
    expect(ANDROID_GO_SCRIPT).toContain('closest("a[data-go]")');
    expect(ANDROID_GO_SCRIPT).not.toContain("${");
    expect(ANDROID_GO_SCRIPT).not.toContain("</script");
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
