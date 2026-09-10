import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/db/serialize";
import type { Row } from "@/lib/types/database";
import { ProductsClient } from "./products-client";

export const metadata = {
  title: "Produits",
};

export default async function ProductsPage() {
  const user = await requireUser();

  const shop = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true, name: true, slug: true, currency: true },
  });
  if (!shop) redirect("/dashboard");

  const rows = await prisma.product.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  // Le composant client attend encore la forme Supabase (snake_case) ; la
  // sérialisation la reproduit à l'identique.
  const products = rows.map(serializeProduct) as unknown as Row<"products">[];

  return (
    <ProductsClient
      products={products}
      shopId={shop.id}
      shopSlug={shop.slug}
      currency={shop.currency}
    />
  );
}
