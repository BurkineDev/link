import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePromoCode } from "@/lib/db/serialize";

const updateSchema = z.object({
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  min_order_amount: z.number().nonnegative().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirms the promo code exists and belongs to a shop owned by `userId`.
 * Sans RLS, c'est la seule barrière : elle précède chaque écriture.
 */
async function ownsPromo(promoId: string, userId: string): Promise<boolean> {
  const promo = await prisma.promoCode.findFirst({
    where: { id: promoId, shop: { ownerId: userId } },
    select: { id: true },
  });
  return promo !== null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 422 });

  try {
    if (!(await ownsPromo(id, user.id))) {
      return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
    }

    const { is_active, expires_at, max_uses, min_order_amount } = parsed.data;
    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(is_active !== undefined ? { isActive: is_active } : {}),
        ...(expires_at !== undefined
          ? { expiresAt: expires_at ? new Date(expires_at) : null }
          : {}),
        ...(max_uses !== undefined ? { maxUses: max_uses } : {}),
        ...(min_order_amount !== undefined ? { minOrderAmount: min_order_amount } : {}),
      },
    });

    return NextResponse.json({ code: serializePromoCode(promo) });
  } catch (error) {
    console.error("[api/promo-codes PATCH] update error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    if (!(await ownsPromo(id, user.id))) {
      return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
    }

    await prisma.promoCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/promo-codes DELETE] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
