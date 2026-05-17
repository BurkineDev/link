import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BanknoteIcon,
  ShoppingBagIcon,
  PackageIcon,
  EyeIcon,
  PlusIcon,
  Share2Icon,
  AlertCircleIcon,
  InboxIcon,
} from "lucide-react";
import type { OrderRow } from "@/lib/types/database";

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch everything in parallel
  const [profileResult, shopResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single(),
    supabase
      .from("shops")
      .select("id, name, slug, is_published, currency")
      .eq("owner_id", user.id)
      .single(),
  ]);

  const profile = profileResult.data;
  const shop = shopResult.data;

  const displayName =
    profile?.full_name?.split(" ")[0] ??
    profile?.username ??
    user.email?.split("@")[0] ??
    "là";

  // Stats + recent orders (only if shop exists)
  let totalRevenue = 0;
  let ordersCount = 0;
  let productsCount = 0;
  let recentOrders: OrderRow[] = [];

  if (shop?.id) {
    const [ordersStatsResult, productsResult, recentOrdersResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("total_amount, status")
          .eq("shop_id", shop.id),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id),
        supabase
          .from("orders")
          .select("*")
          .eq("shop_id", shop.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const ordersStats = ordersStatsResult.data ?? [];
    ordersCount = ordersStats.length;
    totalRevenue = ordersStats
      .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    productsCount = productsResult.count ?? 0;
    recentOrders = (recentOrdersResult.data ?? []) as OrderRow[];
  }

  const currency = shop?.currency ?? "XOF";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bonjour, {displayName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voici un aperçu de ta boutique aujourd&apos;hui.
        </p>
      </div>

      {/* Unpublished shop alert */}
      {shop && !shop.is_published && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800/50 dark:bg-yellow-900/20">
          <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Ta boutique n&apos;est pas encore publiée
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Active ta boutique pour que tes clients puissent la voir et
                passer commande.
              </p>
            </div>
            <Button size="sm" asChild className="shrink-0">
              <Link href="/dashboard/shop">Publier ma boutique</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          label="Revenu total"
          value={formatCurrency(totalRevenue, currency)}
          icon={BanknoteIcon}
          trendLabel={ordersCount === 0 ? "Aucune vente pour l'instant" : undefined}
          iconClassName="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatsCard
          label="Commandes"
          value={ordersCount}
          icon={ShoppingBagIcon}
          trendLabel={ordersCount === 0 ? "Aucune commande" : undefined}
          iconClassName="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatsCard
          label="Produits"
          value={productsCount}
          icon={PackageIcon}
          trendLabel={productsCount === 0 ? "Ajoute ton premier produit" : undefined}
          iconClassName="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatsCard
          label="Visites boutique"
          value={0}
          icon={EyeIcon}
          trendLabel="Bientôt disponible"
          iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Commandes récentes</CardTitle>
                <CardDescription>Tes 5 dernières commandes</CardDescription>
              </div>
              {recentOrders.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/orders">Voir tout</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <InboxIcon className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Aucune commande pour l&apos;instant
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Partage ta boutique pour recevoir tes premières commandes !
                  </p>
                </div>
                {shop?.slug && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/shop">Partager ma boutique</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">
                        Commande
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Client
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Montant
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {shortId(order.id)}
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <p className="truncate font-medium">
                            {order.buyer_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.buyer_email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCurrency(order.total_amount, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                          {formatDate(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>
              Gérer ta boutique en un clic
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-4">
            <Button className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard/products/new">
                <PlusIcon className="size-4" />
                Ajouter un produit
              </Link>
            </Button>
            {shop?.slug && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                asChild
              >
                <Link href="/dashboard/shop">
                  <Share2Icon className="size-4" />
                  Partager ma boutique
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              asChild
            >
              <Link href="/dashboard/orders">
                <ShoppingBagIcon className="size-4" />
                Voir les commandes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
