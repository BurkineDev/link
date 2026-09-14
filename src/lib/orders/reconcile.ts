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
import { ops } from "@/lib/ops/events";

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
  if (!isGeniusPayConfigured()) {
    // Une variable GENIUSPAY_* perdue : plus aucun rattrapage, et un
    // résultat vide indiscernable d'une nuit calme — d'où l'alerte.
    if (process.env.NODE_ENV === "production") {
      ops.critical({
        kind: "reconcile.not_configured",
        title: "Réconciliation Genius Pay désactivée : configuration absente",
        detail: "GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET ou GENIUSPAY_WEBHOOK_SECRET manque : les commandes Mobile Money au webhook perdu ne seront plus rattrapées.",
        dedupeKey: "reconcile.not_configured",
      });
    }
    return EMPTY;
  }

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
    // Une panne de base n'est pas « rien à faire » (constat A18).
    ops.critical({
      kind: "reconcile.db_error",
      title: "Réconciliation : lecture des commandes impossible",
      detail: `La base n'a pas répondu (${error instanceof Error ? error.message.split("\n")[0]!.slice(0, 160) : String(error)}). Aucune commande Mobile Money n'a été rattrapée à ce passage.`,
      context: { shopId: opts.shopId ?? null, limit },
      dedupeKey: "reconcile.db_error",
    });
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
  const failures: Array<{ orderId: string; error: string }> = [];
  for (const order of orders) {
    result.checked += 1;
    try {
      const outcome = await settleOrder(order);
      result[outcome] += 1;
    } catch (err) {
      result.errors += 1;
      console.error("[reconcile] order", order.id, err);
      failures.push({
        orderId: order.id,
        error: err instanceof Error ? err.message.split("\n")[0]!.slice(0, 120) : String(err).slice(0, 120),
      });
    }
  }

  if (failures.length > 0) {
    // Tout le lot en erreur = Genius Pay injoignable ou clés invalides ;
    // quelques-unes = à regarder au rapport du matin.
    const allFailed = failures.length === result.checked;
    ops[allFailed ? "critical" : "warning"]({
      kind: "reconcile.provider_errors",
      title: allFailed
        ? `Réconciliation : Genius Pay en erreur sur ${failures.length} commande(s) sur ${result.checked}`
        : `Réconciliation : ${failures.length} commande(s) en erreur sur ${result.checked}`,
      detail: allFailed
        ? "Aucune commande n'a pu être vérifiée : Genius Pay injoignable, clés invalides ou compte suspendu. Les commandes en attente ne bougent pas."
        : "Ces commandes n'ont pas pu être vérifiées ; elles seront réessayées au prochain passage.",
      context: { checked: result.checked, errors: failures.length, sample: failures.slice(0, 5) },
      dedupeKey: "reconcile.provider_errors",
    });
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
      ops.critical({
        kind: "reconcile.amount_mismatch",
        title: "Paiement Genius Pay d'un montant inattendu (réconciliation)",
        detail: `Genius Pay confirme ${payment.amount} ${payment.currency} pour une commande de ${order.totalAmount} ${order.currency}. Elle restera en attente à chaque passage tant que personne n'a tranché : régler ou rembourser à la main.`,
        context: { orderId: order.id, reference: order.paymentRef, received: payment.amount, receivedCurrency: payment.currency, expected: order.totalAmount, expectedCurrency: order.currency },
        dedupeKey: `webhook.amount_mismatch:${order.id}`,
      });
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
