import {
  getAppLinkDestination,
  isMobileBrowser,
  toAndroidIntentUrl,
  isAndroid,
} from "@/lib/links/app-link";
import { APP_PLATFORMS, SUPPORTED_APP_COUNT } from "@/lib/links/platforms";

describe("registre des App Links", () => {
  it("couvre plus de 50 applications sans doublon d'identifiant", () => {
    expect(SUPPORTED_APP_COUNT).toBeGreaterThanOrEqual(50);
    expect(new Set(APP_PLATFORMS.map((platform) => platform.id)).size).toBe(
      APP_PLATFORMS.length,
    );
  });
});

describe("getAppLinkDestination", () => {
  it("construit le lien natif d'un profil Instagram", () => {
    expect(
      getAppLinkDestination("https://instagram.com/amy.creator"),
    ).toEqual({
      webUrl: "https://instagram.com/amy.creator",
      nativeUrl: "instagram://user?username=amy.creator",
      appName: "Instagram",
      opensInApp: true,
      androidPackage: "com.instagram.android",
    });
  });

  it("préserve le numéro et le message WhatsApp", () => {
    const destination = getAppLinkDestination(
      "https://wa.me/22670112233?text=Bonjour%20Amy",
    );
    expect(destination.nativeUrl).toBe(
      "whatsapp://send?phone=22670112233&text=Bonjour+Amy",
    );
  });

  it("pointe une vidéo YouTube et un morceau Spotify dans leurs apps", () => {
    expect(
      getAppLinkDestination("https://youtu.be/dQw4w9WgXcQ").nativeUrl,
    ).toBe("youtube://watch?v=dQw4w9WgXcQ");
    expect(
      getAppLinkDestination("https://open.spotify.com/track/abc123").nativeUrl,
    ).toBe("spotify:track:abc123");
  });

  it("conserve le contenu d'un partage Telegram", () => {
    expect(
      getAppLinkDestination(
        "https://t.me/share/url?url=https%3A%2F%2Fbio-lien.com%2Famy&text=Regarde",
      ).nativeUrl,
    ).toBe(
      "tg://msg_url?url=https%3A%2F%2Fbio-lien.com%2Famy&text=Regarde",
    );
  });

  it("laisse un intent de partage X à son App Link HTTPS", () => {
    const destination = getAppLinkDestination(
      "https://x.com/intent/post?text=Regarde",
    );
    expect(destination.nativeUrl).toBeNull();
    expect(destination.opensInApp).toBe(true);
  });

  it("utilise le lien HTTPS associé quand aucun schéma natif n'est nécessaire", () => {
    const destination = getAppLinkDestination(
      "https://www.linkedin.com/in/amy",
    );
    expect(destination).toMatchObject({
      nativeUrl: null,
      appName: "LinkedIn",
      opensInApp: true,
    });
  });

  it("ne traite pas un site inconnu comme une application", () => {
    expect(getAppLinkDestination("https://example.com/path")).toMatchObject({
      nativeUrl: null,
      appName: null,
      opensInApp: false,
    });
  });
});

describe("isMobileBrowser", () => {
  it("distingue les navigateurs mobiles des ordinateurs", () => {
    expect(
      isMobileBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
      ),
    ).toBe(true);
    expect(
      isMobileBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe(false);
    expect(
      isMobileBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18 Safari",
        5,
      ),
    ).toBe(true);
  });
});

describe("Android : lien intent:// avec repli", () => {
  it("convertit un schéma natif en intent:// avec paquet et URL de repli", () => {
    const url = toAndroidIntentUrl(
      "instagram://user?username=bio.lien",
      "https://www.instagram.com/bio.lien/",
      "com.instagram.android",
    );
    expect(url).toBe(
      "intent://user?username=bio.lien#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=https%3A%2F%2Fwww.instagram.com%2Fbio.lien%2F;end",
    );
  });

  it("gère un schéma sans « // » (spotify:) et un schéma sans paquet connu", () => {
    expect(toAndroidIntentUrl("spotify:track:abc", "https://open.spotify.com/track/abc", "com.spotify.music")).toBe(
      "intent://track:abc#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fabc;end",
    );
    expect(toAndroidIntentUrl("waze://?ll=1,2", "https://waze.com/ul?ll=1,2", null)).toBe(
      "intent://?ll=1,2#Intent;scheme=waze;S.browser_fallback_url=https%3A%2F%2Fwaze.com%2Ful%3Fll%3D1%2C2;end",
    );
  });

  it("refuse de transformer une URL http(s) : ce n'est pas un schéma d'app", () => {
    expect(toAndroidIntentUrl("https://example.com", "https://example.com", null)).toBeNull();
  });

  it("chaque app avec schéma natif connaît son paquet Android", () => {
    const samples: Record<string, string> = {
      instagram: "https://instagram.com/bio.lien",
      whatsapp: "https://wa.me/22670123456",
      telegram: "https://t.me/biolien",
      youtube: "https://youtu.be/dQw4w9WgXcQ",
      spotify: "https://open.spotify.com/track/abc",
      x: "https://x.com/biolien",
      snapchat: "https://snapchat.com/add/biolien",
      waze: "https://waze.com/ul?ll=1,2",
    };
    for (const [id, href] of Object.entries(samples)) {
      const d = getAppLinkDestination(href);
      expect(d.nativeUrl).not.toBeNull();
      expect(d.androidPackage).not.toBeNull();
      void id;
    }
    expect(isAndroid("Mozilla/5.0 (Linux; Android 13; TECNO) Chrome")).toBe(true);
    expect(isAndroid("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari")).toBe(false);
  });

  it("ne renseigne pas de paquet quand il n'y a pas de schéma natif", () => {
    expect(getAppLinkDestination("https://www.linkedin.com/in/biolien").androidPackage).toBeNull();
  });
});

