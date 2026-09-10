import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/promo-codes/validate
 *
 * Buyer-facing endpoint — checks if a promo code is valid for a given shop
 * + order subtotal. Does NOT increment uses_count (that happens atomically
 * during /api/checkout via `redeemPromoCode`). Public : l'acheteur n'est pas
 * authentifié, et la réponse ne révèle rien d'autre que la remise.
 */

const schema = z.object({
  shopId: z.string().uuid(),
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/i),
  orderTotal: z.number().nonnegative(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }

  const { shopId, code, orderTotal } = parsed.data;

  const promo = await prisma.promoCode.findUnique({
    where: { shopId_code: { shopId, code: code.toUpperCase() } },
    select: {
      discountType: true,
      discountValue: true,
      minOrderAmount: true,
      maxUses: true,
      usesCount: true,
      expiresAt: true,
      isActive: true,
    },
  });

  if (!promo) {
    return NextResponse.json({ ok: false, error: "Code promo introuvable." }, { status: 404 });
  }

  if (!promo.isActive) {
    return NextResponse.json({ ok: false, error: "Ce code n'est plus actif." }, { status: 400 });
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "Ce code est expiré." }, { status: 400 });
  }

  if (promo.maxUses != null && promo.usesCount >= promo.maxUses) {
    return NextResponse.json(
      { ok: false, error: "Ce code a atteint sa limite d'utilisations." },
      { status: 400 },
    );
  }

  const minOrderAmount =
    promo.minOrderAmount === null ? null : Number(promo.minOrderAmount);
  if (minOrderAmount != null && orderTotal < minOrderAmount) {
    return NextResponse.json(
      {
        ok: false,
        error: `Le montant minimum pour ce code est ${minOrderAmount}.`,
      },
      { status: 400 },
    );
  }

  const discountValue = Number(promo.discountValue);
  const discount =
    promo.discountType === "percent"
      ? Math.round((orderTotal * discountValue) / 100)
      : Math.min(discountValue, orderTotal);

  return NextResponse.json({
    ok: true,
    discount,
    discount_type: promo.discountType,
    discount_value: discountValue,
  });
}
