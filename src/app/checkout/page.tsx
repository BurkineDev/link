import { Suspense } from "react";
import CheckoutForm from "./checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { isGeniusPayConfigured } from "@/lib/geniuspay";
import { loadCheckoutShop } from "@/lib/checkout/shop-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finaliser la commande",
  robots: { index: false, follow: false },
};

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Skeleton className="mb-8 h-8 w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * `?shop=<slug>` est posé par le tiroir panier : il permet de rendre
 * l'identité et les règles de livraison de la boutique dès le serveur, sans
 * page blanche. Le formulaire vérifie que c'est bien la boutique du panier
 * et, sinon, corrige l'adresse lui-même.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const mobileMoneyEnabled = isGeniusPayConfigured();
  const { shop: slugParam } = await searchParams;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const shop = slug ? await loadCheckoutShop(slug) : null;

  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutForm mobileMoneyEnabled={mobileMoneyEnabled} shop={shop} />
    </Suspense>
  );
}
