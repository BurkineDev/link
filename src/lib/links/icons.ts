/**
 * Vocabulaire d'icônes d'un lien.
 *
 * Séparé du composant qui les dessine : la détection de plateforme n'a pas
 * besoin de React ni de lucide-react, et l'importer depuis le composant
 * ferait entrer tout cela dans du code serveur et dans les tests.
 */

export const LINK_ICON_VALUES = [
  "custom",
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "whatsapp",
  "telegram",
  "email",
  "phone",
  "website",
  "shop",
] as const;

export type LinkIconValue = (typeof LINK_ICON_VALUES)[number];
