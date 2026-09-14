import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Expiration des commandes hors ligne jamais confirmées.
 *
 * Une commande WhatsApp naît d'un tap anonyme, avant même que le message
 * soit envoyé. Beaucoup ne le seront jamais : l'acheteur ferme WhatsApp,
 * change d'avis, ou n'était qu'un curieux. Une commande à régler à la
 * livraison naît de même, sans un franc versé, et attend que le vendeur la
 * confirme. Sans ménage, ces lignes s'accumulent en « En attente » chez le
 * vendeur, qui ne peut les annuler qu'une par une.
 *
 * Sept jours sans que le vendeur ait marqué la commande payée (WhatsApp)
 * ou confirmée (livraison), et elle expire : annulée, code promo rendu, avec
 * un mot sur la page de suivi. Si l'argent arrive après, l'acheteur repasse
 * commande — une commande annulée ne ressuscite pas (voir mark-paid).
 *
 * Server-only — appelé par le cron quotidien.
 */

export const MANUAL_ORDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 200;

export interface ExpireResult {
  expired: number;
  errors: number;
}

const OFFLINE_PROVIDERS = ["manual", "cash_on_delivery"] as const;

const PUBLIC_MESSAGE =
  "Commande expirée : le vendeur ne l'a pas confirmée sous 7 jours. Repasse commande si tu es toujours intéressé.";

export async function expireStaleManualOrders(
  opts: { now?: Date; limit?: number } = {},
): Promise<ExpireResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - MANUAL_ORDER_TTL_MS);

  let rows: Array<{ id: string; shopId: string; promoCode: string | null }>;
  try {
    rows = await prisma.order.findMany({
      where: {
        paymentProvider: { in: [...OFFLINE_PROVIDERS] },
        paymentStatus: "pending",
        status: "pending",
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? DEFAULT_LIMIT,
      select: { id: true, shopId: true, promoCode: true },
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
          where: {
            id: row.id,
            paymentProvider: { in: [...OFFLINE_PROVIDERS] },
            paymentStatus: "pending",
            status: "pending",
          },
          data: { status: "cancelled", paymentStatus: "failed" },
        });
        if (count === 0) return false;
        // Le code promo consommé à la caisse redevient utilisable
        // (`greatest(uses_count - 1, 0)` : jamais sous zéro).
        if (row.promoCode !== null) {
          await tx.promoCode.updateMany({
            where: { shopId: row.shopId, code: row.promoCode, usesCount: { gt: 0 } },
            data: { usesCount: { decrement: 1 } },
          });
        }
        await tx.orderStatusEvent.create({
          data: {
            orderId: row.id,
            status: "cancelled",
            note: "Expirée : ni paiement ni confirmation sous 7 jours.",
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
