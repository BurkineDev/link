import { revalidateShop } from "@/lib/shops/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShopLink } from "@/lib/db/serialize";

const linkSchema = z.object({
  shop_id: z.string().uuid(),
  label: z.string().trim().min(1).max(60),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (v) =>
        v.startsWith("http://") ||
        v.startsWith("https://") ||
        v.startsWith("mailto:") ||
        v.startsWith("tel:"),
      "URL invalide (http(s)://, mailto: ou tel:)",
    ),
  icon: z.string().trim().min(1).max(30).default("custom"),
  thumbnail_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("https://"), "L'image doit être en https://")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),

  position: z.number().int().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

/** Le vendeur ne peut lire et écrire que sur sa propre boutique. */
async function ownsShop(shopId: string, userId: string): Promise<boolean> {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ownerId: userId },
    select: { id: true },
  });
  return shop !== null;
}

// GET /api/shop-links?shopId=xxx — list links for a shop (owner only).
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId) return NextResponse.json({ error: "shopId requis" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    if (!(await ownsShop(shopId, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const links = await prisma.shopLink.findMany({
      where: { shopId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ links: links.map(serializeShopLink) });
  } catch (error) {
    console.error("[api/shop-links GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/shop-links — create a link.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // L'ancienne version s'en remettait à la RLS pour refuser une insertion
    // sur la boutique d'un autre ; sans RLS, le contrôle est explicite.
    if (!(await ownsShop(parsed.data.shop_id, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const link = await prisma.shopLink.create({
      data: {
        shopId: parsed.data.shop_id,
        label: parsed.data.label,
        url: parsed.data.url,
        icon: parsed.data.icon,
        thumbnailUrl: parsed.data.thumbnail_url ?? null,
        position: parsed.data.position,
        isActive: parsed.data.is_active,
      },
    });

    await revalidateShop(parsed.data.shop_id);
    return NextResponse.json({ link: serializeShopLink(link) }, { status: 201 });
  } catch (error) {
    console.error("[api/shop-links POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
