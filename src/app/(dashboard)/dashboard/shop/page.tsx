import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShop } from "@/lib/db/serialize";
import type { ShopRow } from "@/lib/types/database";
import ShopClient from "./shop-client";

export default async function ShopPage() {
  const user = await requireUser();

  const row = await prisma.shop.findFirst({ where: { ownerId: user.id } });

  if (!row) redirect("/dashboard/onboarding");

  const shop = serializeShop(row) as unknown as ShopRow;

  return <ShopClient shop={shop} />;
}
