/**
 * Commande WhatsApp enregistrée.
 *
 * En mode WhatsApp (le mode par défaut des vendeurs), le bouton « Commander
 * sur WhatsApp » ouvrait une conversation avec un message pré-rempli… et
 * rien d'autre : pas de commande dans le tableau de bord, pas de stock
 * engagé, pas de suivi pour l'acheteur, pas de fiche client. Le vendeur
 * gérait tout de mémoire.
 *
 * Désormais la commande est créée AVANT d'ouvrir WhatsApp, réglée « hors
 * plateforme » (`paymentProvider: manual`) : elle apparaît chez le vendeur,
 * engage le stock 30 minutes comme toute commande en attente, porte une
 * référence courte reprise dans le message, et un lien de suivi pour
 * l'acheteur. Le vendeur la marque payée quand il a reçu l'argent (espèces,
 * Mobile Money direct…) : le stock est alors prélevé, sans commission ni
 * reversement puisque Bio-Lien n'a pas touché l'argent.
 *
 * Ce module n'a pas de dépendance serveur : il sert aussi au bouton côté
 * client pour construire le repli sans enregistrement.
 */

export interface WhatsAppOrderLine {
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
}

/** Référence lisible reprise dans le message : 6 premiers hexas de l'UUID. */
export function orderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function formatWhatsAppOrderMessage(args: {
  shopName: string;
  lines: WhatsAppOrderLine[];
  totalLabel: string;
  reference: string;
  trackingUrl: string;
  formatPrice: (amount: number) => string;
}): string {
  const items = args.lines.map((line) => {
    const name = line.variant_name ? `${line.product_name} (${line.variant_name})` : line.product_name;
    const qty = line.quantity > 1 ? ` × ${line.quantity}` : "";
    return `• ${name}${qty} — ${args.formatPrice(line.unit_price * line.quantity)}`;
  });
  return [
    `Bonjour ${args.shopName} 👋`,
    "Je commande :",
    ...items,
    `Total : ${args.totalLabel}`,
    "",
    `Commande #${args.reference}`,
    `Suivi : ${args.trackingUrl}`,
  ].join("\n");
}

export function whatsAppUrl(digits: string, message: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
