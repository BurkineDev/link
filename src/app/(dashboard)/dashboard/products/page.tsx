import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/lib/types/database";
import { ProductsClient } from "./products-client";

export const metadata = {
  title: "Produits — LinkBoutik",
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shopRaw } = await supabase
    .from("shops")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();

  const shop = shopRaw as Pick<Row<"shops">, "id" | "name" | "currency"> | null;
  if (!shop) redirect("/dashboard");

  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  const products = (productsRaw as Row<"products">[] | null) ?? [];

  return (
    <ProductsClient
      products={products}
      shopId={shop.id}
      currency={shop.currency}
    />
  );
}
