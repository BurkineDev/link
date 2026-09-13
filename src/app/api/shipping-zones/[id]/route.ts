import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShippingZone } from "@/lib/db/serialize";
import { shippingZoneSchema } from "@/lib/shipping/zone-schema";
import { revalidateShop } from "@/lib/shops/revalidate";

type Ctx = { params: Promise<{ id: string }> };

async function ownedZone(zoneId: string, userId: string) {
  if (!z.string().uuid().safeParse(zoneId).success) return null;
  return prisma.shippingZone.findFirst({
    where: { id: zoneId, shop: { ownerId: userId } },
    select: { id: true, shopId: true, shop: { select: { currency: true } } },
  });
}

// PATCH /api/shipping-zones/[id] — modifie une zone (propriétaire).
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
  const parsed = shippingZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const owned = await ownedZone(id, user.id);
  if (!owned) return NextResponse.json({ error: "Zone introuvable" }, { status: 404 });

  const zone = parsed.data;
  const updated = await prisma.shippingZone.update({
    where: { id },
    data: {
      name: zone.name,
      countries: zone.countries,
      rate: zone.rate,
      freeAbove: zone.free_above,
      estimatedMin: zone.estimated_min,
      estimatedMax: zone.estimated_max,
      isActive: zone.is_active,
      // Une boutique qui a changé de devise laisse ses zones dans l'ancienne
      // (le checkout les ignore) : enregistrer la zone la remet au diapason.
      currency: owned.shop.currency,
    },
  });
  await revalidateShop(owned.shopId);
  return NextResponse.json({ zone: serializeShippingZone(updated) });
}

// DELETE /api/shipping-zones/[id]
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owned = await ownedZone(id, user.id);
  if (!owned) return NextResponse.json({ error: "Zone introuvable" }, { status: 404 });

  await prisma.shippingZone.delete({ where: { id } });
  await revalidateShop(owned.shopId);
  return NextResponse.json({ ok: true });
}
