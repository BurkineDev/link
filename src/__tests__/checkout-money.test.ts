/**
 * Arrondis d'argent partagés entre la validation du code promo (page), sa
 * consommation (API) et le total envoyé au prestataire.
 */
import { currencyDecimals, percentDiscount, roundToCurrency } from "@/lib/checkout/money";

test("précision par devise : 0 décimale en XOF/XAF, 2 ailleurs, 2 par défaut", () => {
  expect(currencyDecimals("XOF")).toBe(0);
  expect(currencyDecimals("XAF")).toBe(0);
  expect(currencyDecimals("EUR")).toBe(2);
  expect(currencyDecimals("???")).toBe(2);
});

test("roundToCurrency : au franc en XOF, au centime en EUR", () => {
  expect(roundToCurrency(1795.5, "XOF")).toBe(1796);
  expect(roundToCurrency(199.4, "XOF")).toBe(199);
  expect(roundToCurrency(1.234, "EUR")).toBe(1.23);
  expect(roundToCurrency(1.235, "EUR")).toBe(1.24);
});

test("percentDiscount : même chiffre à l'écran et en base, plafonné au sous-total", () => {
  // 1 995 F × 10 % : la page disait 200, l'API 199,5 → désormais 200 partout.
  expect(percentDiscount(1_995, 10, "XOF")).toBe(200);
  expect(percentDiscount(12.34, 10, "EUR")).toBe(1.23);
  expect(percentDiscount(15.6, 10, "EUR")).toBe(1.56);
  expect(percentDiscount(1_000, 150, "XOF")).toBe(1_000);
  expect(percentDiscount(0, 10, "XOF")).toBe(0);
});
