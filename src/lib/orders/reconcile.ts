/**
 * Réconciliation des commandes Mobile Money.
 *
 * Le webhook Genius Pay est la voie normale, mais ce n'est pas une garantie :
 * lors du premier paiement réel en production, aucun webhook n'est arrivé et
 * la commande est restée « en attente » indéfiniment — stock réservé, vendeur
 * jamais prévenu, acheteur devant un écran d'échec alors qu'il avait payé.
 *
 * Un encaissement ne peut pas dépendre d'un seul canal. On interroge donc
 * Genius Pay nous-mêmes pour les commandes encore en attente, et on tranche :
 * confirmée, échouée (on rend le stock), ou toujours en cours.
 *
 * Server-only — ne jamais importer depuis un Client Component.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import {
  fetchPayment,
  isGeniusPayConfigured,
  mapStatusToPaymentStatus,
} from "@/lib/geniuspay";
import { notifySellerOfPaidOrder } from "@/lib/order-notifications";
import type { OrderItem } from "@/lib/types/database";

/**
 * On laisse d'abord sa chance au webhook : inutile d'appeler Genius Pay pour
 * une commande créée il y a dix secondes.
 */
const MIN_AGE_MS = 60_000;

/**
 * Au-delà, une commande que Genius Pay dit toujours « en attente » n'a plus
 * aucune chance d'aboutir : l'acheteur a fermé la page sans payer. On rend le
 * stock, sinon un panier abandonné immobilise l'article pour toujours.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

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
  total_amount: number;
  currency: string;
  payment_ref: string | null;
  items: OrderItem[] | null;
  created_at: string;
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
  const admin = getAdminClient();
  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();

  let query = admin
    .from("orders")
    .select("id, total_amount, currency, payment_ref, items, created_at")
    .eq("payment_provider", "geniuspay")
    .eq("payment_status", "pending")
    .not("payment_ref", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.shopId) query = query.eq("shop_id", opts.shopId);

  const { data, error } = await query;

  if (error || !data?.length) {
    if (error) console.error("[reconcile] read error:", error);
    return EMPTY;
  }

  const orders = data as unknown as PendingOrder[];
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
  const admin = getAdminClient();
  const payment = await fetchPayment(order.payment_ref as string);
  const status = mapStatusToPaymentStatus(payment.status);

  if (status === "paid") {
    // Mêmes garde-fous que le webhook : on ne confirme jamais une commande
    // sur un paiement d'un autre montant ou d'une autre devise.
    const amountOk = payment.amount >= order.total_amount;
    const currencyOk =
      payment.currency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn("[reconcile] amount/currency mismatch on order", order.id);
      return "stillPending";
    }

    // `eq("payment_status", "pending")` rend l'opération idempotente face au
    // webhook qui arriverait au même moment : un seul des deux écrit.
    const { data: updated, error } = await admin
      .from("orders")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select("id");

    if (error) throw error;

    if (updated?.length) {
      notifySellerOfPaidOrder(order.id).catch((err) =>
        console.warn("[reconcile] notify seller failed", err),
      );
      console.info("[reconcile] order", order.id, "confirmed");
    }
    return "paid";
  }

  const isStale = Date.now() - new Date(order.created_at).getTime() > STALE_AFTER_MS;

  if (status === "failed" || isStale) {
    await releaseStock(order);

    const { error } = await admin
      .from("orders")
      .update({ payment_status: "failed", status: "cancelled" })
      .eq("id", order.id)
      .eq("payment_status", "pending");

    if (error) throw error;

    console.info(
      "[reconcile] order",
      order.id,
      isStale && status !== "failed" ? "abandoned" : "failed",
    );
    return "failed";
  }

  return "stillPending";
}

/** Rend au stock ce que la commande avait réservé. */
async function releaseStock(order: PendingOrder) {
  const items = order.items;
  if (!items?.length) return;

  const { error } = await getAdminClient().rpc("release_stock", {
    items: items.map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      quantity: it.quantity,
    })),
  });

  if (error) console.error("[reconcile] release_stock error:", error);
}
