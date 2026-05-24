import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  mapStatusToPaymentStatus,
  verifyWebhookSignature,
  type GeniusPayStatus,
} from "@/lib/geniuspay";
import { notifySellerOfPaidOrder } from "@/lib/order-notifications";
import type { OrderItem } from "@/lib/types/database";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/webhooks/geniuspay
// ---------------------------------------------------------------------------
// Genius Pay POSTs lifecycle events here:
//   payment.initiated | payment.success | payment.failed |
//   payment.cancelled | payment.expired | payment.refunded
//
// The signature is HMAC-SHA256(timestamp + "." + rawJson, webhookSecret).
// We restore reserved stock when a payment fails / expires, and mark
// the order as paid + confirmed on success.
// ---------------------------------------------------------------------------

interface WebhookData {
  reference?: string;
  status?: GeniusPayStatus;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string | number | null> | null;
}

interface WebhookPayload {
  id?: string;
  event?: string;
  timestamp?: number;
  data?: WebhookData;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const event = request.headers.get("x-webhook-event") ?? "";

  if (!verifyWebhookSignature({ rawBody, signature, timestamp })) {
    console.warn("[geniuspay-webhook] invalid signature or stale timestamp");
    return new NextResponse(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Test events have no transaction reference — ack and move on.
  if (event === "webhook.test" || !payload.data?.reference) {
    return new NextResponse(null, { status: 200 });
  }

  const data = payload.data;
  const orderId =
    typeof data.metadata?.orderId === "string"
      ? data.metadata.orderId
      : typeof data.metadata?.order_id === "string"
        ? data.metadata.order_id
        : null;

  if (!orderId) {
    console.warn(
      "[geniuspay-webhook] missing orderId metadata for reference:",
      data.reference,
    );
    return new NextResponse(null, { status: 200 });
  }

  const supabase = getAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status, items")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("[geniuspay-webhook] DB read error:", orderError);
    return new NextResponse(null, { status: 500 });
  }

  if (!order) {
    console.warn(
      "[geniuspay-webhook] order not found for reference:",
      data.reference,
    );
    return new NextResponse(null, { status: 200 });
  }

  // Idempotent — once we've already settled the order, ack and stop.
  if (order.payment_status === "paid" || order.payment_status === "refunded") {
    return new NextResponse(null, { status: 200 });
  }

  const incomingStatus = data.status ?? "pending";
  const nextPaymentStatus = mapStatusToPaymentStatus(incomingStatus);

  if (nextPaymentStatus === "paid") {
    // Sanity check on amount + currency.
    const amountOk =
      typeof data.amount === "number" && data.amount >= order.total_amount;
    const currencyOk =
      !data.currency ||
      data.currency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn(
        "[geniuspay-webhook] amount/currency mismatch for order:",
        order.id,
      );
      return new NextResponse(null, { status: 200 });
    }

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_ref: data.reference,
        payment_provider: "geniuspay",
      })
      .eq("id", order.id);

    if (error) {
      console.error("[geniuspay-webhook] update error:", error);
      return new NextResponse(null, { status: 500 });
    }

    notifySellerOfPaidOrder(order.id).catch((err) =>
      console.warn("[geniuspay-webhook] notify seller failed", err),
    );

    console.info(
      `[geniuspay-webhook] order ${order.id} confirmed via Genius Pay (${data.reference})`,
    );
    return new NextResponse(null, { status: 200 });
  }

  if (nextPaymentStatus === "failed") {
    // Release the stock we reserved at order creation.
    const items = order.items as OrderItem[];
    if (items?.length) {
      const releasePayload = items.map((it) => ({
        product_id: it.product_id,
        variant_id: it.variant_id ?? null,
        quantity: it.quantity,
      }));
      const { error: releaseError } = await supabase.rpc("release_stock", {
        items: releasePayload,
      });
      if (releaseError) {
        console.error("[geniuspay-webhook] release_stock error:", releaseError);
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "failed",
        status: "cancelled",
        payment_ref: data.reference,
        payment_provider: "geniuspay",
      })
      .eq("id", order.id);

    if (error) {
      console.error("[geniuspay-webhook] update error:", error);
      return new NextResponse(null, { status: 500 });
    }

    console.info(
      `[geniuspay-webhook] order ${order.id} marked failed (${incomingStatus})`,
    );
    return new NextResponse(null, { status: 200 });
  }

  // pending / processing → just record the reference + provider.
  await supabase
    .from("orders")
    .update({
      payment_ref: data.reference,
      payment_provider: "geniuspay",
    })
    .eq("id", order.id);

  return new NextResponse(null, { status: 200 });
}
