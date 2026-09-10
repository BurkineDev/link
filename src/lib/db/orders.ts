import "server-only";

import { prisma } from "@/lib/prisma";
import {
  Prisma,
  type PaymentProvider,
} from "../../../prisma/generated/client/client";

/**
 * Port de la fonction Postgres `public.settle_paid_order`.
 *
 * Cette fonction est le cœur financier de Bio-Lien : elle marque la commande
 * payée, met à jour la fiche client, écrit les trois écritures comptables
 * (brut, commission plateforme, net vendeur) et débloque les produits
 * numériques. Tout cela doit rester atomique et idempotent — un webhook de
 * paiement est rejoué sans prévenir.
 *
 * Deux garanties de la version SQL sont reproduites telles quelles :
 *   • le verrou `SELECT ... FOR UPDATE` sur la commande, qui empêche deux
 *     webhooks simultanés de créditer deux fois le même paiement ;
 *   • les contrôles d'état avant écriture, qui rendent l'appel rejouable.
 * Prisma n'exposant pas `FOR UPDATE`, le verrou passe par du SQL brut à
 * l'intérieur de la transaction.
 */

export type SettleResult =
  | { settled: false; reason: "not_found" | "already_paid" | "not_pending" }
  | {
      settled: true;
      customerId: string;
      commission: number;
      plan: "free" | "starter" | "pro";
    };

/** Taux de commission par plan, identique au `case` de la fonction SQL. */
const COMMISSION_RATES = { free: 0.05, starter: 0.03, pro: 0 } as const;

const DOWNLOAD_VALIDITY_DAYS = 30;
const DEFAULT_DOWNLOAD_LIMIT = 5;

export async function settlePaidOrder(
  orderId: string,
  paymentRef: string,
  paymentProvider: PaymentProvider,
): Promise<SettleResult> {
  return prisma.$transaction(async (tx) => {
    // Verrou de ligne : les webhooks concurrents attendent ici.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.orders where id = ${orderId}::uuid for update
    `;
    if (locked.length === 0) {
      return { settled: false, reason: "not_found" } as const;
    }

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (order.paymentStatus === "paid") {
      return { settled: false, reason: "already_paid" } as const;
    }
    if (order.paymentStatus !== "pending") {
      return { settled: false, reason: "not_pending" } as const;
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
        paymentRef,
        paymentProvider,
      },
    });

    // Fiche client : créée au premier achat, enrichie ensuite. Le SQL utilisait
    // least()/greatest() pour que l'ordre d'arrivée des webhooks ne fausse pas
    // les bornes ; ici on recalcule explicitement.
    const email = order.buyerEmail.toLowerCase();
    const existing = await tx.customer.findUnique({
      where: { shopId_email: { shopId: order.shopId, email } },
      select: {
        id: true,
        phone: true,
        firstOrderAt: true,
        lastOrderAt: true,
      },
    });

    let customerId: string;
    if (existing) {
      const updated = await tx.customer.update({
        where: { id: existing.id },
        data: {
          name: order.buyerName,
          phone: order.buyerPhone ?? existing.phone,
          firstOrderAt: minDate(existing.firstOrderAt, order.createdAt),
          lastOrderAt: maxDate(existing.lastOrderAt, order.createdAt),
          orderCount: { increment: 1 },
          totalSpent: { increment: order.totalAmount },
        },
        select: { id: true },
      });
      customerId = updated.id;
    } else {
      const created = await tx.customer.create({
        data: {
          shopId: order.shopId,
          email,
          name: order.buyerName,
          phone: order.buyerPhone,
          firstOrderAt: order.createdAt,
          lastOrderAt: order.createdAt,
          orderCount: 1,
          totalSpent: order.totalAmount,
          currency: order.currency,
        },
        select: { id: true },
      });
      customerId = created.id;
    }

    await tx.order.update({
      where: { id: order.id },
      data: { customerId },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: "confirmed",
        publicMessage:
          "Paiement confirmé. La commande est transmise au vendeur.",
      },
    });

    // Plan du vendeur au moment de l'encaissement. Un abonnement Mobile Money
    // ne compte que s'il n'est pas expiré — d'où le contrôle sur la période.
    const shop = await tx.shop.findUniqueOrThrow({
      where: { id: order.shopId },
      select: {
        owner: {
          select: {
            subscriptions: {
              where: { status: { in: ["active", "trialing"] } },
              select: {
                plan: true,
                provider: true,
                currentPeriodEnd: true,
              },
            },
          },
        },
      },
    });

    const active = shop.owner.subscriptions.find(
      (sub) =>
        sub.provider === "stripe" ||
        (sub.currentPeriodEnd !== null && sub.currentPeriodEnd > new Date()),
    );
    const plan = active?.plan ?? "free";
    const rate = COMMISSION_RATES[plan];
    const fee = roundToCents(order.totalAmount.toNumber() * rate);

    await tx.transactionLedger.createMany({
      data: [
        {
          shopId: order.shopId,
          orderId: order.id,
          type: "gross",
          amount: order.totalAmount,
          currency: order.currency,
          provider: paymentProvider,
          reference: paymentRef,
        },
        {
          shopId: order.shopId,
          orderId: order.id,
          type: "platform_fee",
          amount: new Prisma.Decimal(-fee),
          currency: order.currency,
          provider: paymentProvider,
          reference: paymentRef,
        },
        {
          shopId: order.shopId,
          orderId: order.id,
          type: "seller_net",
          amount: order.totalAmount.minus(fee),
          currency: order.currency,
          provider: paymentProvider,
          reference: paymentRef,
        },
      ],
    });

    await createDigitalDownloads(tx, order.id, order.items);

    return { settled: true, customerId, commission: fee, plan } as const;
  });
}

/**
 * Débloque un lien de téléchargement par produit numérique de la commande.
 * La clé du fichier vit dans `metadata.download_key` (R2) ou, pour les
 * produits créés avant le stockage privé, `metadata.download_url`.
 */
async function createDigitalDownloads(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: Prisma.JsonValue,
): Promise<void> {
  if (!Array.isArray(items)) return;

  const expiresAt = new Date(
    Date.now() + DOWNLOAD_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );

  for (const item of items) {
    const productId = readString(item, "product_id");
    if (!productId) continue;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, isDigital: true, metadata: true },
    });
    if (!product?.isDigital) continue;

    const fileKey =
      readString(product.metadata, "download_key") ??
      readString(product.metadata, "download_url");
    if (!fileKey) continue;

    const orderItem = await tx.orderItem.findFirst({
      where: { orderId, productId: product.id },
      select: { id: true },
    });

    await tx.digitalDownload.create({
      data: {
        orderId,
        orderItemId: orderItem?.id ?? null,
        productId: product.id,
        fileKey,
        fileName: readString(product.metadata, "file_name") ?? product.name,
        downloadLimit:
          readInt(product.metadata, "download_limit") ?? DEFAULT_DOWNLOAD_LIMIT,
        expiresAt,
      },
    });
  }
}

function readString(source: unknown, key: string): string | null {
  if (typeof source !== "object" || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readInt(source: unknown, key: string): number | null {
  if (typeof source !== "object" || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function minDate(a: Date | null, b: Date): Date {
  return a === null || b < a ? b : a;
}

function maxDate(a: Date | null, b: Date): Date {
  return a === null || b > a ? b : a;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Port de `public.cancel_unpaid_order`.
 *
 * Annule une commande restée impayée et restitue ce qui avait été réservé :
 * le stock (produit ou variante) et l'usage du code promo. Le verrou et le
 * contrôle `payment_status = 'pending'` garantissent que la restitution
 * n'a lieu qu'une fois, même si l'expiration du paiement et le webhook
 * d'échec arrivent ensemble.
 */
export type CancelResult =
  | { cancelled: false; reason: "not_found" | "already_settled" }
  | { cancelled: true };

export async function cancelUnpaidOrder(
  orderId: string,
  paymentRef?: string | null,
  paymentProvider?: PaymentProvider | null,
): Promise<CancelResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.orders where id = ${orderId}::uuid for update
    `;
    if (locked.length === 0) {
      return { cancelled: false, reason: "not_found" } as const;
    }

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (order.paymentStatus !== "pending") {
      return { cancelled: false, reason: "already_settled" } as const;
    }

    await restoreStock(tx, order.items);

    if (order.promoCode !== null) {
      // `greatest(uses_count - 1, 0)` côté SQL : on ne descend jamais sous zéro.
      await tx.promoCode.updateMany({
        where: {
          shopId: order.shopId,
          code: order.promoCode,
          usesCount: { gt: 0 },
        },
        data: { usesCount: { decrement: 1 } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "cancelled",
        paymentStatus: "failed",
        paymentRef: paymentRef ?? order.paymentRef,
        paymentProvider: paymentProvider ?? order.paymentProvider,
      },
    });

    return { cancelled: true } as const;
  });
}

/**
 * Rend au stock les quantités d'une commande. Les lignes dont le stock n'est
 * pas suivi (`stock_quantity` nul) sont ignorées, comme dans le SQL d'origine
 * où le `where ... and stock_quantity is not null` filtrait la mise à jour.
 */
async function restoreStock(
  tx: Prisma.TransactionClient,
  items: Prisma.JsonValue,
): Promise<void> {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const productId = readString(item, "product_id");
    const variantId = readString(item, "variant_id");
    const quantity = Math.max(readInt(item, "quantity") ?? 0, 0);

    if (quantity === 0 || !productId) continue;

    if (variantId) {
      await tx.productVariant.updateMany({
        where: { id: variantId, productId, stockQuantity: { not: null } },
        data: { stockQuantity: { increment: quantity } },
      });
    } else {
      await tx.product.updateMany({
        where: { id: productId, stockQuantity: { not: null } },
        data: { stockQuantity: { increment: quantity } },
      });
    }
  }
}

/**
 * Port de `public.transition_order_status` : la machine d'états des commandes.
 *
 * Seules les transitions listées dans `ALLOWED_TRANSITIONS` sont acceptées,
 * chaque changement laisse une trace horodatée dans `order_status_events`,
 * et une commande déjà payée ne peut pas être annulée sans passer par un
 * remboursement chez le prestataire — sinon l'argent encaissé et le statut
 * divergeraient.
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered"],
};

export type TransitionResult =
  | {
      updated: false;
      reason:
        | "not_found"
        | "forbidden"
        | "unchanged"
        | "paid_order_requires_refund";
    }
  | { updated: false; reason: "invalid_transition"; from: OrderStatus; to: OrderStatus }
  | { updated: true; status: OrderStatus };

export async function transitionOrderStatus(input: {
  orderId: string;
  status: OrderStatus;
  actorId: string;
  note?: string | null;
  publicMessage?: string | null;
}): Promise<TransitionResult> {
  const { orderId, status, actorId } = input;

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.orders where id = ${orderId}::uuid for update
    `;
    if (locked.length === 0) {
      return { updated: false, reason: "not_found" } as const;
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        shop: { select: { ownerId: true } },
      },
    });

    if (order.shop.ownerId !== actorId) {
      return { updated: false, reason: "forbidden" } as const;
    }
    if (order.status === status) {
      return { updated: false, reason: "unchanged" } as const;
    }
    if (!ALLOWED_TRANSITIONS[order.status]?.includes(status)) {
      return {
        updated: false,
        reason: "invalid_transition",
        from: order.status,
        to: status,
      } as const;
    }
    if (status === "cancelled" && order.paymentStatus === "paid") {
      return { updated: false, reason: "paid_order_requires_refund" } as const;
    }

    await tx.order.update({ where: { id: order.id }, data: { status } });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status,
        note: emptyToNull(input.note),
        publicMessage: emptyToNull(input.publicMessage),
        createdBy: actorId,
      },
    });

    return { updated: true, status } as const;
  });
}

/** `nullif(trim(x), '')` côté SQL : une note vide n'est pas une note. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
