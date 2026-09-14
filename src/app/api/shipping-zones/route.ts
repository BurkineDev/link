import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShippingZone } from "@/lib/db/serialize";
import { shippingZoneSchema, zoneAmountIssue } from "@/lib/shipping/zone-schema";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import { revalidateShop } from "@/lib/shops/revalidate";

/**
 * Zones de livraison d'une boutique. Elles existaient en base et au
 * checkout (frais calculés selon le pays) sans qu'aucun écran ne permette
 * d'en créer : aucune boutique n'en avait. Le vendeur ne lit et n'écrit que
 * les siennes ; le tarif est dans la devise de la boutique.
 */

const MAX_ZONES = 20;

async function ownedShop(shopId: string, userId: string) {
  return prisma.shop.findFirst({
    where: { id: shopId, ownerId: userId },
    select: { id: true, currency: true },
  });
}

// GET /api/shipping-zones?shopId=… — zones de la boutique (propriétaire).
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId || !z.string().uuid().safeParse(shopId).success) {
    return NextResponse.json({ error: "shopId requis" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const shop = await ownedShop(shopId, user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const rows = await prisma.shippingZone.findMany({
    where: { shopId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ zones: rows.map(serializeShippingZone) });
}

const createSchema = z.object({ shop_id: z.string().uuid() }).and(shippingZoneSchema);

// POST /api/shipping-zones — crée une zone.
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
  const { shop_id: shopId, ...zone } = parsed.data;

  const shop = await ownedShop(shopId, user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const amountIssue = zoneAmountIssue(zone, CURRENCY_META[shop.currency as Currency]?.decimals ?? 2);
  if (amountIssue) return NextResponse.json({ error: amountIssue }, { status: 422 });

  const count = await prisma.shippingZone.count({ where: { shopId } });
  if (count >= MAX_ZONES) {
    return NextResponse.json(
      { error: `${MAX_ZONES} zones au maximum par boutique.` },
      { status: 409 },
    );
  }

  const created = await prisma.shippingZone.create({
    data: {
      shopId,
      name: zone.name,
      countries: zone.countries,
      rate: zone.rate,
      freeAbove: zone.free_above,
      estimatedMin: zone.estimated_min,
      estimatedMax: zone.estimated_max,
      isActive: zone.is_active,
      currency: shop.currency,
    },
  });
  await revalidateShop(shopId);
  return NextResponse.json({ zone: serializeShippingZone(created) }, { status: 201 });
}
