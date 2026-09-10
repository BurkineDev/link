import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  serializePromoCode,
  serializeShop,
  serializeShopLink,
} from "@/lib/db/serialize";
import { MarketingClient } from "./marketing-client";
import type { ShopRow, ShopLinkRow, PromoCodeRow } from "@/lib/types/database";

export const metadata = {
  title: "Marketing",
};

export default async function MarketingPage() {
  const user = await requireUser();

  const shopRow = await prisma.shop.findFirst({ where: { ownerId: user.id } });

  if (!shopRow) redirect("/dashboard");

  const [linkRows, codeRows] = await Promise.all([
    prisma.shopLink.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
    prisma.promoCode.findMany({
      where: { shopId: shopRow.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicShopUrl = `${appUrl.replace(/\/$/, "")}/${shop.slug}`;

  return (
    <MarketingClient
      shop={shop}
      links={linkRows.map(serializeShopLink) as unknown as ShopLinkRow[]}
      codes={codeRows.map(serializePromoCode) as unknown as PromoCodeRow[]}
      publicShopUrl={publicShopUrl}
    />
  );
}
