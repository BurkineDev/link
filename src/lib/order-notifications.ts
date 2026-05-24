/**
 * Server-only side effects triggered when an order transitions to "paid".
 * Currently: notify the shop owner on WhatsApp.
 *
 * Designed to be fire-and-forget — callers should not await the result if
 * they're inside a webhook handler that needs to ACK fast. Errors here
 * never propagate to the buyer.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import {
  buildWaMeLink,
  formatOrderMessageForSeller,
  isWhatsAppCloudConfigured,
  sendCloudApiMessage,
} from "@/lib/whatsapp";
import type { OrderItem } from "@/lib/types/database";

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

export async function notifySellerOfPaidOrder(orderId: string): Promise<void> {
  const supabase = getAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, shop_id, total_amount, currency, buyer_name, buyer_phone, items",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return;

  const { data: shop } = await supabase
    .from("shops")
    .select("name, whatsapp_number")
    .eq("id", order.shop_id)
    .maybeSingle();

  if (!shop?.whatsapp_number) return;

  const items = (order.items as OrderItem[]) ?? [];
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
    const sent = await sendCloudApiMessage({ to: shop.whatsapp_number, body });
    if (sent) return;
    // Fall through to logging the wa.me fallback so the seller can act
    // on it manually from a future "Notifications" tab in the dashboard.
  }

  console.info(
    `[order-notifications] WhatsApp fallback for shop ${shop.name}: ${buildWaMeLink(shop.whatsapp_number, body)}`,
  );
}
