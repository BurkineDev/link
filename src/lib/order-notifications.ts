/**
 * Server-only side effects triggered when an order transitions to "paid".
 * Buyer email + seller WhatsApp/email.
 *
 * Designed to be fire-and-forget — callers should not await the result if
 * they're inside a webhook handler that needs to ACK fast. Errors here
 * never propagate to the buyer.
 */

import { prisma } from "@/lib/prisma";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import {
  buildWaMeLink,
  formatOrderMessageForSeller,
  isWhatsAppCloudConfigured,
  sendCloudApiMessage,
  sendOrderTemplate,
} from "@/lib/whatsapp";
import type { OrderItem } from "@/lib/types/database";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";

function formatTotal(amount: number, currency: Currency) {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.XOF;
  const formatted =
    meta.decimals === 0
      ? Math.round(amount).toLocaleString("fr-FR")
      : amount.toLocaleString("fr-FR", {
          minimumFractionDigits: meta.decimals,
          maximumFractionDigits: meta.decimals,
        });
  return `${formatted} ${meta.symbol}`;
}

/**
 * Resolve a sensible URL to point the seller at the order detail page.
 * Uses NEXT_PUBLIC_APP_URL when set, otherwise localhost.
 */
function orderUrl(orderId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/orders?focus=${orderId}`;
}

function publicOrderUrl(trackingToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/orders/track/${trackingToken}`;
}

export async function notifyBuyerOfPaidOrder(orderId: string): Promise<void> {
  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopId: true,
      buyerName: true,
      buyerEmail: true,
      totalAmount: true,
      currency: true,
      items: true,
      trackingToken: true,
    },
  });

  if (!orderRow) return;

  const [shop, downloadRowsRaw] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: orderRow.shopId },
      select: { name: true },
    }),
    prisma.digitalDownload.findMany({
      where: { orderId: orderRow.id },
      select: { token: true, fileName: true, expiresAt: true },
    }),
  ]);

  // Le reste de la fonction lit la forme Supabase (snake_case).
  const order = {
    id: orderRow.id,
    shop_id: orderRow.shopId,
    buyer_name: orderRow.buyerName,
    buyer_email: orderRow.buyerEmail,
    total_amount: Number(orderRow.totalAmount),
    currency: orderRow.currency,
    items: orderRow.items,
    tracking_token: orderRow.trackingToken,
  };
  const downloads = downloadRowsRaw.map((download) => ({
    token: download.token,
    file_name: download.fileName,
    expires_at: download.expiresAt?.toISOString() ?? null,
  }));

  const items = (order.items as unknown as OrderItem[]) ?? [];
  const trackingUrl = publicOrderUrl(order.tracking_token);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const downloadRows = (downloads ?? []).map((download) => ({
    name: download.file_name ?? "Fichier numérique",
    url: `${base}/api/downloads/${download.token}`,
  }));
  const itemText = items
    .map(
      (item) =>
        `• ${item.product_snapshot.product_name}${item.product_snapshot.variant_name ? ` — ${item.product_snapshot.variant_name}` : ""} × ${item.quantity}`,
    )
    .join("\n");
  const downloadsText = downloadRows.length
    ? `\n\nTéléchargements :\n${downloadRows.map((download) => `• ${download.name}: ${download.url}`).join("\n")}`
    : "";

  await sendTransactionalEmail({
    to: order.buyer_email,
    subject: `Commande confirmée chez ${shop?.name ?? "Bio-Lien"}`,
    text: `Bonjour ${order.buyer_name},\n\nTon paiement est confirmé.\n\n${itemText}\n\nTotal : ${formatTotal(order.total_amount, order.currency as Currency)}\n\nSuivre la commande : ${trackingUrl}${downloadsText}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>Paiement confirmé</h1><p>Bonjour ${escapeEmailHtml(order.buyer_name)}, ta commande chez <strong>${escapeEmailHtml(shop?.name ?? "Bio-Lien")}</strong> est confirmée.</p><ul>${items.map((item) => `<li>${escapeEmailHtml(item.product_snapshot.product_name)}${item.product_snapshot.variant_name ? ` — ${escapeEmailHtml(item.product_snapshot.variant_name)}` : ""} × ${item.quantity}</li>`).join("")}</ul><p><strong>Total : ${escapeEmailHtml(formatTotal(order.total_amount, order.currency as Currency))}</strong></p><p><a href="${escapeEmailHtml(trackingUrl)}">Suivre ma commande</a></p>${downloadRows.length ? `<h2>Téléchargements</h2><ul>${downloadRows.map((download) => `<li><a href="${escapeEmailHtml(download.url)}">${escapeEmailHtml(download.name)}</a></li>`).join("")}</ul><p>Ces liens sont personnels et peuvent expirer.</p>` : ""}</div>`,
    idempotencyKey: `order-confirmed/${order.id}`,
  });
}

export async function notifySellerOfPaidOrder(orderId: string): Promise<void> {
  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopId: true,
      totalAmount: true,
      currency: true,
      buyerName: true,
      buyerPhone: true,
      items: true,
    },
  });

  if (!orderRow) return;

  const shopRow = await prisma.shop.findUnique({
    where: { id: orderRow.shopId },
    select: { name: true, whatsappNumber: true },
  });

  // Le reste de la fonction lit la forme Supabase (snake_case).
  const order = {
    id: orderRow.id,
    shop_id: orderRow.shopId,
    total_amount: Number(orderRow.totalAmount),
    currency: orderRow.currency,
    buyer_name: orderRow.buyerName,
    buyer_phone: orderRow.buyerPhone,
    items: orderRow.items,
  };
  const shop = shopRow
    ? { name: shopRow.name, whatsapp_number: shopRow.whatsappNumber }
    : null;

  if (!shop?.whatsapp_number) return;

  const items = (order.items as unknown as OrderItem[]) ?? [];
  const totalLabel = formatTotal(order.total_amount, order.currency as Currency);
  const body = formatOrderMessageForSeller({
    shopName: shop.name,
    buyerName: order.buyer_name,
    buyerPhone: order.buyer_phone,
    totalLabel,
    itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
    orderUrl: orderUrl(order.id),
  });

  if (isWhatsAppCloudConfigured()) {
    // Template first: business-initiated messages outside a 24h service
    // window are only deliverable as pre-approved templates (Meta 131047).
    const buyerLabel = order.buyer_phone
      ? `${order.buyer_name} (${order.buyer_phone})`
      : order.buyer_name;
    const viaTemplate = await sendOrderTemplate(shop.whatsapp_number, {
      buyerLabel,
      itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
      totalLabel,
      orderShortId: order.id.slice(0, 8).toUpperCase(),
    });
    if (viaTemplate) return;

    // Free text lands whenever the seller has messaged the business in the
    // last 24 hours (e.g. a buyer relayed their order confirmation).
    const viaText = await sendCloudApiMessage({ to: shop.whatsapp_number, body });
    if (viaText) return;
  }

  console.info(
    `[order-notifications] WhatsApp fallback for shop ${shop.name}: ${buildWaMeLink(shop.whatsapp_number, body)}`,
  );
}

export async function notifyPaidOrder(orderId: string): Promise<void> {
  const results = await Promise.allSettled([
    notifyBuyerOfPaidOrder(orderId),
    notifySellerOfPaidOrder(orderId),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[order-notifications] delivery failed", result.reason);
    }
  }
}
