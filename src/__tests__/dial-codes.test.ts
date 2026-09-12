/**
 * Numérotation : le module qui a manqué aux deux premiers bugs de production
 * (indicatif +225 collé à un numéro burkinabè ; numéro WhatsApp vendeur sans
 * indicatif accepté).
 */
import { AFRICAN_COUNTRIES } from "@/lib/constants";
import {
  DIAL_CODES,
  dialCodeFor,
  isValidE164,
  nsnHint,
  toE164,
} from "@/lib/phone/dial-codes";

describe("table des indicatifs", () => {
  test("couvre chaque pays proposé à la livraison", () => {
    const missing = AFRICAN_COUNTRIES.map((c) => c.code).filter((c) => !dialCodeFor(c));
    expect(missing).toEqual([]);
  });

  test("aucun doublon de pays", () => {
    const seen = new Set(DIAL_CODES.map((e) => e.iso2));
    expect(seen.size).toBe(DIAL_CODES.length);
  });

  test("les pays couverts par Genius Pay ont bien leur indicatif (le bug d'origine)", () => {
    expect(dialCodeFor("BJ")).toBe("+229");
    expect(dialCodeFor("TG")).toBe("+228");
    expect(dialCodeFor("GA")).toBe("+241");
    expect(dialCodeFor("CG")).toBe("+242");
    expect(dialCodeFor("RW")).toBe("+250");
    expect(dialCodeFor("UG")).toBe("+256");
    expect(dialCodeFor("ZM")).toBe("+260");
    expect(dialCodeFor("bf")).toBe("+226");
  });
});

describe("toE164", () => {
  test("numéro local avec espaces et pays : Burkina", () => {
    expect(toE164("70 12 34 56", "BF")).toBe("+22670123456");
  });

  test("zéro initial du plan national retiré : Côte d'Ivoire, Sénégal, Cameroun", () => {
    expect(toE164("07 08 09 10 11", "CI")).toBe("+2250708091011");
    expect(toE164("0708091011", "CI")).toBe("+2250708091011");
    expect(toE164("77 123 45 67", "SN")).toBe("+221771234567");
    expect(toE164("6 55 12 34 56", "CM")).toBe("+237655123456");
  });

  test("saisie déjà internationale : le pays choisi n'est pas appliqué par-dessus", () => {
    expect(toE164("+226 70 12 34 56", "CI")).toBe("+22670123456");
    expect(toE164("00229 01 97 12 34 56", "CI")).toBe("+2290197123456");
  });

  test("Bénin : 10 chiffres depuis 2024, 8 refusés", () => {
    expect(toE164("01 97 12 34 56", "BJ")).toBe("+2290197123456");
    expect(toE164("97 12 34 56", "BJ")).toBeNull();
  });

  test("mauvaise longueur pour le pays → refusé", () => {
    expect(toE164("70 12 34", "BF")).toBeNull(); // 6 chiffres
    expect(toE164("70 12 34 56 78", "BF")).toBeNull(); // 10 chiffres
    expect(toE164("77 123 45 6", "SN")).toBeNull(); // 8 chiffres pour un plan à 9
  });

  test("pays inconnu ou vide sans indicatif dans la saisie → refusé", () => {
    expect(toE164("70123456", "XX")).toBeNull();
    expect(toE164("70123456", null)).toBeNull();
    expect(toE164("", "BF")).toBeNull();
  });

  test("Amérique du Nord : +1 avec 10 chiffres", () => {
    expect(toE164("514 555 0199", "CA")).toBe("+15145550199");
    expect(toE164("+1 514 555 0199", "BF")).toBe("+15145550199");
  });
});

describe("isValidE164", () => {
  test("accepte un numéro international plausible", () => {
    expect(isValidE164("+22670123456")).toBe(true);
    expect(isValidE164("22670123456")).toBe(true);
    expect(isValidE164("+2250708091011")).toBe(true);
  });

  test("refuse un numéro local sans indicatif (le lien wa.me mort)", () => {
    expect(isValidE164("70123456")).toBe(false);
    expect(isValidE164("0708091011")).toBe(false);
  });

  test("refuse un indicatif inconnu ou une longueur impossible", () => {
    expect(isValidE164("+99912345678")).toBe(false);
    expect(isValidE164("+2267012")).toBe(false);
    expect(isValidE164("")).toBe(false);
    expect(isValidE164(null)).toBe(false);
  });
});

describe("nsnHint", () => {
  test("phrase d'aide selon le pays", () => {
    expect(nsnHint("BF")).toBe("8 chiffres");
    expect(nsnHint("GA")).toBe("7 ou 8 chiffres");
    expect(nsnHint("LR")).toBe("7, 8 ou 9 chiffres");
    expect(nsnHint("XX")).toBeNull();
  });
});

describe("indicatif suivant le pays de livraison (contrat du checkout)", () => {
  // checkout-form.tsx dérive `phoneCountry` du pays de livraison tant que
  // l'acheteur n'a pas choisi lui-même un indicatif. Ce test fixe le contrat
  // pour les pays couverts par Genius Pay qui n'avaient AUCUN indicatif avant.
  test.each([
    ["BJ", "+229"],
    ["TG", "+228"],
    ["GA", "+241"],
    ["CG", "+242"],
    ["CD", "+243"],
    ["RW", "+250"],
    ["UG", "+256"],
    ["ZM", "+260"],
    ["SL", "+232"],
    ["NE", "+227"],
    ["GN", "+224"],
  ])("livraison %s → indicatif %s", (iso2, expected) => {
    expect(dialCodeFor(iso2)).toBe(expected);
  });
});
