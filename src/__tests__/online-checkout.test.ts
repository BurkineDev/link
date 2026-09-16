/**
 * Le drapeau du mode « En ligne » : éteint par défaut (décision du
 * 14 septembre 2026), rallumé par NEXT_PUBLIC_ONLINE_CHECKOUT=1, lu à chaque
 * appel (jamais figé à l'import).
 */

import { effectiveCheckoutMode, isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";

const ORIGINAL = process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  else process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = ORIGINAL;
});

describe("isOnlineCheckoutEnabled", () => {
  test("absent ou vide : masqué", () => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect(isOnlineCheckoutEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "";
    expect(isOnlineCheckoutEnabled()).toBe(false);
  });

  test("seule la valeur « 1 » rallume la caisse", () => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect(isOnlineCheckoutEnabled()).toBe(true);
    for (const value of ["true", "yes", "on", "0", " 1"]) {
      process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = value;
      expect(isOnlineCheckoutEnabled()).toBe(false);
    }
  });

  test("lu à chaque appel, pas à l'import", () => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect(isOnlineCheckoutEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect(isOnlineCheckoutEnabled()).toBe(true);
  });
});

describe("effectiveCheckoutMode", () => {
  test("drapeau éteint : toute boutique est en WhatsApp, même « online » en base", () => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect(effectiveCheckoutMode("online")).toBe("whatsapp");
    expect(effectiveCheckoutMode("whatsapp")).toBe("whatsapp");
    expect(effectiveCheckoutMode(null)).toBe("whatsapp");
    expect(effectiveCheckoutMode(undefined)).toBe("whatsapp");
  });

  test("drapeau allumé : la valeur en base fait foi, valeur inconnue = WhatsApp", () => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect(effectiveCheckoutMode("online")).toBe("online");
    expect(effectiveCheckoutMode("whatsapp")).toBe("whatsapp");
    expect(effectiveCheckoutMode("foo")).toBe("whatsapp");
    expect(effectiveCheckoutMode(null)).toBe("whatsapp");
  });
});
