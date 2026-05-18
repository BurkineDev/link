import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pawaPayDepositWebhookSchema } from "@/lib/validations/checkout";

// POST /api/webhooks/pawapay/deposits
// PawaPay sends deposit status updates to this callback URL.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.warn("[pawapay-webhook] invalid JSON payload", err);
    return new NextResponse(null, { status: 400 });
  }

  const parsed = pawaPayDepositWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[pawapay-webhook] invalid payload", parsed.error.flatten());
    return new NextResponse(null, { status: 400 });
  }

  type PawapayDeposit = {
    id: string;
    status: string;
    amount: string | number;
    currency: string;
    metadata?: Record<string, unknown>;
    failureReason?: { failureMessage?: string };
  };

  const deposit = ((parsed.data as { data?: PawapayDeposit }).data ?? parsed.data) as PawapayDeposit;
  const depositId = deposit.id;
  const depositStatus = String(deposit.status).toUpperCase();
  const depositAmount = Number(deposit.amount);
  const depositCurrency = String(deposit.currency).toUpperCase();
  const metadata = deposit.metadata ?? {};

  const supabase = await createClient();

  const { data: orderByRef, error: orderRefError } = await supabase
    .from("orders")
    .select("id, total_amount, currency, payment_status")
    .eq("payment_ref", depositId)
    .maybeSingle();

  if (orderRefError) {
    console.error("[pawapay-webhook] DB error finding order by payment_ref:", orderRefError);
    return new NextResponse(null, { status: 500 });
  }

  let order = orderByRef;

  if (!order && typeof metadata.orderId === "string") {
    const { data: orderById, error: orderIdError } = await supabase
      .from("orders")
      .select("id, total_amount, currency, payment_status")
      .eq("id", metadata.orderId)
      .maybeSingle();

    if (orderIdError) {
      console.error("[pawapay-webhook] DB error finding order by metadata.orderId:", orderIdError);
      return new NextResponse(null, { status: 500 });
    }

    order = orderById;
  }

  if (!order) {
    return new NextResponse(null, { status: 200 });
  }

  if (order.payment_status === "paid" && depositStatus === "COMPLETED") {
    return new NextResponse(null, { status: 200 });
  }

  if (depositStatus === "COMPLETED") {
    const amountOk = !Number.isNaN(depositAmount) && depositAmount >= order.total_amount;
    const currencyOk = depositCurrency === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      console.warn("[pawapay-webhook] deposit mismatch", { depositAmount, orderAmount: order.total_amount, depositCurrency, orderCurrency: order.currency });
      return new NextResponse(null, { status: 200 });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_ref: depositId,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[pawapay-webhook] failed to update order:", updateError);
      return new NextResponse(null, { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
  }

  if (depositStatus === "FAILED") {
    await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);

    return new NextResponse(null, { status: 200 });
  }

  if (depositStatus === "REFUNDED" || depositStatus === "PARTIALLY_REFUNDED") {
    await supabase
      .from("orders")
      .update({ payment_status: depositStatus === "REFUNDED" ? "refunded" : "partially_refunded" })
      .eq("id", order.id);

    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 200 });
}
