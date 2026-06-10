import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types/database";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Tarifs — Bio-Lien",
  description:
    "Commence gratuitement avec Bio-Lien. Passe en Starter ou Pro pour plus de produits, des commissions réduites et des outils avancés.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: SubscriptionPlan = "free";
  if (user) {
    const { data: sub } = await supabase
      .from("creator_subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();
    currentPlan = getEffectivePlan(sub);
  }

  return <PricingClient isAuthenticated={!!user} currentPlan={currentPlan} />;
}
