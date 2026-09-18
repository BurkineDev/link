/**
 * Shared formatting utilities for LinkBoutik shop pages.
 */

import type { Currency } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Price formatting
// ---------------------------------------------------------------------------

/**
 * Espace insécable ordinaire : entre les milliers et avant le symbole
 * (« 12 500 FCFA »). Pas l'espace fine U+202F du français typographique :
 * elle fait 2,6 px en Ojuju 17 px (« 12 500 » se lisait « 12500 » sur la
 * pastille de prix) et manque à la Geist des stories, que satori complétait
 * alors par trois requêtes Google Fonts au premier rendu.
 */
const NBSP = "\u00A0";

const CURRENCY_FORMAT: Record<
  Currency,
  { locale: string; symbol: string; position: "before" | "after"; decimals: number; separator?: string }
> = {
  XOF: { locale: "fr-FR", symbol: "FCFA", position: "after", decimals: 0, separator: NBSP },
  XAF: { locale: "fr-FR", symbol: "FCFA", position: "after", decimals: 0, separator: NBSP },
  GHS: { locale: "en-GH", symbol: "GH₵", position: "before", decimals: 2 },
  NGN: { locale: "en-NG", symbol: "₦", position: "before", decimals: 2 },
  KES: { locale: "en-KE", symbol: "KSh", position: "before", decimals: 2 },
  MAD: { locale: "fr-MA", symbol: "DH", position: "after", decimals: 2, separator: NBSP },
  USD: { locale: "en-US", symbol: "$", position: "before", decimals: 2 },
};

/**
 * Formats a price amount with the correct currency symbol and locale.
 *
 * Le prix FCFA est un objet typographique : « 12 500 FCFA », insécable
 * ordinaire entre les milliers comme avant le symbole, jamais de décimales,
 * jamais « XOF » — c'est ce qu'une acheteuse lit en plein soleil.
 *
 * @example
 * formatPrice(5000, "XOF") // "5 000 FCFA"
 * formatPrice(2500, "NGN") // "₦2,500.00"
 * formatPrice(9.99, "USD") // "$9.99"
 */
export function formatPrice(amount: number, currency: Currency | string): string {
  const fmt = CURRENCY_FORMAT[currency as Currency];

  if (!fmt) {
    // Fallback: just show the number and currency code
    return `${amount.toLocaleString()} ${currency}`;
  }

  let formatted = amount.toLocaleString(fmt.locale, {
    minimumFractionDigits: fmt.decimals,
    maximumFractionDigits: fmt.decimals,
  });

  // Les moteurs ICU ne s'accordent pas sur l'espace des milliers en français
  // (U+202F sur Node et Chrome récents, U+00A0 sur d'anciens WebView) : on
  // impose l'insécable ordinaire pour que le même prix s'écrive partout pareil.
  if (fmt.locale.startsWith("fr")) {
    formatted = formatted.replace(/[\u00A0\u202F ]/g, NBSP);
  }

  if (fmt.position === "before") {
    return `${fmt.symbol}${formatted}`;
  }

  return `${formatted}${fmt.separator ?? ""}${fmt.symbol}`;
}

/**
 * Sépare le montant de son symbole quand celui-ci suit le nombre après une
 * insécable (« 12 500 FCFA » → « 12 500 » + « FCFA ») pour que la pastille
 * de prix écrive les chiffres en police d'affiche et le symbole en petit.
 * Un prix dont le symbole précède le nombre (« ₦2,500.00 ») reste d'un seul
 * tenant. Une seule implémentation pour la carte, la fiche et la story.
 */
export function splitPriceSymbol(
  formatted: string,
): { amount: string; symbol?: string } {
  const match = /^(.+)\u00A0([A-Za-z]+)$/.exec(formatted);
  return match ? { amount: match[1], symbol: match[2] } : { amount: formatted };
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Formats a date string or Date object with the given locale.
 *
 * @example
 * formatDate("2024-01-15T10:30:00Z")       // "15 janvier 2024"
 * formatDate(new Date(), "en-US")           // "January 15, 2024"
 */
export function formatDate(
  date: string | Date,
  locale = "fr-FR",
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, options);
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/**
 * Converts a string to a URL-safe slug.
 * Handles French accents and special characters.
 *
 * @example
 * slugify("Robe Élégante Été") // "robe-elegante-ete"
 * slugify("T-shirt & Jeans")   // "t-shirt-jeans"
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // keep only alphanumeric, space, hyphen
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Order ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable order ID.
 *
 * @example
 * generateOrderId() // "LBK-2024-A3F9"
 */
export function generateOrderId(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `LBK-${year}-${random}`;
}
