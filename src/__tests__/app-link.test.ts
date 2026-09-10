import {
  getAppLinkDestination,
  isMobileBrowser,
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
