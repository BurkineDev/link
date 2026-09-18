/**
 * formatPrice — le contrat typographique du prix, figé indépendamment de
 * l'ICU du moteur : « 12 500 FCFA » avec une insécable ordinaire (U+00A0)
 * entre les milliers et avant le symbole, jamais de décimales en FCFA,
 * jamais « XOF ». C'est ce qu'une acheteuse lit sur la pastille de prix,
 * dans le message WhatsApp et dans la story (la Geist de satori n'a pas
 * l'espace fine U+202F, qui déclenchait des requêtes Google Fonts).
 *
 * splitPriceSymbol vit au même endroit : c'est l'autre moitié du contrat.
 */

import { formatPrice, splitPriceSymbol } from "@/lib/utils/format";

const NBSP = " ";

describe("formatPrice — FCFA", () => {
  it("écrit « 12 500 FCFA » : insécable entre les milliers et avant le symbole", () => {
    expect(formatPrice(12500, "XOF")).toBe(`12${NBSP}500${NBSP}FCFA`);
    expect(formatPrice(1250000, "XOF")).toBe(`1${NBSP}250${NBSP}000${NBSP}FCFA`);
  });

  it("n'emploie jamais l'espace fine U+202F ni une espace ordinaire", () => {
    for (const amount of [999, 5000, 12500, 1250000]) {
      const out = formatPrice(amount, "XOF");
      expect(out).not.toContain(" ");
      expect(out).not.toContain(" ");
    }
  });

  it("n'écrit jamais de décimales, même pour un montant fractionnaire", () => {
    expect(formatPrice(12500.75, "XOF")).toBe(`12${NBSP}501${NBSP}FCFA`);
    expect(formatPrice(5000.4, "XAF")).toBe(`5${NBSP}000${NBSP}FCFA`);
    expect(formatPrice(12500, "XOF")).not.toMatch(/[,.]\d/);
  });

  it("ne groupe pas sous mille, et écrit FCFA plutôt que le code ISO", () => {
    expect(formatPrice(999, "XAF")).toBe(`999${NBSP}FCFA`);
    expect(formatPrice(0, "XOF")).toBe(`0${NBSP}FCFA`);
    expect(formatPrice(12500, "XOF")).not.toContain("XOF");
    expect(formatPrice(12500, "XAF")).not.toContain("XAF");
  });
});

describe("formatPrice — autres devises", () => {
  it("MAD : deux décimales à la virgule, insécable avant DH", () => {
    expect(formatPrice(9.5, "MAD")).toBe(`9,50${NBSP}DH`);
    // fr-MA groupe les milliers par un point sur certains ICU, par une
    // insécable sur d'autres : seuls la virgule et l'insécable avant DH sont
    // du contrat.
    expect(formatPrice(2500, "MAD")).toMatch(new RegExp(`^2[.${NBSP}]500,00${NBSP}DH$`));
  });

  it("symbole avant le nombre pour NGN, GHS, KES et USD, avec deux décimales", () => {
    expect(formatPrice(2500, "NGN")).toBe("₦2,500.00");
    expect(formatPrice(9.99, "USD")).toBe("$9.99");
    expect(formatPrice(1200, "GHS")).toBe("GH₵1,200.00");
    expect(formatPrice(300, "KES")).toBe("KSh300.00");
  });

  it("devise inconnue : le nombre puis le code, sans lever", () => {
    expect(formatPrice(1500, "EUR")).toMatch(/^1[,.   ]?500 EUR$/);
  });
});

describe("splitPriceSymbol", () => {
  it("détache un symbole qui suit le nombre après une insécable", () => {
    expect(splitPriceSymbol(formatPrice(12500, "XOF"))).toEqual({
      amount: `12${NBSP}500`,
      symbol: "FCFA",
    });
    expect(splitPriceSymbol(formatPrice(9.5, "MAD"))).toEqual({
      amount: "9,50",
      symbol: "DH",
    });
  });

  it("laisse entier un prix dont le symbole précède le nombre", () => {
    expect(splitPriceSymbol("₦2,500.00")).toEqual({ amount: "₦2,500.00" });
    expect(splitPriceSymbol("$9.99")).toEqual({ amount: "$9.99" });
  });
});
