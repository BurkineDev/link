import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopRow } from "@/lib/types/database";
import ShopClient from "./shop-client";

export const metadata = {
  title: "Ma Boutique — LinkBoutik",
};

export default async function ShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!shop) {
    redirect("/dashboard");
  }

  return <ShopClient shop={shop as ShopRow} />;
}
