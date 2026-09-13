/**
 * Catalogue des plans : une seule source pour la home, la page Tarifs et les
 * CGU, dérivée des constantes qui facturent.
 */
import {
  PLAN_FEATURES,
  cardPriceLabel,
  commissionNote,
  featureSentence,
  planLabel,
  planPriceSummary,
  planPricing,
} from "@/lib/plans/catalog";
import { canHideBadge, showBioLienBadge } from "@/lib/plans/badge";
import { PLAN_LIMITS, PLAN_PRICES, PREPAID_PRICES, formatPlanPrice } from "@/lib/subscription";

test("les fonctionnalités reprennent les limites réelles, sans promesse non codée", () => {
  expect(PLAN_FEATURES.free[0]).toBe(`Jusqu'à ${PLAN_LIMITS.free.maxProducts} produits`);
  expect(PLAN_FEATURES.starter[0]).toBe(`Jusqu'à ${PLAN_LIMITS.starter.maxProducts} produits`);
  expect(PLAN_FEATURES.starter[1]).toBe("Commission réduite à 3 %");
  expect(PLAN_FEATURES.pro[1]).toBe("0 % de commission sur les ventes");
  expect(featureSentence("pro")).toMatch(/^produits illimités, 0 % de commission sur les ventes, rédaction assistée par IA, badge Bio-Lien masquable, support prioritaire$/);
  const all = Object.values(PLAN_FEATURES).flat().join(" | ").toLowerCase();
  for (const promise of ["templates premium", "analytics avancés", "suppression du badge", "statistiques détaillées"]) {
    expect(all).not.toContain(promise);
  }
  // Ce qui existe : rédaction IA sur Pro seulement, badge masquable sur les payants.
  expect(PLAN_FEATURES.pro).toContain("Rédaction assistée par IA");
  expect(PLAN_FEATURES.starter).not.toContain("Rédaction assistée par IA");
  expect(PLAN_FEATURES.starter).toContain("Badge Bio-Lien masquable");
  expect(PLAN_FEATURES.free).not.toContain("Badge Bio-Lien masquable");
});

test("le prix carte affiché est celui que Stripe facture", () => {
  expect(cardPriceLabel("pro", "year")).toBe(formatPlanPrice(PLAN_PRICES.pro.year));
  expect(cardPriceLabel("pro", "year")).toBe("99 $CA");
  expect(cardPriceLabel("starter", "month")).toBe("4,99 $CA");
  const pro = planPricing("pro");
  expect(pro.prepaid.months1).toBe(`${PREPAID_PRICES.pro[1].toLocaleString("fr-FR")} FCFA`);
  expect(pro.prepaid.yearlySavingsPercent).toBeGreaterThan(0);
  // Espace fine insécable (U+202F) de fr-FR, comme partout ailleurs (formatPrice).
  expect(planPriceSummary("starter")).toBe("2\u202f000 FCFA / mois, 5\u202f000 FCFA / 3 mois ou 18\u202f000 FCFA / an ; par carte 4,99 $CA / mois ou 49 $CA / an");
  expect(planPriceSummary("free")).toBe("gratuit");
  expect(commissionNote("free")).toBe("5 % de commission sur chaque vente.");
  expect(commissionNote("pro")).toBe("Aucune commission.");
  expect(planLabel("free")).toBe("Découverte");
});

test("badge : la contrepartie du plan gratuit, retirable sur un plan payant", () => {
  expect(canHideBadge("free")).toBe(false);
  expect(canHideBadge("starter")).toBe(true);
  expect(showBioLienBadge("free", false)).toBe(true);
  expect(showBioLienBadge("starter", false)).toBe(false);
  expect(showBioLienBadge("pro", true)).toBe(true);
});
