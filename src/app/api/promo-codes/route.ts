import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePromoCode } from "@/lib/db/serialize";
import { Prisma } from "../../../../prisma/generated/client/client";

const createSchema = z.object({
  shop_id: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Format: lettres majuscules, chiffres, _ ou -"),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().positive(),
  min_order_amount: z.number().nonnegative().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
});

async function ownsShop(shopId: string, userId: string): Promise<boolean> {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ownerId: userId },
    select: { id: true },
  });
  return shop !== null;
}

// GET /api/promo-codes?shopId=xxx
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId) return NextResponse.json({ error: "shopId requis" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    if (!(await ownsShop(shopId, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const codes = await prisma.promoCode.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ codes: codes.map(serializePromoCode) });
  } catch (error) {
    console.error("[api/promo-codes GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/promo-codes
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (
    parsed.data.discount_type === "percent" &&
    (parsed.data.discount_value <= 0 || parsed.data.discount_value > 100)
  ) {
    return NextResponse.json(
      { error: "Une remise en pourcentage doit être entre 1 et 100." },
      { status: 422 },
    );
  }

  try {
    // Sans RLS, l'appartenance de la boutique se vérifie explicitement.
    if (!(await ownsShop(parsed.data.shop_id, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const promo = await prisma.promoCode.create({
      data: {
        shopId: parsed.data.shop_id,
        code: parsed.data.code.toUpperCase(),
        discountType: parsed.data.discount_type,
        discountValue: parsed.data.discount_value,
        minOrderAmount: parsed.data.min_order_amount ?? null,
        maxUses: parsed.data.max_uses ?? null,
        expiresAt: parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
        isActive: parsed.data.is_active,
      },
    });

    return NextResponse.json({ code: serializePromoCode(promo) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Ce code existe déjà." }, { status: 409 });
    }
    console.error("[api/promo-codes POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
