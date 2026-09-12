/**
 * Solde reversable d'une boutique, dérivé du registre comptable.
 *
 * `transaction_ledger` reçoit, à chaque encaissement confirmé, trois lignes
 * (brut, commission, net vendeur). Le net vendeur devient reversable après
 * un délai propre au prestataire. Un remboursement ou un litige écrit une
 * ligne négative rattachée à la même commande (`refund`, `chargeback`, et
 * `chargeback_reversal` positive si le litige est gagné). Un reversement
 * exécuté écrit une ligne `payout` négative ; un transfert rejeté par
 * l'opérateur, une ligne `payout` positive qui l'annule. Entre la demande et
 * l'exécution, la somme est réservée.
 */

import { OPEN_PAYOUT_STATUSES, availabilityDelayMs } from "./config";

/** Types de lignes lus pour le solde. */
export const BALANCE_LEDGER_TYPES = [
  "seller_net",
  "payout",
  "refund",
  "chargeback",
  "chargeback_reversal",
] as const;

export interface LedgerRow {
  type: string;
  amount: number;
  currency: string;
  provider: string | null;
  createdAt: Date;
  orderId?: string | null;
}

export interface OpenPayoutRow {
  amount: number;
  currency: string;
  status: string;
}

export interface ShopBalance {
  currency: string;
  /** Reversable maintenant : net mûri, corrigé des remboursements − versé − réservé. */
  available: number;
  /** Net vendeur encaissé mais encore dans le délai de sécurisation. */
  maturing: number;
  /** Demandes en attente de traitement par l'équipe. */
  reserved: number;
  /** Total effectivement versé au vendeur (transferts rejetés déduits). */
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
  const inCurrency = rows.filter((row) => row.currency.toUpperCase() === wanted);

  // Une commande dont le net n'est pas encore mûri : ses corrections
  // s'imputent sur « en sécurisation », pas sur le disponible.
  const unmaturedOrders = new Set<string>();
  let matured = 0;
  let maturing = 0;
  let paidOut = 0;
  let oldestUnpaidAt: Date | null = null;
  let nextMaturityAt: Date | null = null;

  for (const row of inCurrency) {
    if (row.type !== "seller_net") continue;
    const maturesAt = new Date(row.createdAt.getTime() + availabilityDelayMs(row.provider));
    if (maturesAt.getTime() <= now.getTime()) {
      matured += row.amount;
    } else {
      maturing += row.amount;
      if (row.orderId) unmaturedOrders.add(row.orderId);
      if (!nextMaturityAt || maturesAt < nextMaturityAt) nextMaturityAt = maturesAt;
    }
    if (!oldestUnpaidAt || row.createdAt < oldestUnpaidAt) oldestUnpaidAt = row.createdAt;
  }

  for (const row of inCurrency) {
    if (row.type === "payout") {
      // Ligne négative = versé ; ligne positive = transfert rejeté, annulé.
      paidOut -= row.amount;
    } else if (
      row.type === "refund" ||
      row.type === "chargeback" ||
      row.type === "chargeback_reversal"
    ) {
      if (row.orderId && unmaturedOrders.has(row.orderId)) maturing += row.amount;
      else matured += row.amount;
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
  const maturingRounded = Math.max(0, roundCents(maturing));

  return {
    currency: wanted,
    available,
    maturing: maturingRounded,
    reserved: roundCents(reserved),
    paidOut: roundCents(paidOut),
    // Tout ce qui a été mûri et versé est couvert : la date « plus ancien
    // impayé » n'a de sens que s'il reste quelque chose à verser.
    oldestUnpaidAt: available > 0 || maturingRounded > 0 ? oldestUnpaidAt : null,
    nextMaturityAt,
  };
}
