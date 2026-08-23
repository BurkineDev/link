/**
 * Couverture Mobile Money par pays.
 *
 * Genius Pay accepte un paiement Mobile Money pour un pays qu'il ne couvre
 * pas, le passe en « processing », et n'envoie jamais le push. L'acheteur
 * attend un message qui ne viendra pas. Ces tests fixent la liste qui évite
 * de lui faire perdre son temps.
 */

import {
  MOBILE_MONEY_COUNTRIES,
  isMobileMoneyCovered,
} from "@/lib/payments/mobile-money-coverage";

describe("isMobileMoneyCovered", () => {
  test("couvre les pays de la table Genius Pay", () => {
    for (const code of ["CI", "SN", "BJ", "CM", "KE", "RW"]) {
      expect(isMobileMoneyCovered(code)).toBe(true);
    }
  });

  test("le Burkina Faso n'est pas couvert — le cas qui a échoué en production", () => {
    expect(isMobileMoneyCovered("BF")).toBe(false);
  });

  test("les autres voisins non couverts sont bien exclus", () => {
    for (const code of ["ML", "NE", "TG"]) {
      expect(isMobileMoneyCovered(code)).toBe(false);
    }
  });

  test("accepte une casse quelconque", () => {
    expect(isMobileMoneyCovered("ci")).toBe(true);
    expect(isMobileMoneyCovered("bf")).toBe(false);
  });

  test("sans pays renseigné, on laisse l'acheteur essayer", () => {
    // Ne pas fermer une porte faute d'information : le formulaire de commande
    // n'exige pas d'adresse pour un produit numérique.
    expect(isMobileMoneyCovered(null)).toBe(true);
    expect(isMobileMoneyCovered(undefined)).toBe(true);
    expect(isMobileMoneyCovered("")).toBe(true);
  });

  test("la liste compte les 12 pays documentés", () => {
    expect(MOBILE_MONEY_COUNTRIES.size).toBe(12);
  });
});
