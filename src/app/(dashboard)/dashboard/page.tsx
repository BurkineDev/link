import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { BoostCard } from "@/components/dashboard/boost-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingBagIcon,
  EyeIcon,
  PlusIcon,
  Share2Icon,
  AlertCircleIcon,
  InboxIcon,
  ArrowRightIcon,
  BarChart3Icon,
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
  }).format(new Date(iso));
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** Tuile de chiffre, dans les trois tons de la maquette. */
function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone: "lime" | "paper" | "ink";
}) {
  const skin = {
    lime: {
      box: { background: "var(--b-lime)" },
      label: "var(--b-olive)",
      note: "var(--b-olive)",
      value: "var(--b-ink)",
    },
    paper: {
      box: {
        background: "var(--b-paper)",
        border: "1px solid var(--b-line)",
      },
      label: "var(--b-faint)",
      note: "var(--b-faint)",
      value: "var(--b-ink)",
    },
    ink: {
      box: { background: "var(--b-ink)" },
      label: "var(--b-lime)",
      note: "var(--b-on-dark-faint)",
      value: "var(--b-on-dark)",
    },
  }[tone];

  return (
    <div className="rounded-[var(--r-lg)] p-5" style={skin.box}>
      <div
        className="text-[12.5px] font-bold uppercase tracking-[0.06em]"
        style={{ color: skin.label }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
        style={{ color: skin.value }}
      >
        {value}
      </div>
      <div className="mt-1 text-[12.5px]" style={{ color: skin.note }}>
        {note}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, shopResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single(),
    supabase
      .from("shops")
      .select("id, name, slug, is_published, currency, featured_until")
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

  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  let totalRevenue = 0;
  let ordersCount = 0;
  let productsCount = 0;
  let recentOrders: OrderRow[] = [];
  let viewsCount = 0;

  if (shop?.id) {
    const [ordersStatsResult, productsResult, recentOrdersResult, viewsResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("total_amount, status, payment_status")
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
        // La table est alimentée par track_shop_page_view à chaque ouverture
        // de la page publique. La carte affichait « bientôt disponible »
        // alors que le chiffre existait déjà.
        supabase
          .from("shop_page_views")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id),
      ]);

    const ordersStats = ordersStatsResult.data ?? [];
    ordersCount = ordersStats.length;
    totalRevenue = ordersStats
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    productsCount = productsResult.count ?? 0;
    recentOrders = (recentOrdersResult.data ?? []) as OrderRow[];
    viewsCount = viewsResult.count ?? 0;
  }

  const currency = shop?.currency ?? "XOF";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className="text-[12px] font-bold uppercase capitalize tracking-[0.12em]"
            style={{ color: "var(--b-faint)" }}
          >
            {todayLabel}
          </p>
          <h1 className="mt-1.5 text-[27px] font-bold leading-tight tracking-[-0.025em]">
            Bonjour, {displayName}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--b-muted)" }}>
            Voici un aperçu de ta boutique aujourd&apos;hui.
          </p>
        </div>
        {shop?.slug && (
          <a
            href={`/${shop.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group hidden shrink-0 items-center gap-2 rounded-[var(--r-full)] border border-[var(--b-line)] bg-white px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:border-[var(--b-ink)] sm:flex"
          >
            <EyeIcon className="size-4" />
            Voir ma page
            <ArrowRightIcon className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </a>
        )}
      </div>

      {/* Unpublished shop alert */}
      {shop && !shop.is_published && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-primary/10 px-5 py-4">
          <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-foreground" />
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Ta boutique n&apos;est pas encore publiée
              </p>
              <p className="mt-0.5 text-xs text-foreground/70">
                Active ta boutique pour que tes clients puissent la voir et commander.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 border-0 rounded-xl font-semibold"
              asChild
            >
              <Link href="/dashboard/shop">Publier ma boutique</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Les quatre tuiles de la maquette : le revenu en citron, l'essentiel
          en blanc, les visites en encre. */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile
          label="Revenu total"
          value={formatCurrency(totalRevenue, currency)}
          note={ordersCount === 0 ? "aucune vente pour l'instant" : "payé"}
          tone="lime"
        />
        <Tile
          label="Commandes"
          value={ordersCount}
          note={ordersCount === 0 ? "aucune commande" : "au total"}
          tone="paper"
        />
        <Tile
          label="Produits"
          value={productsCount}
          note={productsCount === 0 ? "ajoute ton premier produit" : "en ligne"}
          tone="paper"
        />
        <Tile
          label="Visites"
          value={viewsCount}
          note="sur ta page"
          tone="ink"
        />
      </div>

      {/* Orders + Quick actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2 rounded-2xl overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[15px] font-bold tracking-tight">
                  Commandes récentes
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Tes 5 dernières commandes
                </CardDescription>
              </div>
              {recentOrders.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/8 rounded-lg"
                >
                  <Link href="/dashboard/orders">
                    Voir tout
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted shadow-sm">
                  <InboxIcon className="size-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Aucune commande pour l&apos;instant
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                    Partage ta boutique pour recevoir tes premières commandes.
                  </p>
                </div>
                {shop?.slug && (
                  <Button size="sm" variant="outline" asChild className="rounded-xl">
                    <Link href="/dashboard/shop">Partager ma boutique</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <th className="px-5 py-3 text-left">Commande</th>
                      <th className="px-5 py-3 text-left">Client</th>
                      <th className="px-5 py-3 text-right">Montant</th>
                      <th className="px-5 py-3 text-left">Statut</th>
                      <th className="px-5 py-3 text-right hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors duration-150 cursor-default"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">
                          {shortId(order.id)}
                        </td>
                        <td className="px-5 py-3.5 max-w-[140px]">
                          <p className="truncate font-semibold text-sm">{order.buyer_name}</p>
                          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                            {order.buyer_email}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-right font-black tabular-nums text-sm">
                          {formatCurrency(order.total_amount, order.currency)}
                        </td>
                        <td className="px-5 py-3.5">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground hidden sm:table-cell">
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
        <Card className="rounded-2xl overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <CardTitle className="text-[15px] font-bold tracking-tight">
              Actions rapides
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Gérer ta boutique en un clic
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-4">
            <Button
              className="w-full justify-start gap-3 h-10 font-semibold rounded-xl"
              asChild
            >
              <Link href="/dashboard/products/new">
                <PlusIcon className="size-4" />
                Ajouter un produit
              </Link>
            </Button>
            {shop?.slug && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-10 rounded-xl"
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
              className="w-full justify-start gap-3 h-10 rounded-xl"
              asChild
            >
              <Link href="/dashboard/orders">
                <ShoppingBagIcon className="size-4" />
                Voir les commandes
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-10 rounded-xl"
              asChild
            >
              <Link href="/dashboard/analytics">
                <BarChart3Icon className="size-4" />
                Analytiques
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Boost */}
      {shop?.id && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <BoostCard shopId={shop.id} featuredUntil={shop.featured_until} />
          </div>
        </div>
      )}
    </div>
  );
}
