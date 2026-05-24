import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fromStripeAmount, getStripe } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// GET /api/checkout/verify?session_id=cs_xxx
// Called from /checkout/success after Stripe redirects back.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Paramètre session_id manquant." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // -- Find order by Checkout Session ID (stored as payment_ref) ------------
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, currency, payment_status, status, items, buyer_name, buyer_email",
      )
      .eq("payment_ref", sessionId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Commande introuvable pour cette référence." },
        { status: 404 },
      );
    }

    // If already confirmed, return immediately (idempotent)
    if (order.payment_status === "paid") {
      const { data: shop } = await supabase
        .from("shops")
        .select("name, slug")
        .eq("id", order.shop_id)
        .single();

      return NextResponse.json({
        order: { ...order, shop_name: shop?.name, shop_slug: shop?.slug },
      });
    }

    // -- Verify with Stripe ---------------------------------------------------
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session.payment_status === "paid";
    const isFailed = session.status === "expired";
    const paidAmount = fromStripeAmount(session.amount_total, order.currency);
    const amountOk = paidAmount !== null && paidAmount >= order.total_amount;
    const currencyOk =
      session.currency?.toUpperCase() === order.currency.toUpperCase();

    if (isPaid && amountOk && currencyOk) {
      await supabase
        .from("orders")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", order.id);

      const { data: shop } = await supabase
        .from("shops")
        .select("name, slug")
        .eq("id", order.shop_id)
        .single();

      return NextResponse.json({
        order: {
          ...order,
          payment_status: "paid",
          status: "confirmed",
          shop_name: shop?.name,
          shop_slug: shop?.slug,
        },
      });
    }

    if (isFailed) {
      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", order.id);

      return NextResponse.json(
        { error: "Le paiement a échoué." },
        { status: 400 },
      );
    }

    if (isPaid && (!amountOk || !currencyOk)) {
      console.warn("[verify] Stripe amount/currency mismatch for order:", order.id);
      return NextResponse.json(
        { error: "Le montant ou la devise du paiement ne correspond pas à la commande." },
        { status: 400 },
      );
    }

    // open / complete but unpaid — payment still in progress
    return NextResponse.json(
      { error: "Le paiement est encore en cours de traitement. Réessayez dans quelques instants." },
      { status: 202 },
    );
  } catch (err) {
    console.error("[verify] unexpected error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
