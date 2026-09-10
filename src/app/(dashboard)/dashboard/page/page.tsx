import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePageBlock, serializeShop, serializeShopLink } from "@/lib/db/serialize";
import { PageBuilder } from "./page-builder";
import { resolveBioPageBlocks, type LegacyLink } from "@/lib/blocks/resolve";
import type { PageBlockRow, ShopRow } from "@/lib/types/database";

export const metadata = { title: "Ma page" };

/**
 * « Ma page » — le Page Builder, cœur du produit.
 *
 * Charge les blocs enregistrés. S'il n'y en a aucun, prépare la composition
 * *proposée* à partir des liens et produits existants : le vendeur voit sa
 * page telle qu'elle est en ligne aujourd'hui et peut l'adopter d'un clic.
 * Rien n'est écrit en base tant qu'il n'a pas décidé.
 */
export default async function MyPageRoute() {
  const user = await requireUser();

  const shopRow = await prisma.shop.findFirst({ where: { ownerId: user.id } });
  if (!shopRow) redirect("/dashboard/onboarding");

  const [blockRows, linkRows, anyProduct] = await Promise.all([
    prisma.pageBlock.findMany({
      where: { shopId: shopRow.id },
      orderBy: { position: "asc" },
    }),
    prisma.shopLink.findMany({
      where: { shopId: shopRow.id, isActive: true },
      orderBy: { position: "asc" },
    }),
    prisma.product.findFirst({
      where: { shopId: shopRow.id, isPublished: true },
      select: { id: true },
    }),
  ]);

  const shop = serializeShop(shopRow) as unknown as ShopRow;
  const rows = blockRows.map(serializePageBlock) as unknown as PageBlockRow[];
  const links = linkRows.map(serializeShopLink) as LegacyLink[];
  const hasProducts = anyProduct !== null;

  const { blocks, source } = resolveBioPageBlocks({
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      position: r.position,
      title: r.title,
      config: r.config,
      style: r.style,
      visible: r.visible,
    })),
    links,
    hasProducts,
    options: { includeHidden: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <PageBuilder
      shop={shop}
      initialBlocks={blocks}
      source={source}
      pageUrl={`${appUrl.replace(/\/$/, "")}/${shop.slug}`}
    />
  );
}
