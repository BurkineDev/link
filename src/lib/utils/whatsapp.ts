/**
 * WhatsApp URL helpers for the "WhatsApp checkout" mode.
 *
 * Shops in `checkout_mode = 'whatsapp'` send buyers to wa.me with a
 * pre-filled message that contains the product name, price and the
 * shop URL — so the seller can confirm + take payment offline.
 */

import { formatPrice } from "@/lib/utils/format";
import type { Currency } from "@/lib/types/database";

/** Strip everything except digits — wa.me wants a digits-only phone number. */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

export function isValidWhatsAppNumber(raw: string | null | undefined): boolean {
  const digits = normalizeWhatsAppNumber(raw);
  // ITU-T E.164: country code + subscriber number, between 8 and 15 digits.
  return digits.length >= 8 && digits.length <= 15;
}

interface BuildOptions {
  whatsappNumber: string | null | undefined;
  shopName: string;
  productName?: string;
  price?: number;
  currency?: Currency;
  variantLabel?: string;
  quantity?: number;
  shopUrl?: string;
}

/**
 * Builds a wa.me link with a pre-filled message. Returns null if the shop
 * doesn't have a usable WhatsApp number — the caller should hide the CTA.
 */
export function buildWhatsAppOrderUrl({
  whatsappNumber,
  shopName,
  productName,
  price,
  currency,
  variantLabel,
  quantity,
  shopUrl,
}: BuildOptions): string | null {
  if (!isValidWhatsAppNumber(whatsappNumber)) return null;

  const digits = normalizeWhatsAppNumber(whatsappNumber);

  const lines: string[] = [`Bonjour ${shopName} 👋`];

  if (productName) {
    let line = `Je suis intéressé(e) par : ${productName}`;
    if (variantLabel) line += ` (${variantLabel})`;
    if (quantity && quantity > 1) line += ` × ${quantity}`;
    lines.push(line);

    if (price !== undefined && currency) {
      const total = price * (quantity ?? 1);
      lines.push(`Prix : ${formatPrice(total, currency)}`);
    }
  } else {
    lines.push(`J'ai des questions sur ta boutique.`);
  }

  if (shopUrl) lines.push(`\nBoutique : ${shopUrl}`);

  const message = lines.join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
