/**
 * Catalogue des plans : une seule source pour la home, la page Tarifs et les
 * CGU, dérivée des constantes qui facturent.
 *
 * Deux modes. Sous Jest, NEXT_PUBLIC_ONLINE_CHECKOUT est absente : la caisse
 * est masquée par défaut. Les cas « En ligne » posent le drapeau dans un
 * beforeEach et le retirent après — le catalogue le lit à chaque appel.
 */
import {
  PLAN_FEATURES,
  PLAN_TAGLINES,
  cardPriceLabel,
  commissionNote,
  featureSentence,
  planFeatures,
  planLabel,
  planPriceSummary,
  planPricing,
  planTagline,
} from "@/lib/plans/catalog";
import { canHideBadge, showBioLienBadge } from "@/lib/plans/badge";
import { PLAN_LIMITS, PLAN_PRICES, PREPAID_PRICES, formatPlanPrice } from "@/lib/subscription";

const PLANS = ["free", "starter", "pro"] as const;

describe("caisse allumée (NEXT_PUBLIC_ONLINE_CHECKOUT=1) : le catalogue complet", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  });

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

  test("planFeatures et planTagline rendent le catalogue complet", () => {
    for (const plan of PLANS) {
      expect(planFeatures(plan)).toEqual(PLAN_FEATURES[plan]);
      expect(planTagline(plan)).toBe(PLAN_TAGLINES[plan]);
    }
    expect(planFeatures("free")).toContain("Paiements Mobile Money et carte bancaire");
    expect(planTagline("pro")).toBe("Pour vendre régulièrement, sans commission");
  });

  test("la commission est annoncée", () => {
    expect(commissionNote("free")).toBe("5 % de commission sur chaque vente.");
    expect(commissionNote("starter")).toBe("3 % de commission sur chaque vente.");
    expect(commissionNote("pro")).toBe("Aucune commission.");
  });
});

describe("caisse masquée (drapeau absent) : la commande part sur WhatsApp", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  });

  test("aucune ligne ne parle de commission, de Mobile Money ni de carte bancaire", () => {
    for (const plan of PLANS) {
      const lines = planFeatures(plan).join(" | ").toLowerCase();
      for (const word of ["commission", "mobile money", "carte bancaire"]) {
        expect(lines).not.toContain(word);
      }
    }
    expect(featureSentence("pro")).toBe("produits illimités, rédaction assistée par IA, badge Bio-Lien masquable, support prioritaire");
    expect(featureSentence("starter")).not.toContain("commission");
  });

  test("le plan gratuit annonce les commandes WhatsApp à la place du paiement en ligne", () => {
    expect(planFeatures("free")).toContain("Commandes reçues sur WhatsApp");
    expect(planFeatures("free")).not.toContain("Paiements Mobile Money et carte bancaire");
    // Même place dans la liste : l'offre à l'inscription montre les trois premières.
    expect(planFeatures("free")[2]).toBe("Commandes reçues sur WhatsApp");
    expect(planFeatures("free")).toHaveLength(PLAN_FEATURES.free.length);
  });

  test("le reste du catalogue est intact", () => {
    expect(planFeatures("starter")).toEqual([
      `Jusqu'à ${PLAN_LIMITS.starter.maxProducts} produits`,
      "Badge Bio-Lien masquable",
      "Support par e-mail",
    ]);
    expect(planFeatures("pro")).toContain("Rédaction assistée par IA");
    expect(planFeatures("free")).not.toContain("Badge Bio-Lien masquable");
  });

  test("commissionNote est vide, pour tous les plans", () => {
    for (const plan of PLANS) expect(commissionNote(plan)).toBe("");
  });

  test("la phrase du plan Pro ne vend plus l'absence de commission", () => {
    expect(planTagline("pro")).toBe("Pour vendre régulièrement, sans limite");
    expect(planTagline("pro").toLowerCase()).not.toContain("commission");
    expect(planTagline("free")).toBe(PLAN_TAGLINES.free);
    expect(planTagline("starter")).toBe(PLAN_TAGLINES.starter);
  });

  test("le catalogue complet reste exporté tel quel (réversibilité)", () => {
    expect(PLAN_FEATURES.starter[1]).toBe("Commission réduite à 3 %");
    expect(PLAN_TAGLINES.pro).toBe("Pour vendre régulièrement, sans commission");
  });

  test("le drapeau est lu à chaque appel, pas à l'import", () => {
    expect(commissionNote("free")).toBe("");
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
    expect(commissionNote("free")).toBe("5 % de commission sur chaque vente.");
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    expect(commissionNote("free")).toBe("");
  });
});

/**
 * La page Tarifs présente les cartes en cumul (« Tout du plan X, plus : ») en
 * retirant de Starter ce que Découverte comprend, et de Pro ce que Starter
 * comprend. Le catalogue ne doit pas laisser une carte vide ni répéter une
 * ligne, quel que soit le mode.
 */
describe.each([
  ["caisse masquée", undefined],
  ["caisse allumée", "1"],
])("présentation en cumul de la page Tarifs, %s", (_label, flag) => {
  beforeEach(() => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
    else process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = flag;
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
  });

  test("chaque carte garde au moins une ligne propre, sans doublon", () => {
    const free = planFeatures("free");
    const starter = planFeatures("starter").filter((f) => !free.includes(f));
    const pro = planFeatures("pro").filter((f) => !planFeatures("starter").includes(f));
    expect(free.length).toBeGreaterThan(0);
    expect(starter.length).toBeGreaterThan(0);
    expect(pro.length).toBeGreaterThan(0);
    expect(new Set([...free, ...starter, ...pro]).size).toBe(free.length + starter.length + pro.length);
    // Ce qui distingue Pro de Starter, dans les deux modes.
    expect(pro).toContain("Rédaction assistée par IA");
    expect(pro).toContain("Produits illimités");
  });

  test("la note de commission, sans son point, ne laisse ni ligne vide ni virgule en trop", () => {
    const line = commissionNote("free").replace(/\.$/, "");
    const aside = line ? `, ${line.toLowerCase()}` : "";
    if (flag === "1") {
      expect(line).toBe("5 % de commission sur chaque vente");
      expect(aside).toBe(", 5 % de commission sur chaque vente");
    } else {
      expect(line).toBe("");
      expect(aside).toBe("");
    }
  });
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
  expect(planLabel("free")).toBe("Découverte");
});

test("badge : la contrepartie du plan gratuit, retirable sur un plan payant", () => {
  expect(canHideBadge("free")).toBe(false);
  expect(canHideBadge("starter")).toBe(true);
  expect(showBioLienBadge("free", false)).toBe(true);
  expect(showBioLienBadge("starter", false)).toBe(false);
  expect(showBioLienBadge("pro", true)).toBe(true);
});
