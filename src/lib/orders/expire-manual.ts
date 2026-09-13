import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Expiration des commandes WhatsApp jamais payées.
 *
 * Une commande WhatsApp naît d'un tap anonyme, avant même que le message
 * soit envoyé. Beaucoup ne le seront jamais : l'acheteur ferme WhatsApp,
 * change d'avis, ou n'était qu'un curieux. Sans ménage, ces lignes
 * « Client WhatsApp » s'accumulent en « En attente » chez le vendeur, qui
 * ne peut les annuler qu'une par une.
 *
 * Sept jours sans que le vendeur ait marqué la commande payée, et elle
 * expire : annulée, avec un mot sur la page de suivi. Une conversation
 * WhatsApp qui aboutit met rarement plus d'un ou deux jours ; si l'argent
 * arrive après, l'acheteur repasse commande — une commande annulée ne
 * ressuscite pas (voir la route mark-paid).
 *
 * Server-only — appelé par le cron quotidien.
 */

export const MANUAL_ORDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 200;

export interface ExpireResult {
  expired: number;
  errors: number;
}

const PUBLIC_MESSAGE =
  "Commande expirée : le vendeur n'a pas confirmé de paiement sous 7 jours. Repasse commande si tu es toujours intéressé.";

export async function expireStaleManualOrders(
  opts: { now?: Date; limit?: number } = {},
): Promise<ExpireResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - MANUAL_ORDER_TTL_MS);

  let rows: Array<{ id: string }>;
  try {
    rows = await prisma.order.findMany({
      where: {
        paymentProvider: "manual",
        paymentStatus: "pending",
        status: "pending",
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? DEFAULT_LIMIT,
      select: { id: true },
    });
  } catch (error) {
    console.error("[expire-manual] read error:", error);
    return { expired: 0, errors: 1 };
  }

  let expired = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const done = await prisma.$transaction(async (tx) => {
        // Conditionnel : une commande marquée payée entre la lecture et
        // l'écriture est laissée en paix.
        const { count } = await tx.order.updateMany({
          where: { id: row.id, paymentProvider: "manual", paymentStatus: "pending", status: "pending" },
          data: { status: "cancelled", paymentStatus: "failed" },
        });
        if (count === 0) return false;
        await tx.orderStatusEvent.create({
          data: {
            orderId: row.id,
            status: "cancelled",
            note: "Expirée : aucun paiement confirmé sous 7 jours.",
            publicMessage: PUBLIC_MESSAGE,
          },
        });
        return true;
      });
      if (done) expired += 1;
    } catch (error) {
      errors += 1;
      console.error(`[expire-manual] order ${row.id}:`, error);
    }
  }

  return { expired, errors };
}
