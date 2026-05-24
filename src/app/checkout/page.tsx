import { Suspense } from "react";
import CheckoutForm from "./checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { isGeniusPayConfigured } from "@/lib/geniuspay";

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

export default function CheckoutPage() {
  const mobileMoneyEnabled = isGeniusPayConfigured();

  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutForm mobileMoneyEnabled={mobileMoneyEnabled} />
    </Suspense>
  );
}
