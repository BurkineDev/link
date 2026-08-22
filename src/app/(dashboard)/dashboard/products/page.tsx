import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/lib/types/database";
import { ProductsClient } from "./products-client";

export const metadata = {
  title: "Produits",
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shopRaw } = await supabase
    .from("shops")
    .select("id, name, slug, currency")
    .eq("owner_id", user.id)
    .single();

  const shop = shopRaw as Pick<Row<"shops">, "id" | "name" | "slug" | "currency"> | null;
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
      shopSlug={shop.slug}
      currency={shop.currency}
    />
  );
}
