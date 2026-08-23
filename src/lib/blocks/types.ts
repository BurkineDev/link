/**
 * Registre des types de blocs de la BioPage.
 *
 * Un bloc = un morceau de la page publique. Son contenu propre vit dans
 * `config`, validé ici par un schéma Zod dédié. Ajouter un type de bloc se
 * fait à trois endroits et trois seulement :
 *   1. la valeur dans BLOCK_TYPES (et dans le CHECK de la migration 020) ;
 *   2. son schéma de config dans BLOCK_CONFIG_SCHEMAS ;
 *   3. son rendu public et son formulaire d'édition.
 * Aucune réécriture du Page Builder, aucune migration de colonne.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const BLOCK_TYPES = [
  "LINK",
  "PRODUCT",
  "PRODUCT_COLLECTION",
  "WHATSAPP",
  "SOCIAL",
  "VIDEO",
  "IMAGE",
  "GALLERY",
  "TEXT",
  "SERVICE",
  "BOOKING",
  "PAYMENT",
  "FORM",
  "REVIEWS",
  "LOCATION",
  "PROMOTION",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export function isBlockType(value: unknown): value is BlockType {
  return (
    typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Briques de validation communes
// ---------------------------------------------------------------------------

/** URL sortante d'un bloc : http(s), mailto: ou tel: — jamais javascript:. */
const linkUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) => /^(https?:\/\/|mailto:|tel:)/i.test(v),
    "URL invalide (http(s)://, mailto: ou tel:)",
  );

/** Média servi à des visiteurs : https obligatoire, pas de contenu mixte. */
const httpsUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((v) => /^https:\/\//i.test(v), "L'adresse doit être en https://");

const shortText = z.string().trim().max(120);
const longText = z.string().trim().max(2000);

// ---------------------------------------------------------------------------
// Schémas de configuration, par type
// ---------------------------------------------------------------------------

export const BLOCK_CONFIG_SCHEMAS = {
  LINK: z.object({
    url: linkUrl,
    label: shortText.min(1),
    icon: z.string().trim().max(30).default("custom"),
    thumbnailUrl: httpsUrl.nullish(),
    /** Optionnel : sous-titre affiché sous le libellé. */
    description: shortText.nullish(),
  }),

  PRODUCT: z.object({
    productId: z.string().uuid(),
    /** Mise en avant : le bloc occupe toute la largeur. */
    featured: z.boolean().default(false),
  }),

  PRODUCT_COLLECTION: z.object({
    /** Vide = tous les produits publiés de la boutique. */
    categoryId: z.string().uuid().nullish(),
    productIds: z.array(z.string().uuid()).max(50).default([]),
    layout: z.enum(["grid", "carousel", "list"]).default("grid"),
    limit: z.number().int().min(1).max(50).default(12),
  }),

  WHATSAPP: z.object({
    /** Vide = le numéro de la boutique. */
    phone: z.string().trim().max(20).nullish(),
    label: shortText.min(1).default("Commander sur WhatsApp"),
    prefilledMessage: longText.nullish(),
  }),

  SOCIAL: z.object({
    /** Vide = les réseaux renseignés dans les réglages de la boutique. */
    networks: z
      .array(
        z.object({
          network: z.string().trim().min(1).max(30),
          url: linkUrl,
        }),
      )
      .max(12)
      .default([]),
  }),

  VIDEO: z.object({
    url: httpsUrl,
    provider: z.enum(["youtube", "tiktok", "vimeo", "direct"]).default("youtube"),
    caption: shortText.nullish(),
  }),

  IMAGE: z.object({
    url: httpsUrl,
    alt: shortText.default(""),
    linkUrl: linkUrl.nullish(),
  }),

  GALLERY: z.object({
    images: z
      .array(z.object({ url: httpsUrl, alt: shortText.default("") }))
      .min(1)
      .max(20),
    layout: z.enum(["grid", "carousel"]).default("grid"),
  }),

  TEXT: z.object({
    body: longText.min(1),
    align: z.enum(["left", "center"]).default("center"),
  }),

  SERVICE: z.object({
    name: shortText.min(1),
    description: longText.nullish(),
    price: z.number().nonnegative().nullish(),
    /** Vide = devise de la boutique. */
    currency: z.string().trim().length(3).nullish(),
    /** Durée indicative, en minutes. */
    durationMinutes: z.number().int().positive().max(24 * 60).nullish(),
    ctaLabel: shortText.default("Réserver"),
    ctaUrl: linkUrl.nullish(),
  }),

  BOOKING: z.object({
    /** Lien de prise de rendez-vous externe, en attendant l'agenda natif. */
    url: linkUrl,
    label: shortText.default("Prendre rendez-vous"),
  }),

  PAYMENT: z.object({
    label: shortText.default("Payer"),
    amount: z.number().positive().nullish(),
    currency: z.string().trim().length(3).nullish(),
    /** Vrai = l'acheteur saisit lui-même le montant. */
    allowCustomAmount: z.boolean().default(false),
    description: longText.nullish(),
  }),

  FORM: z.object({
    title: shortText.default("Laisse-moi tes coordonnées"),
    fields: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(40),
          label: shortText.min(1),
          type: z.enum(["text", "email", "phone", "textarea"]).default("text"),
          required: z.boolean().default(false),
        }),
      )
      .min(1)
      .max(10),
    submitLabel: shortText.default("Envoyer"),
    /** Consentement marketing explicite — voir mission §15. */
    consentText: longText.nullish(),
  }),

  REVIEWS: z.object({
    reviews: z
      .array(
        z.object({
          author: shortText.min(1),
          rating: z.number().int().min(1).max(5),
          body: longText.min(1),
        }),
      )
      .min(1)
      .max(20),
  }),

  LOCATION: z.object({
    address: longText.min(1),
    city: shortText.nullish(),
    country: shortText.nullish(),
    mapUrl: linkUrl.nullish(),
  }),

  PROMOTION: z.object({
    headline: shortText.min(1),
    description: longText.nullish(),
    code: z.string().trim().max(40).nullish(),
    /** ISO 8601. Le bloc disparaît de la page publique après cette date. */
    expiresAt: z.string().datetime().nullish(),
    ctaLabel: shortText.nullish(),
    ctaUrl: linkUrl.nullish(),
  }),
} as const satisfies Record<BlockType, z.ZodType>;

export type BlockConfigSchemas = typeof BLOCK_CONFIG_SCHEMAS;
export type BlockConfig<T extends BlockType> = z.infer<BlockConfigSchemas[T]>;

// ---------------------------------------------------------------------------
// Style commun à tous les blocs
// ---------------------------------------------------------------------------

export const blockStyleSchema = z.object({
  /** Laisse le thème décider quand c'est vide — cas par défaut. */
  variant: z.enum(["default", "outline", "ghost"]).nullish(),
  fullWidth: z.boolean().nullish(),
});

export type BlockStyle = z.infer<typeof blockStyleSchema>;

// ---------------------------------------------------------------------------
// Bloc résolu, prêt à rendre
// ---------------------------------------------------------------------------

export interface ResolvedBlock<T extends BlockType = BlockType> {
  id: string;
  type: T;
  position: number;
  title: string | null;
  config: BlockConfig<T>;
  style: BlockStyle;
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Valide la config d'un bloc contre le schéma de son type.
 *
 * Renvoie `null` plutôt que de lever : un seul bloc mal formé (import, bug
 * d'une version antérieure, édition manuelle en base) ne doit jamais faire
 * tomber la page publique d'un vendeur. L'appelant filtre les nulls.
 */
export function parseBlockConfig<T extends BlockType>(
  type: T,
  config: unknown,
): BlockConfig<T> | null {
  const schema = BLOCK_CONFIG_SCHEMAS[type] as z.ZodType;
  const result = schema.safeParse(config ?? {});
  if (!result.success) return null;
  return result.data as BlockConfig<T>;
}

/** Métadonnées d'affichage pour la bibliothèque de blocs du Page Builder. */
export interface BlockTypeMeta {
  type: BlockType;
  label: string;
  description: string;
  /** Faux tant que le rendu public et l'éditeur ne sont pas livrés. */
  available: boolean;
}

export const BLOCK_TYPE_META: Record<BlockType, BlockTypeMeta> = {
  LINK: {
    type: "LINK",
    label: "Lien",
    description: "Un bouton vers n'importe quelle adresse.",
    available: true,
  },
  PRODUCT: {
    type: "PRODUCT",
    label: "Produit",
    description: "Met un produit en avant sur ta page.",
    available: true,
  },
  PRODUCT_COLLECTION: {
    type: "PRODUCT_COLLECTION",
    label: "Collection",
    description: "Une sélection de produits, en grille ou en carrousel.",
    available: true,
  },
  WHATSAPP: {
    type: "WHATSAPP",
    label: "WhatsApp",
    description: "Un bouton qui ouvre une conversation pré-remplie.",
    available: true,
  },
  SOCIAL: {
    type: "SOCIAL",
    label: "Réseaux sociaux",
    description: "La rangée d'icônes vers tes réseaux.",
    available: true,
  },
  TEXT: {
    type: "TEXT",
    label: "Texte",
    description: "Une annonce, une précision, des horaires.",
    available: true,
  },
  IMAGE: {
    type: "IMAGE",
    label: "Image",
    description: "Une image, cliquable si tu veux.",
    available: true,
  },
  VIDEO: {
    type: "VIDEO",
    label: "Vidéo",
    description: "Une vidéo YouTube ou TikTok.",
    available: false,
  },
  GALLERY: {
    type: "GALLERY",
    label: "Galerie",
    description: "Plusieurs images côte à côte.",
    available: false,
  },
  SERVICE: {
    type: "SERVICE",
    label: "Service",
    description: "Une prestation avec son prix et sa durée.",
    available: false,
  },
  BOOKING: {
    type: "BOOKING",
    label: "Rendez-vous",
    description: "Un lien de réservation.",
    available: false,
  },
  PAYMENT: {
    type: "PAYMENT",
    label: "Paiement",
    description: "Encaisse un montant libre ou fixe.",
    available: false,
  },
  FORM: {
    type: "FORM",
    label: "Formulaire",
    description: "Collecte les coordonnées de tes prospects.",
    available: false,
  },
  REVIEWS: {
    type: "REVIEWS",
    label: "Avis",
    description: "Les retours de tes clients.",
    available: false,
  },
  LOCATION: {
    type: "LOCATION",
    label: "Adresse",
    description: "Où tu te trouves.",
    available: false,
  },
  PROMOTION: {
    type: "PROMOTION",
    label: "Promotion",
    description: "Une offre limitée dans le temps.",
    available: false,
  },
};
