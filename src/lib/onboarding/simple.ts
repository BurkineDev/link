/**
 * Ce que l'assistant de démarrage déduit à la place de la vendeuse — la
 * partie pure, testable sans DOM.
 *
 * Trois questions suffisent (nom de la boutique, numéro WhatsApp, premier
 * produit) parce que tout le reste se déduit : l'adresse du nom, la devise
 * du pays du numéro, l'identifiant du profil de l'adresse, l'adresse du
 * produit de son nom, et les messages de partage du lien.
 */

import { iso2FromE164 } from "@/lib/phone/dial-codes";
import { slugify } from "@/lib/utils/format";

/** « Awa Couture » → « awa-couture » ; jamais vide au-delà de deux lettres tapées. */
export function shopSlugFromName(name: string): string {
  return slugify(name).replace(/-+$/, "").slice(0, 50);
}

/**
 * Le profil demande un identifiant (3-30, minuscules, chiffres, - et _) :
 * c'est l'adresse de la page, coupée à la bonne longueur. Rien à demander.
 */
export function usernameForShop(slug: string): string {
  const base = slug.replace(/[^a-z0-9_-]/g, "").slice(0, 30).replace(/-+$/, "");
  return base.length >= 3 ? base : `${base}-shop`.replace(/^-/, "").slice(0, 30);
}

const XOF = new Set(["CI", "BF", "SN", "ML", "TG", "BJ", "NE", "GW"]);
const XAF = new Set(["CM", "GA", "CG", "TD", "CF", "GQ"]);
const BY_COUNTRY: Record<string, string> = { GH: "GHS", NG: "NGN", KE: "KES", MA: "MAD" };

/**
 * La devise des prix, d'après le pays du numéro WhatsApp. Sans numéro (ou
 * pays inconnu du barème), le FCFA de l'UEMOA : c'est le marché de départ.
 */
export function currencyForWhatsAppNumber(number: string | null | undefined): string {
  const iso2 = iso2FromE164(number);
  if (!iso2) return "XOF";
  if (XOF.has(iso2)) return "XOF";
  if (XAF.has(iso2)) return "XAF";
  return BY_COUNTRY[iso2] ?? "USD";
}

/** L'adresse d'un produit, dérivée de son nom, dans les bornes du schéma. */
export function productSlugFor(name: string): string {
  const slug = slugify(name).replace(/-+$/, "").slice(0, 120);
  return slug.length >= 2 ? slug : `produit-${slug}`.slice(0, 120);
}

/** Les textes de partage du lien : WhatsApp d'abord, c'est là que tout se passe. */
export function shareTexts(url: string, shopName: string): { whatsapp: string; message: string } {
  const name = shopName.trim();
  const message = name
    ? `Bonjour ! Voici la page de ${name} : ${url} — tu choisis, tu m'écris, je te réponds.`
    : `Voici ma page : ${url}`;
  return { message, whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}` };
}
