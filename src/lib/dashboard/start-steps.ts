/**
 * Les trois étapes qui font vendre — la partie pure.
 *
 * Après l'assistant, l'accueil du tableau de bord montrait neuf entrées et
 * des tuiles à zéro. Une vendeuse non technique a besoin d'une seule
 * question à la fois : qu'est-ce que je fais maintenant ? Trois étapes,
 * cochées au fur et à mesure, puis la liste disparaît.
 */

export type StartStepId = "products" | "bio-link" | "whatsapp-share";

export interface StartStep {
  id: StartStepId;
  title: string;
  detail: string;
  done: boolean;
}

export interface StartStepsInput {
  productsCount: number;
  /** Le lien a été copié depuis cet écran (mémoire locale du téléphone). */
  linkCopied: boolean;
  /** Le partage WhatsApp a été ouvert depuis cet écran (mémoire locale). */
  sharedOnWhatsApp: boolean;
}

export function startSteps(input: StartStepsInput): StartStep[] {
  return [
    {
      id: "products",
      title: "Ajoute tes produits",
      detail: input.productsCount === 0 ? "Un nom, un prix, une photo — trois suffisent pour commencer." : `${input.productsCount} produit${input.productsCount > 1 ? "s" : ""} en ligne.`,
      done: input.productsCount > 0,
    },
    {
      id: "bio-link",
      title: "Mets ton lien dans ta bio TikTok et Instagram",
      detail: "Copie-le, puis colle-le dans « Modifier le profil » → Site web.",
      done: input.linkCopied,
    },
    {
      id: "whatsapp-share",
      title: "Envoie-le à cinq clients sur WhatsApp",
      detail: "Tes premières commandes viendront de gens qui te connaissent déjà.",
      done: input.sharedOnWhatsApp,
    },
  ];
}

export function allStepsDone(steps: StartStep[]): boolean {
  return steps.every((step) => step.done);
}

/** Clés de la mémoire locale, par boutique : changer de boutique ne coche rien. */
export function stepStorageKey(slug: string, step: Extract<StartStepId, "bio-link" | "whatsapp-share">): string {
  return `biolien:start:${slug}:${step}`;
}

/** « Découverte · 2 / 3 produits » — ou « Starter · 7 / 20 » ; illimité sans fraction. */
export function planLine(label: string, productsCount: number, maxProducts: number): string {
  return Number.isFinite(maxProducts) ? `${label} · ${productsCount} / ${maxProducts} produits` : `${label} · ${productsCount} produit${productsCount > 1 ? "s" : ""}`;
}
