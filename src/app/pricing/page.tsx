import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/subscription";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Tarifs — LinkBoutik",
  description:
    "Commence gratuitement avec LinkBoutik. Passe en Pro pour des produits illimités, 0% de commission et des outils avancés.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: "free" | "pro" = "free";
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
