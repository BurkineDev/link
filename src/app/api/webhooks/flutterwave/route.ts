import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  flutterwaveWebhookSchema,
  type FlutterwaveWebhookPayload,
} from "@/lib/validations/checkout";

// ---------------------------------------------------------------------------
// POST /api/webhooks/flutterwave
// Flutterwave sends this on every payment event.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // -- 1. Read raw body (needed for HMAC) ------------------------------------
  const rawBody = await request.text();

  // -- 2. Verify HMAC signature ----------------------------------------------
  const signature = request.headers.get("verif-hash");
  const webhookSecret = process.env.FLW_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[flw-webhook] FLW_WEBHOOK_SECRET not configured");
    return new NextResponse(null, { status: 500 });
  }

  if (!signature) {
    return new NextResponse(null, { status: 401 });
  }

  // Flutterwave uses a static secret hash (not an HMAC), but we support both.
  // If the secret starts with "sha256:", treat as HMAC; otherwise compare directly.
  let signatureValid = false;

  if (webhookSecret.startsWith("sha256:")) {
    const secret = webhookSecret.slice(7);
    const expectedSig = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    try {
      signatureValid = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig),
      );
    } catch {
      signatureValid = false;
    }
  } else {
    // Static hash comparison
    try {
      signatureValid = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(webhookSecret),
      );
    } catch {
      signatureValid = false;
    }
  }

  if (!signatureValid) {
    console.warn("[flw-webhook] invalid signature");
    return new NextResponse(null, { status: 401 });
  }

  // -- 3. Parse and validate payload -----------------------------------------
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = flutterwaveWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[flw-webhook] invalid payload", parsed.error.flatten());
    return new NextResponse(null, { status: 400 });
  }

  const webhookPayload: FlutterwaveWebhookPayload = parsed.data;

  // -- 4. Handle only charge.completed events --------------------------------
  if (webhookPayload.event !== "charge.completed") {
    // Acknowledge but do nothing
    return new NextResponse(null, { status: 200 });
  }

  const { data: txData } = webhookPayload;
  const { tx_ref, id: flwTxId, status, amount, currency } = txData;

  // -- 5. Find the order by tx_ref -------------------------------------------
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status")
    .eq("payment_ref", tx_ref)
    .maybeSingle();

  if (orderError) {
    console.error("[flw-webhook] DB error finding order:", orderError);
    return new NextResponse(null, { status: 500 });
  }

  if (!order) {
    // Try extracting orderId from tx_ref: LBK-{uuid}-{timestamp}
    const parts = tx_ref.split("-");
    const possibleOrderId = parts.slice(1, 6).join("-");

    const { data: orderById } = await supabase
      .from("orders")
      .select("id, total_amount, currency, payment_status")
      .eq("id", possibleOrderId)
      .maybeSingle();

    if (!orderById) {
      console.warn("[flw-webhook] order not found for tx_ref:", tx_ref);
      // Return 200 to stop Flutterwave from retrying
      return new NextResponse(null, { status: 200 });
    }

    return await processPayment(
      orderById,
      { status, amount, currency, txRef: tx_ref, flwTxId: String(flwTxId) },
      supabase,
    );
  }

  return await processPayment(
    order,
    { status, amount, currency, txRef: tx_ref, flwTxId: String(flwTxId) },
    supabase,
  );
}

// ---------------------------------------------------------------------------
// Process payment update
// ---------------------------------------------------------------------------

async function processPayment(
  order: {
    id: string;
    total_amount: number;
    currency: string;
    payment_status: string;
  },
  tx: {
    status: string;
    amount: number;
    currency: string;
    txRef: string;
    flwTxId: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<NextResponse> {
  // Idempotency — already processed
  if (order.payment_status === "paid") {
    return new NextResponse(null, { status: 200 });
  }

  const isSuccessful = tx.status === "successful";
  const amountOk = tx.amount >= order.total_amount;
  const currencyOk =
    tx.currency.toUpperCase() === order.currency.toUpperCase();

  if (isSuccessful && amountOk && currencyOk) {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_ref: tx.txRef,
      })
      .eq("id", order.id);

    if (error) {
      console.error("[flw-webhook] failed to update order:", error);
      return new NextResponse(null, { status: 500 });
    }

    console.info(
      `[flw-webhook] order ${order.id} confirmed. flw_tx=${tx.flwTxId}`,
    );
  } else if (tx.status === "failed") {
    await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);

    console.info(`[flw-webhook] order ${order.id} payment failed.`);
  } else {
    console.warn("[flw-webhook] ambiguous tx state:", tx);
  }

  return new NextResponse(null, { status: 200 });
}
