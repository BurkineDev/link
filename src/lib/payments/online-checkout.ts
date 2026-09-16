/**
 * Mode « En ligne » — la caisse Bio-Lien (Mobile Money, carte, paiement à la
 * livraison, commission, grand livre, reversements) — masqué depuis le
 * 14 septembre 2026.
 *
 * Décision fondateur : Bio-Lien est la vitrine dans le lien de la bio. La
 * commande part sur WhatsApp et le paiement se règle entre le vendeur et
 * l'acheteur ; Bio-Lien ne touche pas l'argent des ventes. Son revenu, c'est
 * l'abonnement du vendeur (Stripe en CAD, Genius Pay prépayé en XOF) et les
 * boosts — ces flux ne lisent JAMAIS ce drapeau.
 *
 * `NEXT_PUBLIC_ONLINE_CHECKOUT=1` rallume la caisse pour tout le monde
 * (redéploiement requis : la valeur est figée dans les bundles client au
 * build). Absente ou vide : masquée. Le code reste en place, les colonnes et
 * les commandes historiques aussi — aucune migration dans un sens ni dans
 * l'autre.
 *
 * Lecture littérale (`process.env.NEXT_PUBLIC_ONLINE_CHECKOUT`, jamais par
 * un accès dynamique, sinon l'inlining Next laisse la valeur vide côté
 * client) et paresseuse (jamais en constante de module : les tests posent
 * la variable dans un `beforeEach`, après l'import).
 */

export type CheckoutMode = "whatsapp" | "online";

export function isOnlineCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ONLINE_CHECKOUT === "1";
}

/**
 * Le mode qui s'applique vraiment à une boutique : « online » seulement si
 * le drapeau est allumé ET que la boutique l'a choisi. La valeur en base est
 * conservée telle quelle (réversibilité), c'est la lecture qui tranche.
 */
export function effectiveCheckoutMode(stored: string | null | undefined): CheckoutMode {
  return isOnlineCheckoutEnabled() && stored === "online" ? "online" : "whatsapp";
}
