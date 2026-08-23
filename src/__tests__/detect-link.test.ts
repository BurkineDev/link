/**
 * Reconnaissance de plateforme au collage d'une adresse.
 *
 * Le geste le plus répété de l'onboarding. Ces tests fixent ce que le vendeur
 * a le droit de coller — c'est-à-dire à peu près n'importe quoi.
 */

import { detectLink } from "@/lib/links/detect";

describe("detectLink", () => {
  test("reconnaît les grandes plateformes", () => {
    const cases: [string, string, string][] = [
      ["https://instagram.com/my_amy", "instagram", "Instagram"],
      ["https://www.tiktok.com/@my_amy", "tiktok", "TikTok"],
      ["https://facebook.com/maboutique", "facebook", "Facebook"],
      ["https://youtube.com/@machaine", "youtube", "YouTube"],
      ["https://wa.me/22665170778", "whatsapp", "WhatsApp"],
      ["https://t.me/moncanal", "telegram", "Telegram"],
    ];
    for (const [url, icon, label] of cases) {
      const d = detectLink(url);
      expect([url, d.icon, d.label]).toEqual([url, icon, label]);
      expect(d.recognized).toBe(true);
    }
  });

  test("accepte une adresse sans schéma — ce que les gens collent vraiment", () => {
    const d = detectLink("instagram.com/my_amy");
    expect(d.url).toBe("https://instagram.com/my_amy");
    expect(d.icon).toBe("instagram");
  });

  test("ignore www. et m.", () => {
    expect(detectLink("https://m.facebook.com/x").icon).toBe("facebook");
    expect(detectLink("https://www.instagram.com/x").icon).toBe("instagram");
  });

  test("reconnaît les liens de partage courts", () => {
    expect(detectLink("https://youtu.be/dQw4w9WgXcQ").label).toBe("YouTube");
    expect(detectLink("https://vm.tiktok.com/ZMabc123/").label).toBe("TikTok");
  });

  test("mailto: et tel:", () => {
    expect(detectLink("mailto:vendeur@example.com").icon).toBe("email");
    expect(detectLink("tel:+22665170778").icon).toBe("phone");
  });

  test("un domaine inconnu prend son nom de domaine pour libellé", () => {
    const d = detectLink("https://www.maboutique.ci/collection");
    expect(d.icon).toBe("website");
    expect(d.label).toBe("maboutique.ci");
    expect(d.recognized).toBe(false);
  });

  test("un domaine qui imite une plateforme n'est pas reconnu", () => {
    // Le piège classique d'une comparaison en sous-chaîne.
    const d = detectLink("https://instagram.com.phishing.example/x");
    expect(d.icon).toBe("website");
    expect(d.recognized).toBe(false);
  });

  test("un sous-domaine légitime reste reconnu", () => {
    expect(detectLink("https://business.facebook.com/x").icon).toBe("facebook");
  });

  test("javascript: n'est jamais reconnu ni réécrit", () => {
    const d = detectLink("javascript:alert(1)");
    expect(d.recognized).toBe(false);
    expect(d.icon).toBe("custom");
    // Rendu inchangé : la validation du bloc doit pouvoir le refuser.
    expect(d.url).toBe("javascript:alert(1)");
  });

  test("extrait le pseudo quand il y en a un", () => {
    expect(detectLink("https://www.tiktok.com/@my_amy").handle).toBe("@my_amy");
    expect(detectLink("https://instagram.com/my_amy").handle).toBe("@my_amy");
  });

  test("ne prend pas un segment technique pour un pseudo", () => {
    expect(detectLink("https://instagram.com/p/Cabc123/").handle).toBeNull();
    expect(detectLink("https://youtube.com/watch?v=abc").handle).toBeNull();
  });

  test("une saisie vide ou absurde ne casse rien", () => {
    expect(detectLink("").url).toBe("");
    expect(detectLink("   ").recognized).toBe(false);
    expect(detectLink("pas une url du tout").recognized).toBe(false);
  });
});
