/**
 * Comment joindre l'équipe Bio-Lien — un seul endroit.
 *
 * Une vendeuse coincée à l'étape du paiement n'écrit pas un e-mail : elle
 * ouvre WhatsApp. Quand `NEXT_PUBLIC_SUPPORT_WHATSAPP` est posé (numéro au
 * format international, ex. +2267012…), les liens de support ouvrent une
 * conversation pré-remplie ; sinon ils retombent sur l'adresse e-mail.
 */
export const SUPPORT_EMAIL = "support@bio-lien.com";

export function supportWhatsAppNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/[^\d]/g, "") ?? "";
  return raw.length >= 8 ? raw : null;
}

/** Le lien à mettre sur « Écrire au support » : WhatsApp si possible, e-mail sinon. */
export function supportHref(subject: string, body?: string): string {
  const number = supportWhatsAppNumber();
  if (number) {
    const text = body ? `${subject}\n${body}` : subject;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }
  const query = new URLSearchParams({ subject, ...(body ? { body } : {}) });
  return `mailto:${SUPPORT_EMAIL}?${query.toString().replace(/\+/g, "%20")}`;
}

/** Le libellé qui va avec le lien. */
export function supportLabel(): string {
  return supportWhatsAppNumber() ? "Écrire au support sur WhatsApp" : "Écrire au support";
}
