import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./orders-client";
import type { OrderRow } from "@/lib/types/database";
import type { OrderStatus } from "@/lib/types/database";

const PAGE_SIZE = 20;

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { status: statusParam, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Fetch shop
  const { data: shop } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();

  if (!shop) {
    redirect("/dashboard");
  }

  // Build query
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .range(from, to);

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

  if (activeStatus) {
    query = query.eq("status", activeStatus);
  }

  const { data: orders, count } = await query;

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <OrdersClient
      orders={(orders ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      totalPages={totalPages}
      currentPage={currentPage}
      activeStatus={activeStatus}
      currency={shop.currency}
    />
  );
}
