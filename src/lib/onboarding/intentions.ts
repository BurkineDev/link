/**
 * Onboarding par intention.
 *
 * Le vendeur ne vient pas « créer une boutique » : il vient vendre sur
 * WhatsApp, ramener son audience TikTok quelque part, annoncer une promo.
 * On le lui demande, et on compose sa première page à sa place — plutôt que
 * de le livrer devant un Page Builder vide qu'il devra deviner.
 *
 * Deux garanties tiennent ce module :
 *  • on ne génère un bloc que si on a de quoi le remplir *vraiment* (une
 *    intention sans données ne produit rien plutôt qu'un bloc creux) ;
 *  • toute config passe par `parseBlockConfig`, le même validateur que l'API,
 *    donc l'onboarding ne peut pas écrire un bloc que l'éditeur refuserait.
 */

import { parseBlockConfig, type BlockType } from "@/lib/blocks/types";

// ---------------------------------------------------------------------------
// Intentions
// ---------------------------------------------------------------------------

export const INTENTIONS = ["sell", "whatsapp", "socials", "promote"] as const;

export type Intention = (typeof INTENTIONS)[number];

export function isIntention(value: unknown): value is Intention {
  return (
    typeof value === "string" && (INTENTIONS as readonly string[]).includes(value)
  );
}

export const INTENTION_META: Record<
  Intention,
  { emoji: string; label: string; description: string }
> = {
  sell: {
    emoji: "🛍️",
    label: "Vendre mes produits",
    description: "Une vitrine avec tes articles, ton prix, tes photos.",
  },
  whatsapp: {
    emoji: "💬",
    label: "Recevoir mes commandes sur WhatsApp",
    description: "Un bouton qui ouvre la discussion, message déjà écrit.",
  },
  socials: {
    emoji: "📱",
    label: "Rassembler tous mes réseaux",
    description: "Un seul lien dans ta bio pour TikTok, Insta, YouTube.",
  },
  promote: {
    emoji: "📣",
    label: "Annoncer mes promos",
    description: "Un message en haut de page, visible dès l'arrivée.",
  },
};

// ---------------------------------------------------------------------------
// Réseaux sociaux
// ---------------------------------------------------------------------------

export const SOCIAL_NETWORKS = ["tiktok", "instagram", "youtube"] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_NETWORK_META: Record<
  SocialNetwork,
  { label: string; placeholder: string }
> = {
  tiktok: { label: "TikTok", placeholder: "@monpseudo" },
  instagram: { label: "Instagram", placeholder: "@monpseudo" },
  youtube: { label: "YouTube", placeholder: "@machaine" },
};

const SOCIAL_BASE: Record<SocialNetwork, string> = {
  tiktok: "https://www.tiktok.com/@",
  instagram: "https://www.instagram.com/",
  youtube: "https://www.youtube.com/@",
};

/**
 * Transforme ce que le vendeur tape en URL utilisable.
 *
 * Sur mobile, personne ne tape une URL complète : on reçoit `@pseudo`,
 * `pseudo`, ou l'URL copiée depuis l'app. Les trois doivent marcher — un
 * champ qui rejette le collage d'une URL TikTok est un champ qui fait
 * abandonner. Renvoie null si rien d'exploitable n'a été saisi.
 */
export function socialProfileUrl(
  network: SocialNetwork,
  input: string,
): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // URL déjà complète : on la garde telle quelle, c'est celle que le vendeur
  // a vérifiée dans son app.
  if (/^https?:\/\//i.test(raw)) {
    return raw.length <= 500 ? raw : null;
  }

  const handle = raw.replace(/^@+/, "").replace(/\/+$/, "");
  // Un handle ne contient ni espace ni slash : au-delà, on ne devine pas.
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;

  return `${SOCIAL_BASE[network]}${handle}`;
}

// ---------------------------------------------------------------------------
// Composition de la première page
// ---------------------------------------------------------------------------

/** Un bloc prêt à insérer : type, titre, config déjà validée. */
export interface BlockSeed {
  type: BlockType;
  title: string | null;
  config: unknown;
  position: number;
}

export interface SeedArgs {
  intentions: Intention[];
  /** Numéro WhatsApp de la boutique, chiffres uniquement. */
  whatsappNumber?: string | null;
  /** Ce que le vendeur a saisi par réseau, brut. */
  handles?: Partial<Record<SocialNetwork, string>>;
  /** Le message de promo, s'il en a écrit un. */
  announcement?: string | null;
  /** Nom de la boutique — sert au message WhatsApp pré-rempli. */
  shopName?: string;
}

/**
 * Compose la première page à partir des intentions.
 *
 * L'ordre est délibéré et suit la façon dont une page se lit sur un téléphone :
 * l'annonce d'abord (c'est ce qui a une date de péremption), les réseaux
 * ensuite (le visiteur vient souvent de l'un d'eux), la boutique, et le bouton
 * WhatsApp en dernier — c'est aussi le CTA flottant, il n'a pas besoin d'être
 * en haut.
 */
export function seedBlocksForIntentions(args: SeedArgs): BlockSeed[] {
  const {
    intentions,
    whatsappNumber,
    handles = {},
    announcement,
    shopName,
  } = args;

  const chosen = new Set(intentions.filter(isIntention));
  const seeds: BlockSeed[] = [];

  const push = (type: BlockType, title: string | null, config: unknown) => {
    const parsed = parseBlockConfig(type, config);
    // Une saisie qui ne passe pas le schéma partagé est ignorée : mieux vaut
    // une page plus courte qu'un onboarding qui échoue sur un bloc.
    if (parsed === null) return;
    seeds.push({ type, title, config: parsed, position: seeds.length });
  };

  if (chosen.has("promote") && announcement?.trim()) {
    push("TEXT", null, { body: announcement.trim(), align: "center" });
  }

  if (chosen.has("socials")) {
    for (const network of SOCIAL_NETWORKS) {
      const url = socialProfileUrl(network, handles[network] ?? "");
      if (!url) continue;
      push("LINK", null, {
        url,
        label: SOCIAL_NETWORK_META[network].label,
        icon: network,
      });
    }
  }

  if (chosen.has("sell")) {
    push("PRODUCT_COLLECTION", "Ma boutique", {
      layout: "grid",
      limit: 12,
      productIds: [],
    });
  }

  if (chosen.has("whatsapp")) {
    const digits = (whatsappNumber ?? "").replace(/\D/g, "");
    // Sans numéro, le bouton mènerait nulle part : on n'en crée pas. Le
    // vendeur reste avec l'intention enregistrée, et le tableau de bord la
    // lui rappellera.
    if (digits.length >= 8) {
      push("WHATSAPP", null, {
        phone: digits,
        label: "Commander sur WhatsApp",
        prefilledMessage: shopName
          ? `Bonjour ${shopName}, je suis intéressé(e) par…`
          : null,
      });
    }
  }

  return seeds;
}
