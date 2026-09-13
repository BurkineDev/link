/**
 * Règle de livraison partagée entre la page de commande et l'API.
 */
import {
  cartNeedsShipping,
  checkoutTotal,
  findShippingZone,
  quoteShipping,
  shippingAmount,
} from "@/lib/checkout/shipping";

const ZONES = [
  { countries: ["BF", "ML"], rate: 2_000, free_above: 20_000 },
  { countries: ["ci"], rate: 0, free_above: null },
  { countries: ["BF"], rate: 9_999, free_above: null }, // doublon : la première l'emporte
];

describe("quoteShipping", () => {
  test("rien à livrer, ou vendeur qui ne facture pas ici → none", () => {
    expect(quoteShipping({ physical: false, shippingEnabled: true, zones: ZONES, country: "BF", subtotal: 5_000 })).toEqual({ kind: "none" });
    expect(quoteShipping({ physical: true, shippingEnabled: false, zones: ZONES, country: "BF", subtotal: 5_000 })).toEqual({ kind: "none" });
  });

  test("pays inconnu → unknown ; pays non desservi → unavailable", () => {
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: null, subtotal: 5_000 })).toEqual({ kind: "unknown" });
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: "", subtotal: 5_000 })).toEqual({ kind: "unknown" });
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: "SN", subtotal: 5_000 })).toEqual({ kind: "unavailable" });
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: [], country: "BF", subtotal: 5_000 })).toEqual({ kind: "unavailable" });
  });

  test("tarif de la zone, gratuit au-dessus du seuil ou à tarif nul, casse du pays indifférente", () => {
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: "bf", subtotal: 5_000 })).toEqual({ kind: "paid", amount: 2_000 });
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: "BF", subtotal: 20_000 })).toEqual({ kind: "free", amount: 0 });
    expect(quoteShipping({ physical: true, shippingEnabled: true, zones: ZONES, country: "CI", subtotal: 1 })).toEqual({ kind: "free", amount: 0 });
    expect(findShippingZone(ZONES, "BF")).toBe(ZONES[0]);
  });
});

describe("checkoutTotal", () => {
  test("sous-total − remise + livraison chiffrée, jamais négatif", () => {
    expect(checkoutTotal({ subtotal: 10_000, discount: 2_000, shipping: { kind: "paid", amount: 1_500 } })).toBe(9_500);
    expect(checkoutTotal({ subtotal: 10_000, shipping: { kind: "unknown" } })).toBe(10_000);
    expect(checkoutTotal({ subtotal: 10_000, shipping: { kind: "unavailable" } })).toBe(10_000);
    expect(checkoutTotal({ subtotal: 1_000, discount: 5_000, shipping: { kind: "free", amount: 0 } })).toBe(0);
    expect(shippingAmount({ kind: "none" })).toBe(0);
  });
});

describe("cartNeedsShipping", () => {
  test("numérique seul → non ; un physique ou un inconnu (ancien panier) → oui", () => {
    expect(cartNeedsShipping([{ isDigital: true }, { isDigital: true }])).toBe(false);
    expect(cartNeedsShipping([{ isDigital: true }, { isDigital: false }])).toBe(true);
    expect(cartNeedsShipping([{ isDigital: true }, {}])).toBe(true);
    expect(cartNeedsShipping([])).toBe(false);
  });
});
