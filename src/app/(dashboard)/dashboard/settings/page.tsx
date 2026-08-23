import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Paramètres de la boutique",
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

  // La rédaction assistée est réservée au plan Pro. Le bouton reste visible
  // pour les autres — une porte fermée qu'on voit vaut mieux qu'une
  // fonctionnalité dont on ignore l'existence.
  const { data: sub } = await supabase
    .from("creator_subscriptions")
    .select("plan, status, provider, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <SettingsClient
      shop={shop}
      links={links ?? []}
      canUseAi={getPlanLimits(getEffectivePlan(sub)).aiWriting}
    />
  );
}
