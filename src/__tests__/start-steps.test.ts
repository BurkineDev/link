/**
 * « Trois étapes pour vendre » : cochées d'après ce qu'on sait (produits en
 * base) et ce que le téléphone se rappelle (lien copié, partage ouvert),
 * la ligne du plan, et la clé de mémoire par boutique.
 */

import { allStepsDone, planLine, startSteps, stepStorageKey } from "@/lib/dashboard/start-steps";

describe("startSteps", () => {
  test("rien de fait : trois étapes à faire, dans l'ordre produits → bio → WhatsApp", () => {
    const steps = startSteps({ productsCount: 0, linkCopied: false, sharedOnWhatsApp: false });
    expect(steps.map((s) => s.id)).toEqual(["products", "bio-link", "whatsapp-share"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(allStepsDone(steps)).toBe(false);
    expect(steps[0].detail).toContain("Un nom, un prix, une photo");
  });

  test("les produits comptent depuis la base ; les deux gestes depuis le téléphone", () => {
    const steps = startSteps({ productsCount: 2, linkCopied: true, sharedOnWhatsApp: false });
    expect(steps[0]).toMatchObject({ done: true, detail: "2 produits en ligne." });
    expect(steps[1].done).toBe(true);
    expect(steps[2].done).toBe(false);
    expect(allStepsDone(startSteps({ productsCount: 1, linkCopied: true, sharedOnWhatsApp: true }))).toBe(true);
  });
});

describe("planLine / stepStorageKey", () => {
  test("la ligne du plan dit où on en est, sans fraction quand c'est illimité", () => {
    expect(planLine("Découverte", 2, 3)).toBe("Découverte · 2 / 3 produits");
    expect(planLine("Starter", 7, 20)).toBe("Starter · 7 / 20 produits");
    expect(planLine("Pro", 1, Infinity)).toBe("Pro · 1 produit");
    expect(planLine("Pro", 12, Infinity)).toBe("Pro · 12 produits");
  });

  test("une clé par boutique et par geste", () => {
    expect(stepStorageKey("awa-couture", "bio-link")).toBe("biolien:start:awa-couture:bio-link");
    expect(stepStorageKey("awa-couture", "whatsapp-share")).not.toBe(stepStorageKey("wendtech", "whatsapp-share"));
  });
});
