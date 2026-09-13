import { Suspense } from "react";
import type { Metadata } from "next";
import CheckoutForm from "./checkout-form";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { isGeniusPayConfigured } from "@/lib/geniuspay";
import { loadCheckoutShop, type CheckoutShop, type CheckoutShopStatus } from "@/lib/checkout/shop-context";

export const metadata: Metadata = {
  title: "Finaliser la commande",
  robots: { index: false, follow: false },
};

/**
 * `?shop=<id ou slug>` est posé par le tiroir panier et par les URL de
 * retour des prestataires : il permet de rendre l'identité et les règles de
 * livraison de la boutique dès le serveur. Le chargement se fait sous le
 * Suspense pour que le squelette parte tout de suite, et une panne de base
 * dégrade vers « sans contexte » plutôt que de casser la page — le
 * formulaire sait attendre la boutique.
 */
async function CheckoutWithShop({ shopRef, mobileMoneyEnabled }: { shopRef: string | null; mobileMoneyEnabled: boolean }) {
  let shop: CheckoutShop | null = null;
  let status: CheckoutShopStatus = "missing";
  if (shopRef) {
    try {
      shop = await loadCheckoutShop(shopRef);
      status = shop ? "ok" : "not_found";
    } catch (error) {
      console.error("[checkout] shop context:", error);
      status = "error";
    }
  }
  return <CheckoutForm mobileMoneyEnabled={mobileMoneyEnabled} shop={shop} shopStatus={status} />;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const mobileMoneyEnabled = isGeniusPayConfigured();
  const { shop: param } = await searchParams;
  const shopRef = (Array.isArray(param) ? param[0] : param) ?? null;

  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutWithShop shopRef={shopRef} mobileMoneyEnabled={mobileMoneyEnabled} />
    </Suspense>
  );
}
