import "server-only";

import { prisma } from "@/lib/prisma";
import type { CurrencyCode } from "../../../prisma/generated/client/client";
import { loadBalance } from "./balance-db";
import { OPEN_PAYOUT_STATUSES, minimumPayout, type PayoutProvider } from "./config";

/**
 * Cycle de vie d'une demande de reversement.
 *
 * Tout passe sous verrou de la ligne `shops` (demande) ou `payouts`
 * (traitement) : deux clics simultanés ne créent pas deux demandes, et un
 * reversement n'est marqué versé qu'une fois — c'est ce qui écrit la ligne
 * comptable `payout`, donc ce qui fait baisser le solde.
 */

export interface PayoutDestination {
  provider: PayoutProvider;
  accountName: string;
  accountIdentifier: string;
  country: string | null;
  /** Le compte avait-il déjà reçu un versement au moment de la demande ? */
  isVerified?: boolean;
  /** Dernière modification du compte, pour repérer un changement récent. */
  accountUpdatedAt?: string;
}

export type RequestPayoutResult =
  | { ok: true; payoutId: string; amount: number; currency: string }
  | {
      ok: false;
      reason: "shop_not_found" | "no_account" | "already_open" | "below_minimum";
      available?: number;
      minimum?: number;
      currency?: string;
    };

export async function requestPayout(shopId: string): Promise<RequestPayoutResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; currency: string }>>`
      select id, currency::text as currency from public.shops where id = ${shopId}::uuid for update
    `;
    const shop = locked[0];
    if (!shop) return { ok: false, reason: "shop_not_found" } as const;

    const account = await tx.payoutAccount.findUnique({ where: { shopId } });
    if (!account) return { ok: false, reason: "no_account" } as const;

    const open = await tx.payout.count({
      where: { shopId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
    });
    if (open > 0) return { ok: false, reason: "already_open", currency: shop.currency } as const;

    const balance = await loadBalance(shopId, shop.currency, tx);
    const minimum = minimumPayout(shop.currency);
    if (balance.available < minimum) {
      return {
        ok: false,
        reason: "below_minimum",
        available: balance.available,
        minimum,
        currency: shop.currency,
      } as const;
    }

    const destination: PayoutDestination = {
      provider: account.provider as PayoutProvider,
      accountName: account.accountName,
      accountIdentifier: account.accountIdentifier,
      country: account.country,
      isVerified: account.isVerified,
      accountUpdatedAt: account.updatedAt.toISOString(),
    };

    // La période couverte commence là où le dernier versement s'arrêtait.
    const lastPaid = await tx.payout.findFirst({
      where: { shopId, status: "paid" },
      orderBy: { paidAt: "desc" },
      select: { periodEnd: true, paidAt: true },
    });

    const payout = await tx.payout.create({
      data: {
        shopId,
        amount: balance.available,
        currency: shop.currency as CurrencyCode,
        status: "requested",
        provider: account.provider,
        destination: { ...destination },
        periodStart: lastPaid?.periodEnd ?? lastPaid?.paidAt ?? balance.oldestUnpaidAt,
        periodEnd: new Date(),
      },
      select: { id: true },
    });

    return {
      ok: true,
      payoutId: payout.id,
      amount: balance.available,
      currency: shop.currency,
    } as const;
  });
}

export type SettlePayoutResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_settled" | "reference_taken" | "not_paid" };

/** Violation de la contrainte unique Prisma (deux références identiques en concurrence). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * L'équipe a exécuté le transfert : on enregistre la référence, la date, et
 * la ligne comptable négative qui solde le net vendeur.
 */
export async function markPayoutPaid(
  payoutId: string,
  input: { reference: string; note?: string | null },
): Promise<SettlePayoutResult> {
  try {
    return await markPayoutPaidInTransaction(payoutId, input);
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "reference_taken" } as const;
    throw error;
  }
}

async function markPayoutPaidInTransaction(
  payoutId: string,
  input: { reference: string; note?: string | null },
): Promise<SettlePayoutResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.payouts where id = ${payoutId}::uuid for update
    `;
    if (locked.length === 0) return { ok: false, reason: "not_found" } as const;

    const payout = await tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (!(OPEN_PAYOUT_STATUSES as readonly string[]).includes(payout.status)) {
      return { ok: false, reason: "already_settled" } as const;
    }

    const duplicate = await tx.payout.findFirst({
      where: { reference: input.reference, id: { not: payoutId } },
      select: { id: true },
    });
    if (duplicate) return { ok: false, reason: "reference_taken" } as const;

    const paidAt = new Date();
    await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: "paid",
        reference: input.reference,
        note: input.note ?? null,
        paidAt,
      },
    });

    // Le compte a reçu l'argent : il est vérifié, tant qu'il n'est pas modifié.
    const destination = payout.destination as { accountIdentifier?: string } | null;
    if (destination?.accountIdentifier) {
      await tx.payoutAccount.updateMany({
        where: {
          shopId: payout.shopId,
          provider: payout.provider,
          accountIdentifier: destination.accountIdentifier,
        },
        data: { isVerified: true },
      });
    }

    await tx.transactionLedger.create({
      data: {
        shopId: payout.shopId,
        orderId: null,
        type: "payout",
        amount: -Number(payout.amount),
        currency: payout.currency,
        provider: payout.provider,
        reference: input.reference,
        metadata: { payoutId },
      },
    });

    return { ok: true } as const;
  });
}

/** Refus motivé : la somme redevient disponible pour une prochaine demande. */
export async function markPayoutFailed(
  payoutId: string,
  input: { note: string },
): Promise<SettlePayoutResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.payouts where id = ${payoutId}::uuid for update
    `;
    if (locked.length === 0) return { ok: false, reason: "not_found" } as const;

    const payout = await tx.payout.findUniqueOrThrow({
      where: { id: payoutId },
      select: { status: true },
    });
    if (!(OPEN_PAYOUT_STATUSES as readonly string[]).includes(payout.status)) {
      return { ok: false, reason: "already_settled" } as const;
    }

    await tx.payout.update({
      where: { id: payoutId },
      data: { status: "failed", note: input.note },
    });

    return { ok: true } as const;
  });
}

/**
 * L'opérateur a rejeté le transfert après coup (numéro inactif, plafond) et
 * recrédité Bio-Lien : la ligne comptable est contre-passée par une ligne
 * `payout` positive, la demande passe en « bounced » et la somme redevient
 * disponible. Le compte repasse non vérifié.
 */
export async function markPayoutBounced(
  payoutId: string,
  input: { note: string },
): Promise<SettlePayoutResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.payouts where id = ${payoutId}::uuid for update
    `;
    if (locked.length === 0) return { ok: false, reason: "not_found" } as const;

    const payout = await tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.status !== "paid") return { ok: false, reason: "not_paid" } as const;

    await tx.payout.update({
      where: { id: payoutId },
      data: { status: "bounced", note: input.note },
    });

    await tx.transactionLedger.create({
      data: {
        shopId: payout.shopId,
        orderId: null,
        type: "payout",
        amount: Number(payout.amount),
        currency: payout.currency,
        provider: payout.provider,
        reference: payout.reference ? `${payout.reference}:rejet` : null,
        metadata: { payoutId, reversalOf: payout.reference ?? null },
      },
    });

    const destination = payout.destination as { accountIdentifier?: string } | null;
    if (destination?.accountIdentifier) {
      await tx.payoutAccount.updateMany({
        where: {
          shopId: payout.shopId,
          provider: payout.provider,
          accountIdentifier: destination.accountIdentifier,
        },
        data: { isVerified: false },
      });
    }

    return { ok: true } as const;
  });
}

/** Prise en charge par l'équipe (« je m'en occupe ») : purement informatif. */
export async function markPayoutProcessing(payoutId: string): Promise<SettlePayoutResult> {
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: "requested" },
    data: { status: "processing" },
  });
  if (updated.count === 0) {
    const exists = await prisma.payout.findUnique({ where: { id: payoutId }, select: { id: true } });
    return { ok: false, reason: exists ? "already_settled" : "not_found" } as const;
  }
  return { ok: true } as const;
}
