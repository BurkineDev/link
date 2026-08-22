import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  BanknoteIcon,
  EyeIcon,
  MousePointerClickIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { OrderRow, OrderStatus, Currency } from "@/lib/types/database";

// ---- helpers ----

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

function getLast30Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---- Revenue bar chart (pure SVG) ----

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
  currency: string;
}

function RevenueBarChart({ data, currency }: RevenueChartProps) {
  const maxVal = Math.max(...data.map((d) => d.revenue), 1);
  const chartHeight = 120;
  const barWidth = 100 / data.length;

  const totalForPeriod = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <span className="text-xs text-muted-foreground">30 derniers jours</span>
        <span className="text-sm font-semibold">
          {formatCurrency(totalForPeriod, currency)}
        </span>
      </div>
      <div className="relative w-full overflow-hidden rounded-lg bg-muted/30" style={{ height: chartHeight + 24 }}>
        <svg
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: chartHeight }}
        >
          {data.map((d, i) => {
            const barH = maxVal > 0 ? (d.revenue / maxVal) * (chartHeight - 8) : 0;
            const x = i * barWidth + barWidth * 0.1;
            const w = barWidth * 0.8;
            const y = chartHeight - barH;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={w}
                height={barH}
                rx="1"
                className="fill-primary/80 hover:fill-primary transition-colors"
              />
            );
          })}
        </svg>
        {/* X axis labels — show only first, mid, last */}
        <div className="flex justify-between px-1 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
              new Date(data[0]?.date ?? new Date()),
            )}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
              new Date(data[Math.floor(data.length / 2)]?.date ?? new Date()),
            )}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
              new Date(data[data.length - 1]?.date ?? new Date()),
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Donut chart (pure SVG/CSS) ----

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#EAB308",
  confirmed: "#3B82F6",
  processing: "#6366F1",
  shipped: "#A855F7",
  delivered: "#22C55E",
  cancelled: "#EF4444",
  refunded: "#9CA3AF",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmées",
  processing: "En traitement",
  shipped: "Expédiées",
  delivered: "Livrées",
  cancelled: "Annulées",
  refunded: "Remboursées",
};

interface DonutChartProps {
  data: { status: OrderStatus; count: number }[];
  total: number;
}

function DonutChart({ data, total }: DonutChartProps) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
        <svg viewBox="0 0 80 80" className="size-20">
          <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="10" strokeOpacity="0.15" />
        </svg>
        <p className="text-sm">Aucune commande</p>
      </div>
    );
  }

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const segments = data
    .filter((d) => d.count > 0)
    .reduce<Array<{ status: OrderStatus; count: number; dash: number; gap: number; offset: number; fraction: number }>>((acc, d) => {
      const fraction = d.count / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const offset = acc.reduce((sum, seg) => sum + seg.dash, 0);
      return [...acc, { ...d, dash, gap, offset, fraction }];
    }, []);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 80 80" className="size-24 shrink-0 -rotate-90">
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={STATUS_COLORS[seg.status]}
            strokeWidth="10"
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset}
          />
        ))}
      </svg>
      <ul className="flex flex-col gap-1.5">
        {segments.map((seg) => (
          <li key={seg.status} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[seg.status] }}
            />
            <span className="text-muted-foreground">
              {STATUS_LABELS[seg.status]}
            </span>
            <span className="ml-auto font-medium">{seg.count}</span>
            <span className="text-muted-foreground">
              ({Math.round(seg.fraction * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Count bar chart (views) ----

/** Same visual language as the revenue chart, for plain counts. */
function CountBarChart({
  data,
  unitLabel,
}: {
  data: { date: string; count: number }[];
  unitLabel: string;
}) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const chartHeight = 120;
  const barWidth = 100 / data.length;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <span className="text-xs text-muted-foreground">30 derniers jours</span>
        <span className="text-sm font-semibold">
          {total.toLocaleString("fr-FR")} {unitLabel}
        </span>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-lg bg-muted/30"
        style={{ height: chartHeight + 24 }}
      >
        <svg
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: chartHeight }}
        >
          {data.map((d, i) => {
            const barH = maxVal > 0 ? (d.count / maxVal) * (chartHeight - 8) : 0;
            const x = i * barWidth + barWidth * 0.1;
            const w = barWidth * 0.8;
            const y = chartHeight - barH;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={w}
                height={barH}
                rx="0.6"
                className="fill-primary"
              />
            );
          })}
        </svg>
        <div className="flex justify-between px-1 pt-1 text-[10px] text-muted-foreground">
          <span>{data[0]?.date.slice(5)}</span>
          <span>{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Page ----

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();

  if (!shop) redirect("/dashboard");

  const currency: Currency = shop.currency;

  const days30 = getLast30Days();
  const cutoffDay = dayKey(days30[0]);

  // Orders + bio-page analytics, fetched together
  const [ordersResult, viewsResult, linksResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_amount, status, items, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shop_page_views")
      .select("day, views")
      .eq("shop_id", shop.id)
      .gte("day", cutoffDay)
      .order("day", { ascending: true }),
    supabase
      .from("shop_links")
      .select("label, click_count, is_active")
      .eq("shop_id", shop.id)
      .order("click_count", { ascending: false }),
  ]);
  const allOrders = ordersResult.data;

  const orders = (allOrders ?? []) as Pick<
    OrderRow,
    "id" | "total_amount" | "status" | "items" | "created_at"
  >[];

  // --- Revenue last 30 days ---
  const revenueByDay: Record<string, number> = {};
  days30.forEach((d) => (revenueByDay[dayKey(d)] = 0));

  const cutoff = days30[0];
  orders.forEach((o) => {
    const d = new Date(o.created_at);
    if (d >= cutoff && o.status !== "cancelled" && o.status !== "refunded") {
      const k = dayKey(d);
      if (k in revenueByDay) revenueByDay[k] += o.total_amount;
    }
  });

  const revenueChartData = days30.map((d) => ({
    date: dayKey(d),
    revenue: revenueByDay[dayKey(d)],
  }));

  // --- Total stats ---
  const validOrders = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded",
  );
  const totalRevenue = validOrders.reduce((s, o) => s + o.total_amount, 0);
  const totalOrders = orders.length;
  const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

  // --- Orders by status ---
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });
  const statusData = (Object.keys(statusCounts) as OrderStatus[]).map((s) => ({
    status: s,
    count: statusCounts[s],
  }));

  // --- Top products ---
  const productSales: Record<
    string,
    { name: string; quantity: number; revenue: number }
  > = {};

  orders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .forEach((o) => {
      (o.items ?? []).forEach((item) => {
        const pid = item.product_id;
        const name = item.product_snapshot.product_name ?? "Produit supprimé";
        if (!productSales[pid]) {
          productSales[pid] = { name, quantity: 0, revenue: 0 };
        }
        productSales[pid].quantity += item.quantity;
        productSales[pid].revenue += item.subtotal;
      });
    });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const maxProductQty = Math.max(...topProducts.map((p) => p.quantity), 1);

  // --- Bio page: views (30 days) + clicks per link ---
  const viewsByDay: Record<string, number> = {};
  days30.forEach((d) => (viewsByDay[dayKey(d)] = 0));
  (viewsResult.data ?? []).forEach((row) => {
    if (row.day in viewsByDay) viewsByDay[row.day] = row.views;
  });
  const viewsChartData = days30.map((d) => ({
    date: dayKey(d),
    count: viewsByDay[dayKey(d)],
  }));
  const totalViews30 = viewsChartData.reduce((s, d) => s + d.count, 0);

  const links = linksResult.data ?? [];
  const totalClicks = links.reduce((s, l) => s + l.click_count, 0);
  const maxLinkClicks = Math.max(...links.map((l) => l.click_count), 1);

  // Paid orders inside the same 30-day window as the views, so the ratio
  // compares like with like.
  const paidOrders30 = validOrders.filter(
    (o) => new Date(o.created_at) >= days30[0],
  ).length;
  const conversion30 =
    totalViews30 > 0 ? (paidOrders30 / totalViews30) * 100 : null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytiques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de tes performances
        </p>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {[
          {
            label: "Revenu total",
            value: formatCurrency(totalRevenue, currency),
            icon: BanknoteIcon,
            color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          },
          {
            label: "Total commandes",
            value: totalOrders,
            icon: ShoppingBagIcon,
            color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            label: "Panier moyen",
            value: formatCurrency(avgOrderValue, currency),
            icon: ReceiptIcon,
            color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
          },
          {
            label: "Vues de la page (30 j)",
            value: totalViews30.toLocaleString("fr-FR"),
            icon: EyeIcon,
            color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
          },
          {
            label: "Conversion (30 j)",
            value: conversion30 === null ? "—" : `${conversion30.toFixed(1).replace(".", ",")} %`,
            icon: TrendingUpIcon,
            color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            sub: conversion30 === null ? "En attente de visites" : "Commandes payées / vues",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
              >
                <stat.icon className="size-5" />
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              {stat.sub && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stat.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Revenus (30 derniers jours)</CardTitle>
            <CardDescription>
              Évolution quotidienne du chiffre d&apos;affaires
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <RevenueBarChart data={revenueChartData} currency={currency} />
          </CardContent>
        </Card>

        {/* Bio page: views */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Vues de la page bio</CardTitle>
            <CardDescription>
              Visiteurs qui ouvrent bio-lien.com/&#8203;ta-boutique
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {totalViews30 === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune visite enregistrée pour l&apos;instant. Partage ton lien
                dans ta bio TikTok ou Instagram !
              </p>
            ) : (
              <CountBarChart data={viewsChartData} unitLabel="vues" />
            )}
          </CardContent>
        </Card>

        {/* Bio page: clicks per link */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Clics par lien</CardTitle>
            <CardDescription>
              {totalClicks.toLocaleString("fr-FR")} clic{totalClicks > 1 ? "s" : ""} au total, depuis la création des liens
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {links.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ajoute des liens dans Réglages → Liens pour voir leurs clics ici.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {links.map((link, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 font-medium">
                        <MousePointerClickIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{link.label}</span>
                        {!link.is_active && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            inactif
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {link.click_count.toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(link.click_count / maxLinkClicks) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders by status */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Commandes par statut</CardTitle>
            <CardDescription>Répartition de toutes les commandes</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <DonutChart data={statusData} total={totalOrders} />
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Top produits</CardTitle>
            <CardDescription>Par nombre d&apos;articles vendus</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune vente pour l&apos;instant
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium max-w-[60%]">
                        {p.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {p.quantity} vendu{p.quantity > 1 ? "s" : ""} ·{" "}
                        {formatCurrency(p.revenue, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(p.quantity / maxProductQty) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
