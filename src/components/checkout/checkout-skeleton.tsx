import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopIdentity } from "@/components/checkout/order-summary";

/**
 * Ce que la page de commande montre avant de savoir lire le panier : sur le
 * serveur, pendant l'hydratation, et pendant que la boutique se charge. Ce
 * que le serveur sait déjà — chez qui on paie — est affiché tout de suite ;
 * le reste attend le panier, qui vit dans le navigateur.
 */
export function CheckoutSkeleton({
  shop,
}: {
  shop?: { name: string; logo_url: string | null; theme_color: string } | null;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10" aria-busy="true">
      <div className="mb-6 sm:mb-8">
        <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ChevronLeft className="size-4" />
          Retour
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Finaliser la commande</h1>
      </div>
      {shop && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm lg:hidden">
          <ShopIdentity name={shop.name} logoUrl={shop.logo_url} accent={shop.theme_color} compact />
        </div>
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-96 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
