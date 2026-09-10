import "server-only";

import { prisma } from "@/lib/prisma";
import type { PromoDiscountType } from "../../../prisma/generated/client/client";

/**
 * Port des fonctions Postgres `public.redeem_promo_code` et
 * `public.release_promo_redemption`.
 *
 * Un code promo est consommé au moment du checkout, avant le paiement, et
 * rendu si la commande échoue en route. Le verrou sur la ligne du code
 * garantit que `max_uses` est respecté même sous concurrence : deux
 * acheteurs qui saisissent le dernier usage disponible au même instant ne
 * l'obtiendront pas tous les deux.
 *
 * Les clés de retour restent en snake_case : c'est la forme que lit
 * `src/app/api/checkout/route.ts`.
 */

export type RedeemPromoResult =
  | {
      ok: true;
      code_id: string;
      discount_type: PromoDiscountType;
      discount_value: number;
      discount: number;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "not_found"
        | "inactive"
        | "expired"
        | "max_uses_reached";
    }
  | { ok: false; reason: "min_order_not_met"; min_order_amount: number };

export async function redeemPromoCode(
  shopId: string | null | undefined,
  code: string | null | undefined,
  orderTotal: number | null | undefined,
): Promise<RedeemPromoResult> {
  if (!shopId || !code || orderTotal === null || orderTotal === undefined) {
    return { ok: false, reason: "invalid_input" };
  }

  const normalized = normalizeCode(code);

  return prisma.$transaction(async (tx) => {
    // Verrou : la lecture des compteurs et l'incrément doivent être une seule
    // opération vis-à-vis des autres checkouts.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.promo_codes
       where shop_id = ${shopId}::uuid and code = ${normalized}
       for update
    `;
    if (locked.length === 0) {
      return { ok: false, reason: "not_found" } as const;
    }

    const promo = await tx.promoCode.findUniqueOrThrow({
      where: { id: locked[0].id },
    });

    if (!promo.isActive) {
      return { ok: false, reason: "inactive" } as const;
    }
    if (promo.expiresAt !== null && promo.expiresAt < new Date()) {
      return { ok: false, reason: "expired" } as const;
    }
    if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
      return { ok: false, reason: "max_uses_reached" } as const;
    }

    const minOrder =
      promo.minOrderAmount === null ? null : promo.minOrderAmount.toNumber();
    if (minOrder !== null && orderTotal < minOrder) {
      return {
        ok: false,
        reason: "min_order_not_met",
        min_order_amount: minOrder,
      } as const;
    }

    const discountValue = promo.discountValue.toNumber();
    // Un pourcentage est arrondi au centime ; un montant fixe est pris tel
    // quel. Dans les deux cas on plafonne au total pour ne jamais produire une
    // remise supérieure à la commande.
    const rawDiscount =
      promo.discountType === "percent"
        ? roundToCents((orderTotal * discountValue) / 100)
        : discountValue;
    const discount = Math.min(rawDiscount, orderTotal);

    await tx.promoCode.update({
      where: { id: promo.id },
      data: { usesCount: { increment: 1 } },
    });

    return {
      ok: true,
      code_id: promo.id,
      discount_type: promo.discountType,
      discount_value: discountValue,
      discount,
    } as const;
  });
}

/**
 * Rend une utilisation réservée quand la commande échoue avant paiement.
 * Ne descend jamais sous zéro (`greatest(uses_count - 1, 0)` côté SQL).
 */
export async function releasePromoRedemption(
  shopId: string,
  code: string,
): Promise<void> {
  await prisma.promoCode.updateMany({
    where: {
      shopId,
      code: normalizeCode(code),
      usesCount: { gt: 0 },
    },
    data: { usesCount: { decrement: 1 } },
  });
}

/**
 * `redeem` faisait `upper(p_code)`, `release` faisait `upper(trim(p_code))`.
 * On aligne les deux sur la forme la plus stricte : un code saisi avec une
 * espace parasite doit être rendu comme il a été consommé.
 */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
