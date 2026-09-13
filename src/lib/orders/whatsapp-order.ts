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
 * porte une référence courte reprise dans le message, et un lien de suivi
 * pour l'acheteur. Le vendeur la marque payée quand il a reçu l'argent
 * (espèces, Mobile Money direct…) : le stock est alors prélevé, sans
 * commission ni reversement puisque Bio-Lien n'a pas touché l'argent.
 *
 * Tant qu'elle n'est pas payée, elle n'engage PAS le stock : n'importe qui
 * peut taper le bouton sans jamais envoyer le message, et une réservation
 * douce permettrait à deux curieux de bloquer toute la boutique pendant
 * trente minutes. C'est le vendeur qui tranche dans la conversation, comme
 * il l'a toujours fait ; s'il manque des pièces au moment de marquer payé,
 * le manque lui est signalé. Une commande jamais payée expire au bout de
 * sept jours (voir `expire-manual.ts`).
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

/**
 * Référence lisible reprise dans le message : les 8 premiers caractères de
 * l'UUID, en majuscules — la même que celle affichée au vendeur (tableau de
 * bord), à l'acheteur (page de suivi, e-mails) et sur la page de succès.
 */
export function orderReference(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
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
