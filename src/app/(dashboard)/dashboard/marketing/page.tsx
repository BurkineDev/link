import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingClient } from "./marketing-client";
import type { ShopRow, ShopLinkRow, PromoCodeRow } from "@/lib/types/database";

export const metadata = {
  title: "Marketing — Bio-Lien",
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!shop) redirect("/dashboard");

  const [linksResult, codesResult] = await Promise.all([
    supabase
      .from("shop_links")
      .select("*")
      .eq("shop_id", shop.id)
      .order("position", { ascending: true }),
    supabase
      .from("promo_codes")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicShopUrl = `${appUrl.replace(/\/$/, "")}/${shop.slug}`;

  return (
    <MarketingClient
      shop={shop as ShopRow}
      links={(linksResult.data ?? []) as ShopLinkRow[]}
      codes={(codesResult.data ?? []) as PromoCodeRow[]}
      publicShopUrl={publicShopUrl}
    />
  );
}
