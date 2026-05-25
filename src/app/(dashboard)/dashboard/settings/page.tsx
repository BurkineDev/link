import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Paramètres de la boutique — LinkBoutik",
};

export default async function SettingsPage() {
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

  const { data: links } = await supabase
    .from("shop_links")
    .select("*")
    .eq("shop_id", shop.id)
    .order("position", { ascending: true });

  return <SettingsClient shop={shop} links={links ?? []} />;
}
