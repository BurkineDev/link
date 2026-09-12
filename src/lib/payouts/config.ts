/**
 * Reversements vendeur : constantes partagées entre le serveur et l'écran.
 *
 * Genius Pay n'a pas encore d'API de décaissement (page « Payouts API —
 * bientôt disponible », septembre 2026) et Stripe Connect n'existe pas pour
 * les vendeurs d'Afrique de l'Ouest. Le reversement est donc **manuel mais
 * tracé** : le vendeur enregistre son compte, voit son solde, demande le
 * versement ; l'équipe Bio-Lien exécute le transfert (Wave, Orange Money…)
 * et le marque versé avec sa référence, ce qui écrit la ligne comptable.
 * Le jour où une API de décaissement existe, seule l'étape « exécuter »
 * change.
 */

export const PAYOUT_PROVIDERS = [
  "wave",
  "orange_money",
  "mtn_money",
  "moov_money",
  "bank",
] as const;
export type PayoutProvider = (typeof PAYOUT_PROVIDERS)[number];

export const PAYOUT_PROVIDER_LABELS: Record<PayoutProvider, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  moov_money: "Moov Money",
  bank: "Virement bancaire",
};

/** Fournisseurs dont l'identifiant est un numéro de téléphone (E.164). */
export const PHONE_PAYOUT_PROVIDERS: readonly PayoutProvider[] = [
  "wave",
  "orange_money",
  "mtn_money",
  "moov_money",
];

export function isPhonePayoutProvider(provider: string): boolean {
  return (PHONE_PAYOUT_PROVIDERS as readonly string[]).includes(provider);
}

/** requested → processing → paid | failed ; paid → bounced si l'opérateur rejette le transfert */
export const PAYOUT_STATUSES = ["requested", "processing", "paid", "failed", "bounced"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Demandes qui immobilisent le solde tant que l'équipe n'a pas tranché. */
export const OPEN_PAYOUT_STATUSES: readonly PayoutStatus[] = ["requested", "processing"];

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  requested: "Demandé",
  processing: "En cours",
  paid: "Versé",
  failed: "Refusé",
  bounced: "Transfert rejeté",
};

/**
 * Montant minimum d'un reversement, par devise : en dessous, les frais de
 * transfert mangent la somme.
 */
export const MINIMUM_PAYOUT: Record<string, number> = {
  XOF: 5_000,
  XAF: 5_000,
  GHS: 50,
  NGN: 5_000,
  KES: 500,
  MAD: 50,
  USD: 10,
};

export function minimumPayout(currency: string): number {
  return MINIMUM_PAYOUT[currency.toUpperCase()] ?? 10;
}

/**
 * Délai avant qu'un encaissement devienne reversable, par prestataire.
 * Stripe verse la plateforme à J+7 et laisse une fenêtre de litige ; Mobile
 * Money n'a pas de rétrofacturation, on garde deux jours pour les erreurs de
 * commande. Un prestataire inconnu prend le délai le plus long.
 */
export const AVAILABILITY_DELAY_DAYS: Record<string, number> = {
  geniuspay: 2,
  stripe: 7,
};

export function availabilityDelayMs(provider: string | null | undefined): number {
  const days = provider ? (AVAILABILITY_DELAY_DAYS[provider] ?? 7) : 7;
  return days * 24 * 60 * 60 * 1000;
}
