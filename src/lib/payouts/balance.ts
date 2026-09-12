/**
 * Solde reversable d'une boutique, dérivé du registre comptable.
 *
 * `transaction_ledger` reçoit, à chaque encaissement confirmé, trois lignes
 * (brut, commission, net vendeur). Le net vendeur devient reversable après
 * un délai propre au prestataire ; un reversement exécuté écrit une ligne
 * `payout` négative. Entre la demande et l'exécution, la somme est réservée.
 */

import { OPEN_PAYOUT_STATUSES, availabilityDelayMs } from "./config";

export interface LedgerRow {
  type: string;
  amount: number;
  currency: string;
  provider: string | null;
  createdAt: Date;
}

export interface OpenPayoutRow {
  amount: number;
  currency: string;
  status: string;
}

export interface ShopBalance {
  currency: string;
  /** Reversable maintenant : net mûri − reversé − réservé. */
  available: number;
  /** Net vendeur encaissé mais encore dans le délai de sécurisation. */
  maturing: number;
  /** Demandes en attente de traitement par l'équipe. */
  reserved: number;
  /** Total déjà versé au vendeur. */
  paidOut: number;
  /** Date du plus ancien net vendeur pas encore couvert par un reversement. */
  oldestUnpaidAt: Date | null;
  /** Date à laquelle le prochain montant en sécurisation devient reversable. */
  nextMaturityAt: Date | null;
}

const roundCents = (value: number) => Math.round(value * 100) / 100;

export function computeBalance(
  rows: LedgerRow[],
  openPayouts: OpenPayoutRow[],
  currency: string,
  now: Date = new Date(),
): ShopBalance {
  const wanted = currency.toUpperCase();
  let matured = 0;
  let maturing = 0;
  let paidOut = 0;
  let oldestUnpaidAt: Date | null = null;
  let nextMaturityAt: Date | null = null;

  for (const row of rows) {
    if (row.currency.toUpperCase() !== wanted) continue;
    if (row.type === "seller_net") {
      const maturesAt = new Date(row.createdAt.getTime() + availabilityDelayMs(row.provider));
      if (maturesAt.getTime() <= now.getTime()) {
        matured += row.amount;
      } else {
        maturing += row.amount;
        if (!nextMaturityAt || maturesAt < nextMaturityAt) nextMaturityAt = maturesAt;
      }
      if (!oldestUnpaidAt || row.createdAt < oldestUnpaidAt) oldestUnpaidAt = row.createdAt;
    } else if (row.type === "payout") {
      paidOut += Math.abs(row.amount);
    }
  }

  const reserved = openPayouts
    .filter(
      (payout) =>
        payout.currency.toUpperCase() === wanted &&
        (OPEN_PAYOUT_STATUSES as readonly string[]).includes(payout.status),
    )
    .reduce((sum, payout) => sum + payout.amount, 0);

  const available = Math.max(0, roundCents(matured - paidOut - reserved));

  return {
    currency: wanted,
    available,
    maturing: roundCents(maturing),
    reserved: roundCents(reserved),
    paidOut: roundCents(paidOut),
    // Tout ce qui a été mûri et versé est couvert : la date « plus ancien
    // impayé » n'a de sens que s'il reste quelque chose à verser.
    oldestUnpaidAt: available > 0 || maturing > 0 ? oldestUnpaidAt : null,
    nextMaturityAt,
  };
}
