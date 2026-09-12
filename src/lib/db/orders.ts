import "server-only";

import { prisma } from "@/lib/prisma";
import { claimStock, type StockShortfall } from "@/lib/db/stock";
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
      /** Null pour une commande sans e-mail (WhatsApp). */
      customerId: string | null;
      commission: number;
      plan: "free" | "starter" | "pro";
      /** Articles que le stock ne couvrait plus au moment du paiement. */
      stockShortfall: StockShortfall[];
      /** Réglée hors plateforme : rien au registre, pas de reversement. */
      offline: boolean;
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

    // Le stock n'est prélevé qu'ici, l'argent encaissé : une commande en
    // attente n'immobilise plus rien. Une commande créée avant ce
    // changement (stock déjà réservé au passage en caisse) ne l'est pas
    // deux fois.
    const stockShortfall =
      order.stockReservedAt === null ? await claimStock(tx, order.items) : [];

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
        paymentRef,
        paymentProvider,
        stockReservedAt: order.stockReservedAt ?? new Date(),
        stockShortfall: stockShortfall.length
          ? (stockShortfall as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });

    // Fiche client : créée au premier achat, enrichie ensuite. Le SQL utilisait
    // least()/greatest() pour que l'ordre d'arrivée des webhooks ne fausse pas
    // les bornes ; ici on recalcule explicitement. Une commande WhatsApp n'a
    // pas d'e-mail : pas de fiche tant que le vendeur ne le renseigne pas.
    const email = order.buyerEmail?.trim().toLowerCase() || null;
    const existing = email
      ? await tx.customer.findUnique({
          where: { shopId_email: { shopId: order.shopId, email } },
          select: {
            id: true,
            phone: true,
            firstOrderAt: true,
            lastOrderAt: true,
          },
        })
      : null;

    let customerId: string | null;
    if (!email) {
      customerId = null;
    } else if (existing) {
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
        // L'acheteur n° 2 du dernier exemplaire ne doit pas attendre un colis
        // qui ne partira peut-être pas : on le prévient sans dévoiler le stock.
        publicMessage: stockShortfall.length
          ? "Paiement reçu. Le vendeur vérifie la disponibilité de l'article et te contacte rapidement."
          : "Paiement confirmé. La commande est transmise au vendeur.",
        note: stockShortfall.length
          ? `Stock insuffisant au moment du paiement : ${stockShortfall
              .map((item) => `${item.product_name ?? item.product_id} (${item.taken}/${item.requested})`)
              .join(", ")}`
          : null,
      },
    });

    // Une commande réglée hors plateforme (WhatsApp, espèces, Mobile Money
    // direct au vendeur) : Bio-Lien n'a touché aucun argent, donc ni
    // commission ni net à reverser — rien au registre.
    if (paymentProvider === "manual") {
      const undeliveredOffline = new Set(
        stockShortfall.filter((item) => item.taken === 0).map((item) => item.product_id),
      );
      await createDigitalDownloads(tx, order.id, order.items, undeliveredOffline);
      return {
        settled: true,
        customerId,
        commission: 0,
        plan: "free",
        stockShortfall,
        offline: true,
      } as const;
    }

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

    // Un fichier numérique en édition limitée n'est pas délivré à l'acheteur
    // qui n'a rien obtenu : le vendeur tranche (livrer quand même ou
    // rembourser).
    const undelivered = new Set(
      stockShortfall.filter((item) => item.taken === 0).map((item) => item.product_id),
    );
    await createDigitalDownloads(tx, order.id, order.items, undelivered);

    return { settled: true, customerId, commission: fee, plan, stockShortfall, offline: false } as const;
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
  skipProductIds: ReadonlySet<string> = new Set(),
): Promise<void> {
  if (!Array.isArray(items)) return;

  const expiresAt = new Date(
    Date.now() + DOWNLOAD_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );

  for (const item of items) {
    const productId = readString(item, "product_id");
    if (!productId || skipProductIds.has(productId)) continue;

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

    // Seules les commandes qui avaient réservé leur stock au passage en
    // caisse (avant le prélèvement au règlement) ont quelque chose à rendre.
    if (order.stockReservedAt !== null) {
      await restoreStock(tx, order.items);
    }

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
        // Rendu : plus rien de prélevé.
        stockReservedAt: null,
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
  shortfall: Prisma.JsonValue | null = null,
): Promise<void> {
  if (!Array.isArray(items)) return;

  // Ce qui n'avait pas pu être prélevé (manque au règlement) n'est pas rendu.
  const missing = new Map<string, number>();
  if (Array.isArray(shortfall)) {
    for (const entry of shortfall) {
      const key = readString(entry, "variant_id") ?? readString(entry, "product_id");
      const requested = readInt(entry, "requested") ?? 0;
      const taken = readInt(entry, "taken") ?? 0;
      if (key) missing.set(key, Math.max(0, requested - taken));
    }
  }

  // Ordre stable (même clé que le prélèvement) : pas d'interblocage entre
  // deux restitutions ou une restitution et un règlement.
  const lines = [...items]
    .map((item) => ({
      productId: readString(item, "product_id"),
      variantId: readString(item, "variant_id"),
      quantity: Math.max(readInt(item, "quantity") ?? 0, 0),
    }))
    .sort((a, b) => (a.variantId ?? a.productId ?? "").localeCompare(b.variantId ?? b.productId ?? ""));

  for (const { productId, variantId, quantity: ordered } of lines) {
    if (!productId) continue;
    const quantity = ordered - (missing.get(variantId ?? productId) ?? 0);
    if (quantity <= 0) continue;

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
    if (
      status === "cancelled" &&
      (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded")
    ) {
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

// ---------------------------------------------------------------------------
// Remboursements et litiges : contre-passation du net vendeur
// ---------------------------------------------------------------------------

/** Types de lignes comptables qui corrigent le net vendeur après coup. */
export const LEDGER_ADJUSTMENT_TYPES = ["refund", "chargeback", "chargeback_reversal"] as const;
export type LedgerAdjustmentType = (typeof LEDGER_ADJUSTMENT_TYPES)[number];

export type RefundResult =
  | { recorded: true; clawback: number; refundedTotal: number; full: boolean }
  | { recorded: false; reason: "not_found" | "not_paid" | "already_recorded" | "nothing_to_refund" };

/**
 * Enregistre un remboursement (ou un litige carte) sur une commande payée :
 * la part du net vendeur correspondante est contre-passée dans le registre,
 * de sorte que le solde reversable redescende. Sans cela, la plateforme
 * rembourse l'acheteur ET verse le vendeur.
 *
 * `amount` est le montant rendu à l'acheteur pour CE remboursement (ou le
 * montant contesté) ; avec `cumulative: true`, c'est le total remboursé à
 * ce jour tel que le prestataire le rapporte (Stripe `amount_refunded`), et
 * seule la différence avec ce qui est déjà enregistré est contre-passée.
 * Idempotent sur (commande, type, référence).
 */
export async function recordOrderRefund(
  orderId: string,
  input: {
    amount: number;
    reference: string;
    provider: PaymentProvider;
    kind?: "refund" | "chargeback";
    cumulative?: boolean;
    publicMessage?: string;
  },
): Promise<RefundResult> {
  const kind = input.kind ?? "refund";
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.orders where id = ${orderId}::uuid for update
    `;
    if (locked.length === 0) return { recorded: false, reason: "not_found" } as const;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        shopId: true,
        totalAmount: true,
        currency: true,
        paymentStatus: true,
        items: true,
        stockReservedAt: true,
        stockShortfall: true,
      },
    });
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
      return { recorded: false, reason: "not_paid" } as const;
    }

    const rows = await tx.transactionLedger.findMany({
      where: { orderId, type: { in: ["seller_net", "refund", "chargeback", "chargeback_reversal"] } },
      select: { type: true, amount: true, reference: true, metadata: true },
    });

    if (rows.some((row) => row.type === kind && row.reference === input.reference)) {
      return { recorded: false, reason: "already_recorded" } as const;
    }

    const sellerNet = rows
      .filter((row) => row.type === "seller_net")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const alreadyClawedBack = rows
      .filter((row) => row.type !== "seller_net")
      .reduce((sum, row) => sum - Number(row.amount), 0);
    const alreadyRefunded = rows
      .filter((row) => row.type === "refund")
      .reduce((sum, row) => {
        const meta = row.metadata as { refundedAmount?: unknown } | null;
        return sum + (typeof meta?.refundedAmount === "number" ? meta.refundedAmount : 0);
      }, 0);

    const total = Number(order.totalAmount);
    const increment = input.cumulative ? input.amount - alreadyRefunded : input.amount;
    if (increment <= 0) return { recorded: false, reason: "nothing_to_refund" } as const;

    // Part du net vendeur proportionnelle au montant rendu, bornée par ce
    // qui reste à contre-passer.
    const share = total > 0 ? Math.min(1, increment / total) : 1;
    const clawback = Math.max(
      0,
      Math.min(roundToCents(sellerNet * share), roundToCents(sellerNet - alreadyClawedBack)),
    );

    await tx.transactionLedger.create({
      data: {
        shopId: order.shopId,
        orderId,
        type: kind,
        amount: -clawback,
        currency: order.currency,
        provider: input.provider,
        reference: input.reference,
        metadata: { refundedAmount: increment, kind },
      },
    });

    if (kind === "refund") {
      const refundedTotal = roundToCents(alreadyRefunded + increment);
      const full = refundedTotal >= total;
      // Remboursement intégral : la marchandise ne part pas, le stock prélevé
      // au règlement (hors manque) revient en vente.
      if (full && order.stockReservedAt !== null) {
        await restoreStock(tx, order.items, order.stockShortfall);
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: full ? "refunded" : "partially_refunded",
          ...(full ? { status: "refunded", stockReservedAt: null } : {}),
        },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status: full ? "refunded" : "confirmed",
          publicMessage:
            input.publicMessage ??
            (full ? "Commande remboursée." : "Remboursement partiel enregistré."),
        },
      });
      return { recorded: true, clawback, refundedTotal, full } as const;
    }

    return { recorded: true, clawback, refundedTotal: alreadyRefunded, full: false } as const;
  });
}

/**
 * Litige carte gagné : la retenue `chargeback` est annulée par une ligne
 * inverse. Idempotent sur la référence du litige.
 */
export async function reverseChargeback(
  orderId: string,
  input: { reference: string; provider: PaymentProvider },
): Promise<{ recorded: boolean; amount: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.orders where id = ${orderId}::uuid for update
    `;
    if (locked.length === 0) return { recorded: false, amount: 0 };

    const rows = await tx.transactionLedger.findMany({
      where: { orderId, type: { in: ["chargeback", "chargeback_reversal"] }, reference: input.reference },
      select: { type: true, amount: true, shopId: true, currency: true },
    });
    const held = rows.find((row) => row.type === "chargeback");
    if (!held || rows.some((row) => row.type === "chargeback_reversal")) {
      return { recorded: false, amount: 0 };
    }

    const amount = Math.abs(Number(held.amount));
    await tx.transactionLedger.create({
      data: {
        shopId: held.shopId,
        orderId,
        type: "chargeback_reversal",
        amount,
        currency: held.currency,
        provider: input.provider,
        reference: input.reference,
        metadata: { kind: "chargeback_reversal" },
      },
    });
    return { recorded: true, amount };
  });
}
