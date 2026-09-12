/**
 * Réconciliation des commandes Mobile Money.
 *
 * Le webhook Genius Pay est la voie normale, mais ce n'est pas une garantie :
 * lors du premier paiement réel en production, aucun webhook n'est arrivé et
 * la commande est restée « en attente » indéfiniment — vendeur jamais
 * prévenu, acheteur devant un écran d'échec alors qu'il avait payé.
 *
 * Un encaissement ne peut pas dépendre d'un seul canal. On interroge donc
 * Genius Pay nous-mêmes pour les commandes encore en attente, et on tranche :
 * confirmée (stock prélevé, vendeur et acheteur prévenus), échouée ou
 * abandonnée (commande annulée, code promo rendu), ou toujours en cours.
 * Depuis que le stock est prélevé au règlement, une commande en attente
 * n'immobilise rien : la réconciliation ne « libère » plus de stock, elle
 * met de l'ordre.
 *
 * Server-only — ne jamais importer depuis un Client Component.
 */


import { prisma } from "@/lib/prisma";
import { cancelUnpaidOrder, settlePaidOrder } from "@/lib/db/orders";
import {
  fetchPayment,
  isGeniusPayConfigured,
  mapStatusToPaymentStatus,
} from "@/lib/geniuspay";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

/**
 * On laisse d'abord sa chance au webhook : inutile d'appeler Genius Pay pour
 * une commande créée il y a dix secondes.
 */
const MIN_AGE_MS = 60_000;

/**
 * Au-delà, une commande que Genius Pay dit toujours « en attente » n'a plus
 * aucune chance d'aboutir : l'acheteur a fermé la page sans payer. On
 * l'annule pour qu'elle cesse d'encombrer le tableau de bord et rende son
 * code promo. Deux heures laissent à un acheteur le temps de recharger son
 * compte Mobile Money et de revenir payer.
 */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 10;

export interface ReconcileResult {
  checked: number;
  paid: number;
  failed: number;
  stillPending: number;
  errors: number;
}

interface PendingOrder {
  id: string;
  totalAmount: number;
  currency: string;
  paymentRef: string;
  createdAt: Date;
}

const EMPTY: ReconcileResult = {
  checked: 0,
  paid: 0,
  failed: 0,
  stillPending: 0,
  errors: 0,
};

/**
 * Interroge Genius Pay pour les commandes Mobile Money encore en attente et
 * les fait aboutir. Ne lève jamais : un échec de réconciliation ne doit pas
 * casser la page qui l'a déclenchée.
 */
export async function reconcilePendingGeniusPayOrders(
  opts: { shopId?: string; limit?: number } = {},
): Promise<ReconcileResult> {
  if (!isGeniusPayConfigured()) return EMPTY;

  const limit = opts.limit ?? DEFAULT_LIMIT;
  const cutoff = new Date(Date.now() - MIN_AGE_MS);

  let rows: Array<{
    id: string;
    totalAmount: unknown;
    currency: string;
    paymentRef: string | null;
    createdAt: Date;
  }>;
  try {
    rows = await prisma.order.findMany({
      where: {
        paymentProvider: "geniuspay",
        paymentStatus: "pending",
        paymentRef: { not: null },
        createdAt: { lt: cutoff },
        ...(opts.shopId ? { shopId: opts.shopId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        totalAmount: true,
        currency: true,
        paymentRef: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("[reconcile] read error:", error);
    return EMPTY;
  }

  if (rows.length === 0) return EMPTY;

  const orders: PendingOrder[] = rows
    .filter((row): row is typeof row & { paymentRef: string } => row.paymentRef !== null)
    .map((row) => ({
      id: row.id,
      totalAmount: Number(row.totalAmount),
      currency: row.currency,
      paymentRef: row.paymentRef,
      createdAt: row.createdAt,
    }));
  const result: ReconcileResult = { ...EMPTY };

  // Séquentiel : le lot est petit et Genius Pay applique un rate limit.
  for (const order of orders) {
    result.checked += 1;
    try {
      const outcome = await settleOrder(order);
      result[outcome] += 1;
    } catch (err) {
      result.errors += 1;
      console.error("[reconcile] order", order.id, err);
    }
  }

  return result;
}

/** Réconcilie une commande précise. Retourne l'issue. */
async function settleOrder(
  order: PendingOrder,
): Promise<"paid" | "failed" | "stillPending"> {
  const payment = await fetchPayment(order.paymentRef);
  const status = mapStatusToPaymentStatus(payment.status);

  if (status === "paid") {
    // Mêmes garde-fous que le webhook : on ne confirme jamais une commande
    // sur un paiement d'un autre montant ou d'une autre devise.
    const amountOk = payment.amount >= order.totalAmount;
    const currencyOk =
      payment.currency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn("[reconcile] amount/currency mismatch on order", order.id);
      return "stillPending";
    }

    // Même chemin que le webhook : verrou, fiche client, écritures
    // comptables, téléchargements. L'ancienne version se contentait de
    // passer la commande à « payée », sans commission ni fiche client — une
    // commande rattrapée ici n'apparaissait pas dans le registre financier.
    // `settlePaidOrder` est idempotent face au webhook qui arriverait au
    // même moment : un seul des deux écrit.
    const settlement = await settlePaidOrder(
      order.id,
      payment.reference ?? order.paymentRef,
      "geniuspay",
    );

    if (settlement.settled) {
      // Acheteur ET vendeur : une commande rattrapée ici est le cas où le
      // webhook a été manqué, donc où personne n'a encore reçu le lien de
      // suivi ni les téléchargements. `after()` est valide ici car la
      // réconciliation ne tourne que depuis une route ou une page serveur.
      scheduleAfterResponse(
        () => notifyPaidOrder(order.id),
        (err) => console.warn("[reconcile] notification failed", err),
      );
      console.info("[reconcile] order", order.id, "confirmed");
    }
    return "paid";
  }

  const isStale = Date.now() - order.createdAt.getTime() > STALE_AFTER_MS;

  if (status === "failed" || isStale) {
    // Annule et rend l'usage du code promo, une seule fois.
    await cancelUnpaidOrder(order.id, order.paymentRef, "geniuspay");

    console.info(
      "[reconcile] order",
      order.id,
      isStale && status !== "failed" ? "abandoned" : "failed",
    );
    return "failed";
  }

  return "stillPending";
}
