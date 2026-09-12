import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/db/serialize";
import { reconcilePendingGeniusPayOrders } from "@/lib/orders/reconcile";
import { OrdersClient } from "./orders-client";
import type { OrderRow } from "@/lib/types/database";
import type { OrderStatus } from "@/lib/types/database";

const PAGE_SIZE = 20;

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requireUser();

  const { status: statusParam, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;

  // Fetch shop
  const shop = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true, currency: true },
  });

  if (!shop) {
    redirect("/dashboard");
  }

  // Rattrapage des paiements Mobile Money.
  //
  // Le webhook Genius Pay peut ne jamais arriver — c'est arrivé au premier
  // paiement réel en production. L'ouverture de cette page est le moment
  // naturel pour retomber sur nos pieds : le vendeur voit l'état réel de ses
  // commandes plutôt qu'un « en attente » figé, et un panier abandonné est
  // annulé (le stock, lui, n'est prélevé qu'au règlement).
  //
  // Plafonné dans le temps : si Genius Pay est lent, la page s'affiche quand
  // même avec les données qu'on a.
  await Promise.race([
    reconcilePendingGeniusPayOrders({ shopId: shop.id, limit: 5 }),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]).catch((err) => console.error("[orders] reconcile failed", err));

  const validStatuses: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];

  const activeStatus =
    statusParam && validStatuses.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : null;

  const where = {
    shopId: shop.id,
    ...(activeStatus ? { status: activeStatus } : {}),
  };
  const [rows, count] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: from,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);
  const orders = rows.map(serializeOrder) as unknown as OrderRow[];

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <OrdersClient
      orders={orders}
      totalCount={count}
      totalPages={totalPages}
      currentPage={currentPage}
      activeStatus={activeStatus}
      currency={shop.currency}
    />
  );
}
