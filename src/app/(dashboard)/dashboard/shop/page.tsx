import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopRow } from "@/lib/types/database";
import ShopClient from "./shop-client";

export default async function ShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  const shop = data as ShopRow | null;

  if (!shop) redirect("/dashboard/onboarding");

  return <ShopClient shop={shop} />;
}
