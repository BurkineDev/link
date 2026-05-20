import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// POST /api/webhooks/pawapay
// PawaPay sends deposit status updates to this endpoint.
// Configure callback URL in PawaPay dashboard:
//   https://<your-domain>/api/webhooks/pawapay
// ---------------------------------------------------------------------------

interface PawaPayDepositCallback {
  depositId: string;
  status: "COMPLETED" | "FAILED" | "DUPLICATE_IGNORED";
  requestedAmount: string;
  depositedAmount?: string;
  currency: string;
  correspondent?: string;
  payer?: { type: string; address: { value: string } };
  customerTimestamp?: string;
  created?: string;
  respondedByPayer?: string;
  correspondentIds?: Record<string, string>;
  failureReason?: { failureCode: string; failureMessage: string };
  metadata?: Array<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Signature verification
// PawaPay signs callbacks with HMAC-SHA256 using the webhook secret.
// Header: x-pawapay-signature
// ---------------------------------------------------------------------------

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const webhookSecret = process.env.PAWAPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[pawapay-webhook] PAWAPAY_WEBHOOK_SECRET not configured");
    return new NextResponse(null, { status: 500 });
  }

  const signature = request.headers.get("x-pawapay-signature");

  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    console.warn("[pawapay-webhook] invalid or missing signature");
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const deposit = payload as PawaPayDepositCallback;

  if (!deposit.depositId || !deposit.status) {
    console.warn("[pawapay-webhook] malformed payload", deposit);
    return new NextResponse(null, { status: 400 });
  }

  // Ignore duplicate events
  if (deposit.status === "DUPLICATE_IGNORED") {
    return new NextResponse(null, { status: 200 });
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status")
    .eq("payment_ref", deposit.depositId)
    .maybeSingle();

  if (!order) {
    console.warn("[pawapay-webhook] order not found for depositId:", deposit.depositId);
    return new NextResponse(null, { status: 200 });
  }

  // Idempotency
  if (order.payment_status === "paid") {
    return new NextResponse(null, { status: 200 });
  }

  if (deposit.status === "COMPLETED") {
    const receivedAmount = parseFloat(deposit.depositedAmount ?? deposit.requestedAmount);
    const amountOk = receivedAmount >= order.total_amount;
    const currencyOk =
      deposit.currency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn("[pawapay-webhook] amount/currency mismatch for order:", order.id);
      return new NextResponse(null, { status: 200 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", order.id);

    if (error) {
      console.error("[pawapay-webhook] DB update error:", error);
      return new NextResponse(null, { status: 500 });
    }

    console.info(`[pawapay-webhook] order ${order.id} confirmed. deposit=${deposit.depositId}`);
  } else if (deposit.status === "FAILED") {
    await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);

    console.info(`[pawapay-webhook] order ${order.id} payment failed. reason=${deposit.failureReason?.failureCode}`);
  }

  return new NextResponse(null, { status: 200 });
}
