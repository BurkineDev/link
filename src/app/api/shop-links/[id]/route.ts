import { revalidateShop } from "@/lib/shops/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShopLink } from "@/lib/db/serialize";

const updateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  url: z.string().trim().min(1).max(500).optional(),
  icon: z.string().trim().min(1).max(30).optional(),
  thumbnail_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("https://"), "L'image doit être en https://")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),

  position: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirms the link exists and belongs to a shop owned by `userId`.
 * Sans RLS, c'est le seul contrôle d'accès : il doit rester avant toute
 * écriture.
 */
async function ownedLink(linkId: string, userId: string): Promise<{ shopId: string } | null> {
  return prisma.shopLink.findFirst({
    where: { id: linkId, shop: { ownerId: userId } },
    select: { shopId: true },
  });
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }

  try {
    const owned = await ownedLink(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
    }

    const { label, url, icon, thumbnail_url, position, is_active } = parsed.data;
    const link = await prisma.shopLink.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(thumbnail_url !== undefined ? { thumbnailUrl: thumbnail_url } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(is_active !== undefined ? { isActive: is_active } : {}),
      },
    });

    await revalidateShop(owned.shopId);
    return NextResponse.json({ link: serializeShopLink(link) });
  } catch (error) {
    console.error("[api/shop-links PATCH] update error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const owned = await ownedLink(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
    }

    await prisma.shopLink.delete({ where: { id } });
    await revalidateShop(owned.shopId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/shop-links DELETE] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
