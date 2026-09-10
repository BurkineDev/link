import { notFound } from "next/navigation";
import { CheckCircle2Icon, Clock3Icon, PackageCheckIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type {
  Currency,
  DigitalDownloadRow,
  OrderItem,
  OrderStatus,
  OrderStatusEventRow,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";

const LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

function money(amount: number, currency: Currency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XOF" || currency === "XAF" ? 0 : 2,
  }).format(amount);
}

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  // Le jeton de suivi (UUID à forte entropie) est la seule capacité d'accès :
  // l'acheteur n'est pas authentifié.
  const orderRow = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: {
      id: true,
      shopId: true,
      buyerName: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      shippingAmount: true,
      discountAmount: true,
      currency: true,
      items: true,
      createdAt: true,
    },
  });
  if (!orderRow) notFound();

  const [shopRow, eventRows, downloadRows] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: orderRow.shopId },
      select: { name: true, slug: true, logoUrl: true },
    }),
    prisma.orderStatusEvent.findMany({
      where: { orderId: orderRow.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.digitalDownload.findMany({ where: { orderId: orderRow.id } }),
  ]);

  // La page lit la forme Supabase (snake_case).
  const order = {
    id: orderRow.id,
    shop_id: orderRow.shopId,
    buyer_name: orderRow.buyerName,
    status: orderRow.status,
    payment_status: orderRow.paymentStatus,
    total_amount: Number(orderRow.totalAmount),
    shipping_amount: Number(orderRow.shippingAmount),
    discount_amount: Number(orderRow.discountAmount),
    currency: orderRow.currency,
    items: orderRow.items,
    created_at: orderRow.createdAt.toISOString(),
  };
  const shop = shopRow
    ? { name: shopRow.name, slug: shopRow.slug, logo_url: shopRow.logoUrl }
    : null;
  const timeline = eventRows.map((e) => ({
    id: e.id,
    order_id: e.orderId,
    status: e.status,
    note: e.note,
    public_message: e.publicMessage,
    created_by: e.createdBy,
    created_at: e.createdAt.toISOString(),
  })) as OrderStatusEventRow[];
  const digitalDownloads = downloadRows.map((d) => ({
    id: d.id,
    order_id: d.orderId,
    order_item_id: d.orderItemId,
    product_id: d.productId,
    token: d.token,
    file_key: d.fileKey,
    file_name: d.fileName,
    download_count: d.downloadCount,
    download_limit: d.downloadLimit,
    expires_at: d.expiresAt?.toISOString() ?? null,
    last_downloaded_at: d.lastDownloadedAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
  })) as DigitalDownloadRow[];
  const items = (order.items ?? []) as unknown as OrderItem[];

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
              <PackageCheckIcon className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{shop?.name ?? "Bio-Lien"}</p>
              <h1 className="text-xl font-bold">Commande #{order.id.slice(0, 8).toUpperCase()}</h1>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm">Statut actuel</span>
            <span className="font-semibold">{LABELS[order.status]}</span>
          </div>
        </header>

        <section className="rounded-2xl border bg-background p-6 shadow-sm">
          <h2 className="font-semibold">Articles</h2>
          <ul className="mt-4 divide-y">
            {items.map((item, index) => (
              <li key={`${item.product_id}:${item.variant_id ?? index}`} className="flex justify-between gap-4 py-3 text-sm">
                <span>{item.product_snapshot.product_name}{item.product_snapshot.variant_name ? ` — ${item.product_snapshot.variant_name}` : ""} × {item.quantity}</span>
                <strong>{money(item.subtotal, order.currency)}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t pt-4 font-bold">
            <span>Total</span>
            <span>{money(order.total_amount, order.currency)}</span>
          </div>
        </section>

        {digitalDownloads.length > 0 && order.payment_status === "paid" && (
          <section className="rounded-2xl border bg-background p-6 shadow-sm">
            <h2 className="font-semibold">Téléchargements</h2>
            <div className="mt-4 space-y-2">
              {digitalDownloads.map((download) => (
                <a key={download.id} href={`/api/downloads/${download.token}`} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted">
                  <span>{download.file_name ?? "Télécharger le fichier"}</span>
                  <span className="text-xs text-muted-foreground">{download.download_limit - download.download_count} restant(s)</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-background p-6 shadow-sm">
          <h2 className="font-semibold">Suivi</h2>
          <ol className="mt-5 space-y-5">
            {(timeline.length ? timeline : [{ id: "created", status: "pending" as const, public_message: "Commande créée.", created_at: order.created_at }]).map((event) => (
              <li key={event.id} className="flex gap-3">
                {event.status === "delivered" ? <CheckCircle2Icon className="mt-0.5 size-5 text-emerald-600" /> : <Clock3Icon className="mt-0.5 size-5 text-primary" />}
                <div>
                  <p className="text-sm font-semibold">{LABELS[event.status]}</p>
                  <p className="text-sm text-muted-foreground">{event.public_message || "Statut mis à jour."}</p>
                  <time className="mt-1 block text-xs text-muted-foreground">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
