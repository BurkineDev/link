import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleAfterResponse } from "@/lib/after-response";
import { loadBalance } from "@/lib/payouts/balance-db";
import { minimumPayout } from "@/lib/payouts/config";
import { requestPayout } from "@/lib/payouts/requests";
import { notifyPayoutRequested } from "@/lib/payouts/notifications";
import { formatPrice } from "@/lib/utils/format";
import { serializePayout } from "@/lib/payouts/serialize";

/**
 * /api/payouts — le vendeur voit son solde et ses reversements, et demande
 * le versement de tout ce qui est disponible.
 */

async function ownedShop(userId: string) {
  return prisma.shop.findFirst({
    where: { ownerId: userId },
    select: { id: true, currency: true },
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const shop = await ownedShop(user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const [balance, payouts] = await Promise.all([
    loadBalance(shop.id, shop.currency),
    prisma.payout.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    balance: {
      ...balance,
      minimum: minimumPayout(shop.currency),
      oldestUnpaidAt: balance.oldestUnpaidAt?.toISOString() ?? null,
      nextMaturityAt: balance.nextMaturityAt?.toISOString() ?? null,
    },
    payouts: payouts.map(serializePayout),
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const shop = await ownedShop(user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const result = await requestPayout(shop.id);

  if (!result.ok) {
    switch (result.reason) {
      case "no_account":
        return NextResponse.json(
          { error: "Renseigne d'abord ton compte de reversement.", code: "NO_ACCOUNT" },
          { status: 409 },
        );
      case "already_open":
        return NextResponse.json(
          { error: "Une demande est déjà en cours de traitement.", code: "ALREADY_OPEN" },
          { status: 409 },
        );
      case "below_minimum":
        return NextResponse.json(
          {
            error: `Le solde disponible (${formatPrice(result.available ?? 0, result.currency ?? shop.currency)}) est inférieur au minimum de ${formatPrice(result.minimum ?? 0, result.currency ?? shop.currency)}.`,
            code: "BELOW_MINIMUM",
          },
          { status: 409 },
        );
      default:
        return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }
  }

  scheduleAfterResponse(
    () => notifyPayoutRequested(result.payoutId),
    (error) => console.warn("[payouts] notification failed", error),
  );

  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: result.payoutId } });
  return NextResponse.json({ payout: serializePayout(payout) }, { status: 201 });
}
