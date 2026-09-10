import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client/client";

/**
 * Port des fonctions Postgres `public.reserve_stock` et `public.release_stock`.
 *
 * `reserve_stock` est appelée par le checkout juste avant de créer la
 * commande : elle vérifie et décrémente le stock de chaque ligne du panier
 * sous verrou, pour que deux acheteurs ne puissent pas emporter le dernier
 * exemplaire en même temps. Un `stock_quantity` nul signifie « stock non
 * suivi » : la ligne est validée (le produit doit exister) mais jamais
 * décrémentée.
 *
 * Les formes de retour (clés snake_case) sont celles que lit
 * `src/app/api/checkout/route.ts` — elles ne doivent pas changer tant que
 * la route n'est pas portée elle aussi.
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
