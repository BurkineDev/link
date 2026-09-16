/**
 * Le pays « bloqué » d'un vendeur, pour la page Tarifs et le boost : seul un
 * numéro international plausible fixe un pays ; un pays couvert ou un texte
 * libre ne bloquent jamais ; la diaspora est nommée, jamais en code brut.
 */
import { mobileMoneyBlockedCountryForShop } from "@/lib/payments/mobile-money-coverage";

describe("mobileMoneyBlockedCountryForShop", () => {
  test("numéro burkinabè : bloqué, nommé", () => {
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+22670123456", contactPhone: null })).toBe("Burkina Faso");
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "22670123456", contactPhone: null })).toBe("Burkina Faso");
  });

  test("pays couvert (Côte d'Ivoire, Sénégal) : jamais bloqué", () => {
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+2250701234567", contactPhone: null })).toBeNull();
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+221771234567", contactPhone: null })).toBeNull();
  });

  test("sans numéro plausible : on laisse passer (texte libre, vide, boutique absente)", () => {
    expect(mobileMoneyBlockedCountryForShop(null)).toBeNull();
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: null, contactPhone: null })).toBeNull();
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: null, contactPhone: "33 821 12 34" })).toBeNull();
  });

  test("le contact ne compte que si le WhatsApp manque, et seulement s'il est plausible", () => {
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+2250701234567", contactPhone: "+22670123456" })).toBeNull();
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: null, contactPhone: "+22670123456" })).toBe("Burkina Faso");
  });

  test("diaspora : nommée, et le +1 n'est pas tranché", () => {
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+33612345678", contactPhone: null })).toBe("France");
    expect(mobileMoneyBlockedCountryForShop({ whatsappNumber: "+15145551234", contactPhone: null })).toBe("Canada / États-Unis");
  });
});
