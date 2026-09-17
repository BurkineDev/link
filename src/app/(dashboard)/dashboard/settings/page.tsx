import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShop, serializeShopLink, serializeShippingZone } from "@/lib/db/serialize";
import { getPlanLimits } from "@/lib/subscription";
import { getEffectivePlanForUser } from "@/lib/db/plans";
import { canHideBadge } from "@/lib/plans/badge";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import type { ShopLinkRow, ShopRow } from "@/lib/types/database";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Paramètres de la boutique",
};

const TABS = ["general", "appearance", "links", "contact", "payments", "shipping", "danger"] as const;
type SettingsTab = (typeof TABS)[number];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  // ?tab=appearance : la page « Tu es en Pro » envoie droit sur le badge.
  const initialTab: SettingsTab = (TABS as readonly string[]).includes(String(params.tab))
    ? (params.tab as SettingsTab)
    : "general";

  const shopRow = await prisma.shop.findFirst({ where: { ownerId: user.id } });

  if (!shopRow) redirect("/dashboard");

  // Caisse masquée (voir src/lib/payments/online-checkout.ts) : l'onglet
  // Livraison n'est pas monté, inutile de charger les zones.
  const onlineCheckout = isOnlineCheckoutEnabled();

  const [linkRows, zoneRows, plan] = await Promise.all([
    prisma.shopLink.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
    onlineCheckout
      ? prisma.shippingZone.findMany({
          where: { shopId: shopRow.id },
          orderBy: { createdAt: "asc" },
        })
      : [],
    // La rédaction assistée est réservée au plan Pro, le retrait du badge aux
    // plans payants. Les boutons restent visibles pour les autres — une porte
    // fermée qu'on voit vaut mieux qu'une fonctionnalité dont on ignore
    // l'existence.
    getEffectivePlanForUser(user.id),
  ]);

  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const links = linkRows.map(serializeShopLink) as unknown as ShopLinkRow[];
  return (
    <SettingsClient
      shop={shop}
      links={links}
      shippingZones={zoneRows.map(serializeShippingZone)}
      canUseAi={getPlanLimits(plan).aiWriting}
      canHideBadge={canHideBadge(plan)}
      onlineCheckout={onlineCheckout}
      initialTab={initialTab}
    />
  );
}
