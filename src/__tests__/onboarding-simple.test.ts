/**
 * L'assistant à trois questions déduit tout le reste : adresse, identifiant
 * de profil, devise, adresse du produit, textes de partage.
 */

import {
  currencyForWhatsAppNumber,
  productSlugFor,
  shareTexts,
  shopSlugFromName,
  usernameForShop,
} from "@/lib/onboarding/simple";
import { usernameSchema } from "@/lib/validations/auth";

describe("shopSlugFromName", () => {
  test("le nom devient l'adresse : accents, espaces et ponctuation retirés", () => {
    expect(shopSlugFromName("Awa Couture")).toBe("awa-couture");
    expect(shopSlugFromName("Chez Aïcha — Pagnes & Bazin")).toBe("chez-aicha-pagnes-bazin");
    expect(shopSlugFromName("  Wend'Tech  ")).toBe("wendtech");
  });

  test("bornée à 50 caractères, sans tiret final", () => {
    expect(shopSlugFromName("a".repeat(80)).length).toBe(50);
    expect(shopSlugFromName("Boutique -")).toBe("boutique");
    expect(shopSlugFromName("")).toBe("");
  });
});

describe("usernameForShop", () => {
  test("l'adresse sert d'identifiant de profil, dans les bornes du schéma", () => {
    for (const slug of ["awa-couture", "chez-aicha-pagnes-bazin", "a".repeat(50)]) {
      const username = usernameForShop(slug);
      expect(usernameSchema.safeParse(username).success).toBe(true);
    }
    expect(usernameForShop("awa-couture")).toBe("awa-couture");
    expect(usernameForShop("a".repeat(50))).toHaveLength(30);
  });

  test("une adresse trop courte est complétée plutôt que refusée", () => {
    expect(usernameForShop("ab")).toBe("ab-shop");
    expect(usernameSchema.safeParse(usernameForShop("ab")).success).toBe(true);
  });
});

describe("currencyForWhatsAppNumber", () => {
  test("le pays du numéro décide de la devise ; FCFA par défaut", () => {
    expect(currencyForWhatsAppNumber("22670123456")).toBe("XOF"); // Burkina
    expect(currencyForWhatsAppNumber("2250701234567")).toBe("XOF"); // Côte d'Ivoire
    expect(currencyForWhatsAppNumber("221771234567")).toBe("XOF"); // Sénégal
    expect(currencyForWhatsAppNumber("237670123456")).toBe("XAF"); // Cameroun
    expect(currencyForWhatsAppNumber("233241234567")).toBe("GHS"); // Ghana
    expect(currencyForWhatsAppNumber("2348012345678")).toBe("NGN"); // Nigeria
    expect(currencyForWhatsAppNumber("14165551234")).toBe("USD"); // Canada
    expect(currencyForWhatsAppNumber("")).toBe("XOF");
    expect(currencyForWhatsAppNumber(null)).toBe("XOF");
  });
});

describe("productSlugFor", () => {
  test("dérivée du nom, jamais plus courte que deux caractères", () => {
    expect(productSlugFor("Robe en pagne, coupe droite")).toBe("robe-en-pagne-coupe-droite");
    expect(productSlugFor("X")).toBe("produit-x");
    expect(productSlugFor("a".repeat(200))).toHaveLength(120);
  });
});

describe("shareTexts", () => {
  test("un message WhatsApp prêt à envoyer, avec le nom de la boutique", () => {
    const { whatsapp, message } = shareTexts("https://www.bio-lien.com/awa-couture", "Awa Couture");
    expect(message).toBe("Bonjour ! Voici la page de Awa Couture : https://www.bio-lien.com/awa-couture — tu choisis, tu m'écris, je te réponds.");
    expect(whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(shareTexts("https://www.bio-lien.com/x", "  ").message).toBe("Voici ma page : https://www.bio-lien.com/x");
  });
});
