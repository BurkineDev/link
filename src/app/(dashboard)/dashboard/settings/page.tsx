import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShop, serializeShopLink } from "@/lib/db/serialize";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import type { ShopLinkRow, ShopRow } from "@/lib/types/database";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Paramètres de la boutique",
};

export default async function SettingsPage() {
  const user = await requireUser();

  const shopRow = await prisma.shop.findFirst({ where: { ownerId: user.id } });

  if (!shopRow) redirect("/dashboard");

  const [linkRows, sub] = await Promise.all([
    prisma.shopLink.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
    // La rédaction assistée est réservée au plan Pro. Le bouton reste visible
    // pour les autres — une porte fermée qu'on voit vaut mieux qu'une
    // fonctionnalité dont on ignore l'existence.
    prisma.creatorSubscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, provider: true, currentPeriodEnd: true },
    }),
  ]);

  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const links = linkRows.map(serializeShopLink) as unknown as ShopLinkRow[];
  const plan = getEffectivePlan(
    sub
      ? {
          plan: sub.plan,
          status: sub.status,
          provider: sub.provider,
          current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  );

  return (
    <SettingsClient
      shop={shop}
      links={links}
      canUseAi={getPlanLimits(plan).aiWriting}
    />
  );
}
