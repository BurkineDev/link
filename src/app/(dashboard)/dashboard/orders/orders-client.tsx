"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InboxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  CreditCardIcon,
} from "lucide-react";
import type { OrderRow, OrderStatus, Currency } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ---- helpers ----

function formatCurrency(amount: number, currency: Currency | string): string {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

// ---- Filter tabs ----

interface FilterTab {
  key: OrderStatus | "all";
  label: string;
}

const FILTER_TABS: FilterTab[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "processing", label: "En traitement" },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En traitement" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
  { value: "refunded", label: "Remboursée" },
];

// ---- Order detail sheet ----

interface OrderDetailSheetProps {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: Currency | string;
  onStatusUpdated: (updatedOrder: OrderRow) => void;
}

function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  currency,
  onStatusUpdated,
}: OrderDetailSheetProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!order) return null;

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order) return;
    setUpdatingStatus(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: newStatus } as any)
      .eq("id", order.id)
      .select()
      .single();

    setUpdatingStatus(false);
    if (!error && data) {
      onStatusUpdated(data as OrderRow);
    }
  }

  const addr = order.shipping_address;
  const itemsCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Commande {shortId(order.id)}</SheetTitle>
          <SheetDescription>{formatDate(order.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {/* Status update */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Statut :</span>
            <OrderStatusBadge status={order.status} />
            <div className="ml-auto">
              <Select
                value={order.status}
                onValueChange={(v) => handleStatusChange(v as OrderStatus)}
                disabled={updatingStatus}
              >
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Changer le statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buyer info */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acheteur
            </h3>
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <p className="font-medium">{order.buyer_name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MailIcon className="size-3.5 shrink-0" />
                <span className="truncate">{order.buyer_email}</span>
              </div>
              {order.buyer_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PhoneIcon className="size-3.5 shrink-0" />
                  <span>{order.buyer_phone}</span>
                </div>
              )}
            </div>
          </section>

          {/* Items */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Produits ({itemsCount} article{itemsCount > 1 ? "s" : ""})
            </h3>
            <div className="flex flex-col gap-2">
              {order.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
                >
                  {item.product_snapshot.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product_snapshot.image_url}
                      alt={item.product_snapshot.product_name}
                      className="size-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <PackageIcon className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.product_snapshot.product_name}
                    </p>
                    {item.product_snapshot.variant_name && (
                      <p className="text-xs text-muted-foreground">
                        {item.product_snapshot.variant_name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Qté : {item.quantity} ×{" "}
                      {formatCurrency(item.unit_price, currency)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(item.subtotal, currency)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Shipping address */}
          {addr && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adresse de livraison
              </h3>
              <div className="rounded-xl border border-border bg-muted/30 p-3 flex gap-3">
                <MapPinIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                <address className="not-italic text-sm leading-relaxed">
                  <p className="font-medium">{addr.full_name}</p>
                  <p>{addr.address_line1}</p>
                  {addr.address_line2 && <p>{addr.address_line2}</p>}
                  <p>
                    {addr.city}
                    {addr.state ? `, ${addr.state}` : ""}
                    {addr.postal_code ? ` ${addr.postal_code}` : ""}
                  </p>
                  <p>{addr.country}</p>
                  {addr.phone && <p>{addr.phone}</p>}
                </address>
              </div>
            </section>
          )}

          {/* Payment info */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paiement
            </h3>
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CreditCardIcon className="size-4 text-muted-foreground" />
                <span className="text-sm capitalize">
                  {order.payment_provider ?? "Non renseigné"}
                </span>
                <span
                  className={cn(
                    "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    order.payment_status === "paid"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : order.payment_status === "failed"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                  )}
                >
                  {order.payment_status === "paid"
                    ? "Payé"
                    : order.payment_status === "failed"
                      ? "Échoué"
                      : order.payment_status === "refunded"
                        ? "Remboursé"
                        : "En attente"}
                </span>
              </div>
              {order.payment_ref && (
                <p className="font-mono text-xs text-muted-foreground">
                  Réf. : {order.payment_ref}
                </p>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg tabular-nums">
                  {formatCurrency(order.total_amount, order.currency)}
                </span>
              </div>
            </div>
          </section>

          {/* Notes */}
          {order.notes && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </h3>
              <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                {order.notes}
              </p>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Main client component ----

interface OrdersClientProps {
  orders: OrderRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  activeStatus: OrderStatus | null;
  currency: Currency | string;
}

export function OrdersClient({
  orders: initialOrders,
  totalCount,
  totalPages,
  currentPage,
  activeStatus,
  currency,
}: OrdersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function setFilter(status: OrderStatus | "all") {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function setPage(page: number) {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  function openOrder(order: OrderRow) {
    setSelectedOrder(order);
    setSheetOpen(true);
  }

  function handleStatusUpdated(updated: OrderRow) {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o)),
    );
    setSelectedOrder(updated);
  }

  const activeKey = activeStatus ?? "all";

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commandes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} commande{totalCount !== 1 ? "s" : ""} au total
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors border",
                activeKey === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Aucune commande trouvée</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeStatus
                  ? "Essaie un autre filtre pour voir tes commandes."
                  : "Tu recevras tes premières commandes ici."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">
                      N° commande
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">
                      Produits
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Montant
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Statut</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => {
                    const itemsCount =
                      order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
                    return (
                      <tr
                        key={order.id}
                        onClick={() => openOrder(order)}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {shortId(order.id)}
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <p className="truncate font-medium">
                            {order.buyer_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.buyer_email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">
                          {itemsCount} art.
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(order.total_amount, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(order.created_at))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} sur {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <OrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currency={currency}
        onStatusUpdated={handleStatusUpdated}
      />
    </>
  );
}
