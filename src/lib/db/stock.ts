import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client/client";

/**
 * Stock : vérification au passage en caisse, prélèvement au règlement.
 *
 * Longtemps, le stock était décrémenté au passage en caisse, avant tout
 * paiement : n'importe qui pouvait créer des commandes fantômes et bloquer
 * tout le stock d'un vendeur pendant des heures. Désormais :
 *
 *   - `checkStockAvailability` : au checkout, lecture seule — on refuse un
 *     panier impossible, on ne réserve rien ;
 *   - `claimStock` : au règlement (`settlePaidOrder`), sous verrou de
 *     ligne, on prélève ce qui existe. L'argent est déjà encaissé : si deux
 *     acheteurs ont payé le dernier exemplaire, on prélève ce qu'on peut et
 *     on signale le manque au vendeur (`stock_shortfall`) au lieu de
 *     refuser un paiement reçu.
 *
 * Un `stock_quantity` nul signifie « stock non suivi » : la ligne est
 * validée (le produit doit exister) mais jamais décrémentée.
 *
 * `reserveStock` (décrément immédiat) reste disponible pour les tests et
 * d'éventuels scripts ; le checkout ne l'appelle plus.
 */

export interface StockItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export type ReserveStockResult =
  | { ok: true }
  | { ok: false; reason: "invalid_items" }
  | { ok: false; reason: "invalid_quantity"; product_id: string }
  | { ok: false; reason: "product_not_found"; product_id: string }
  | { ok: false; reason: "variant_not_found"; variant_id: string }
  | {
      ok: false;
      reason: "insufficient_stock";
      product_id: string;
      variant_id?: string;
      product_name: string | null;
      available: number;
      requested: number;
    };

/**
 * Signal interne : lever cette erreur à l'intérieur de la transaction force
 * Prisma à tout annuler, puis on la rattrape pour renvoyer le résultat.
 *
 * C'est une différence voulue avec la fonction SQL : celle-ci faisait
 * `return` au premier article en défaut, mais les décrémentations déjà
 * effectuées sur les articles précédents restaient acquises — le checkout
 * n'appelait pas `release_stock` dans ce cas, donc ce stock fuyait. Ici, un
 * panier refusé ne touche à rien.
 */
class ReservationRefused extends Error {
  constructor(readonly result: Exclude<ReserveStockResult, { ok: true }>) {
    super(`reserve_stock refused: ${result.reason}`);
  }
}

export async function reserveStock(
  items: unknown,
): Promise<ReserveStockResult> {
  if (!Array.isArray(items)) {
    return { ok: false, reason: "invalid_items" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const raw of items) {
        const productId = readString(raw, "product_id");
        const variantId = readString(raw, "variant_id");
        const quantity = readInt(raw, "quantity") ?? 0;

        if (quantity <= 0) {
          throw new ReservationRefused({
            ok: false,
            reason: "invalid_quantity",
            product_id: productId ?? "",
          });
        }

        if (variantId) {
          await reserveVariant(tx, productId ?? "", variantId, quantity);
        } else {
          await reserveProduct(tx, productId ?? "", quantity);
        }
      }
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ReservationRefused) return error.result;
    throw error;
  }
}

async function reserveVariant(
  tx: Prisma.TransactionClient,
  productId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ stock_quantity: number | null }>
  >`
    select stock_quantity from public.product_variants
     where id = ${variantId}::uuid for update
  `;
  const variant = rows[0];
  if (!variant) {
    throw new ReservationRefused({
      ok: false,
      reason: "variant_not_found",
      variant_id: variantId,
    });
  }

  if (variant.stock_quantity === null) return;

  if (variant.stock_quantity < quantity) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    throw new ReservationRefused({
      ok: false,
      reason: "insufficient_stock",
      product_id: productId,
      variant_id: variantId,
      product_name: product?.name ?? null,
      available: variant.stock_quantity,
      requested: quantity,
    });
  }

  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { decrement: quantity } },
  });
}

async function reserveProduct(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ stock_quantity: number | null; name: string }>
  >`
    select stock_quantity, name from public.products
     where id = ${productId}::uuid for update
  `;
  const product = rows[0];
  if (!product) {
    throw new ReservationRefused({
      ok: false,
      reason: "product_not_found",
      product_id: productId,
    });
  }

  if (product.stock_quantity === null) return;

  if (product.stock_quantity < quantity) {
    throw new ReservationRefused({
      ok: false,
      reason: "insufficient_stock",
      product_id: productId,
      product_name: product.name,
      available: product.stock_quantity,
      requested: quantity,
    });
  }

  await tx.product.update({
    where: { id: productId },
    data: { stockQuantity: { decrement: quantity } },
  });
}

/** Une ligne de panier normalisée ; clé stable = variante sinon produit. */
interface StockLine {
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

function stockKey(line: { product_id: string; variant_id: string | null }): string {
  return line.variant_id ?? line.product_id;
}

/**
 * Normalise un panier : lignes invalides signalées, mêmes articles cumulés
 * (deux lignes sur le même article valent une), et tri par clé stable —
 * deux règlements qui verrouillent les mêmes articles le font dans le
 * même ordre, donc jamais en interblocage.
 */
function normalizeLines(
  items: unknown,
): { ok: true; lines: StockLine[] } | { ok: false; result: Exclude<ReserveStockResult, { ok: true }> } {
  if (!Array.isArray(items)) return { ok: false, result: { ok: false, reason: "invalid_items" } };
  const byKey = new Map<string, StockLine>();
  for (const raw of items) {
    const productId = readString(raw, "product_id");
    const variantId = readString(raw, "variant_id");
    const quantity = readInt(raw, "quantity") ?? 0;
    if (quantity <= 0 || !productId) {
      return { ok: false, result: { ok: false, reason: "invalid_quantity", product_id: productId ?? "" } };
    }
    const line: StockLine = { product_id: productId, variant_id: variantId, quantity };
    const existing = byKey.get(stockKey(line));
    if (existing) existing.quantity += quantity;
    else byKey.set(stockKey(line), line);
  }
  return { ok: true, lines: [...byKey.values()].sort((a, b) => stockKey(a).localeCompare(stockKey(b))) };
}

/**
 * Fenêtre pendant laquelle une commande en attente compte comme « en cours
 * de paiement » : les sessions Stripe expirent à 30 min et un paiement
 * Mobile Money se fait en quelques minutes. Au-delà, le panier est réputé
 * abandonné et ne bloque plus personne.
 */
export const PENDING_HOLD_MS = 30 * 60 * 1000;

/**
 * Unités déjà engagées par des commandes en attente récentes de la
 * boutique, par article. C'est une réservation douce : rien n'est
 * décrémenté, un panier abandonné libère de lui-même au bout de 30 min, et
 * une commande fantôme ne peut bloquer un article que ce temps-là.
 */
async function pendingUnits(shopId: string, now: Date): Promise<Map<string, number>> {
  const rows = await prisma.order.findMany({
    where: {
      shopId,
      paymentStatus: "pending",
      stockReservedAt: null,
      createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) },
    },
    select: { items: true },
  });
  const units = new Map<string, number>();
  for (const row of rows) {
    const normalized = normalizeLines(row.items);
    if (!normalized.ok) continue;
    for (const line of normalized.lines) {
      units.set(stockKey(line), (units.get(stockKey(line)) ?? 0) + line.quantity);
    }
  }
  return units;
}

/**
 * Lecture seule : le panier est-il servable maintenant ? Même forme de
 * résultat que `reserveStock`, sans verrou ni écriture. Le stock réel est
 * diminué des unités engagées par les commandes en attente récentes de la
 * boutique (voir `pendingUnits`) : un vendeur qui a une pièce n'en vend pas
 * trente pendant un live. Deux acheteurs peuvent encore passer au même
 * instant pour le dernier exemplaire : c'est le règlement qui tranche.
 */
export async function checkStockAvailability(
  items: unknown,
  options: { shopId?: string; now?: Date } = {},
): Promise<ReserveStockResult> {
  const normalized = normalizeLines(items);
  if (!normalized.ok) return normalized.result;

  const held = options.shopId
    ? await pendingUnits(options.shopId, options.now ?? new Date())
    : new Map<string, number>();

  for (const line of normalized.lines) {
    const engaged = held.get(stockKey(line)) ?? 0;

    if (line.variant_id) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: line.variant_id },
        select: { stockQuantity: true, product: { select: { name: true } } },
      });
      if (!variant) return { ok: false, reason: "variant_not_found", variant_id: line.variant_id };
      if (variant.stockQuantity !== null && variant.stockQuantity - engaged < line.quantity) {
        return {
          ok: false,
          reason: "insufficient_stock",
          product_id: line.product_id,
          variant_id: line.variant_id,
          product_name: variant.product.name,
          available: Math.max(0, variant.stockQuantity - engaged),
          requested: line.quantity,
        };
      }
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { id: line.product_id },
      select: { stockQuantity: true, name: true },
    });
    if (!product) return { ok: false, reason: "product_not_found", product_id: line.product_id };
    if (product.stockQuantity !== null && product.stockQuantity - engaged < line.quantity) {
      return {
        ok: false,
        reason: "insufficient_stock",
        product_id: line.product_id,
        product_name: product.name,
        available: Math.max(0, product.stockQuantity - engaged),
        requested: line.quantity,
      };
    }
  }

  return { ok: true };
}

export interface StockShortfall {
  product_id: string;
  variant_id: string | null;
  product_name: string | null;
  requested: number;
  taken: number;
}

/**
 * Prélève le stock d'une commande payée, dans la transaction de règlement
 * (les lignes sont verrouillées `for update` le temps du prélèvement). Ne
 * refuse jamais : ce qui manque est renvoyé pour être signalé au vendeur.
 */
export async function claimStock(
  tx: Prisma.TransactionClient,
  items: unknown,
): Promise<StockShortfall[]> {
  const normalized = normalizeLines(items);
  if (!normalized.ok) return [];
  const shortfalls: StockShortfall[] = [];

  for (const line of normalized.lines) {
    const productId = line.product_id;
    const variantId = line.variant_id;
    const quantity = line.quantity;

    if (variantId) {
      const rows = await tx.$queryRaw<Array<{ stock_quantity: number | null; name: string }>>`
        select v.stock_quantity, p.name
          from public.product_variants v
          join public.products p on p.id = v.product_id
         where v.id = ${variantId}::uuid
           for update of v
      `;
      const variant = rows[0];
      if (!variant || variant.stock_quantity === null) continue;
      const taken = Math.min(variant.stock_quantity, quantity);
      if (taken > 0) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: { decrement: taken } },
        });
      }
      if (taken < quantity) {
        shortfalls.push({ product_id: productId, variant_id: variantId, product_name: variant.name, requested: quantity, taken });
      }
      continue;
    }

    const rows = await tx.$queryRaw<Array<{ stock_quantity: number | null; name: string }>>`
      select stock_quantity, name from public.products where id = ${productId}::uuid for update
    `;
    const product = rows[0];
    if (!product || product.stock_quantity === null) continue;
    const taken = Math.min(product.stock_quantity, quantity);
    if (taken > 0) {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: taken } },
      });
    }
    if (taken < quantity) {
      shortfalls.push({ product_id: productId, variant_id: null, product_name: product.name, requested: quantity, taken });
    }
  }

  return shortfalls;
}

/**
 * Port de `public.release_stock` : rend au stock les quantités d'un panier
 * dont la commande n'a pas abouti. Silencieux par construction — la fonction
 * SQL renvoyait `void` et ignorait les lignes invalides ou non suivies.
 */
export async function releaseStock(items: unknown): Promise<void> {
  if (!Array.isArray(items)) return;

  await prisma.$transaction(async (tx) => {
    for (const raw of items) {
      const productId = readString(raw, "product_id");
      const variantId = readString(raw, "variant_id");
      const quantity = readInt(raw, "quantity") ?? 0;

      if (quantity <= 0 || !productId) continue;

      if (variantId) {
        await tx.productVariant.updateMany({
          where: { id: variantId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: quantity } },
        });
      } else {
        await tx.product.updateMany({
          where: { id: productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: quantity } },
        });
      }
    }
  });
}

function readString(source: unknown, key: string): string | null {
  if (typeof source !== "object" || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readInt(source: unknown, key: string): number | null {
  if (typeof source !== "object" || source === null) return null;
  const parsed = Number((source as Record<string, unknown>)[key]);
  return Number.isInteger(parsed) ? parsed : null;
}
