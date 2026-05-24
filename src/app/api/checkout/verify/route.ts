import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fromStripeAmount, getStripe } from "@/lib/stripe";
import {
  fetchPayment as fetchGeniusPayment,
  mapStatusToPaymentStatus,
} from "@/lib/geniuspay";

// ---------------------------------------------------------------------------
// GET /api/checkout/verify?session_id=cs_xxx
//   - Stripe : ?session_id=cs_xxx
//   - Genius Pay : ?provider=geniuspay&reference=MTX-XXXXXXXXXX
//
// Called from /checkout/success after the gateway redirects back. Returns
// the order with a confirmed payment_status when verifying succeeds. The
// webhook is the source of truth — this endpoint is a fallback / UX helper
// so the success page can show the correct state without waiting on the
// webhook to fire.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const provider = searchParams.get("provider");
    const reference = searchParams.get("reference");

    const isGenius = provider === "geniuspay" && reference;
    const isStripe = !!sessionId;

    if (!isGenius && !isStripe) {
      return NextResponse.json(
        { error: "Paramètres de vérification manquants." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const lookupRef = (isGenius ? reference : sessionId) as string;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, currency, payment_status, status, items, buyer_name, buyer_email, payment_provider, discount_amount, promo_code",
      )
      .eq("payment_ref", lookupRef)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Commande introuvable pour cette référence." },
        { status: 404 },
      );
    }

    const withShop = async (orderObj: typeof order) => {
      const { data: shop } = await supabase
        .from("shops")
        .select("name, slug")
        .eq("id", orderObj.shop_id)
        .single();
      return { ...orderObj, shop_name: shop?.name, shop_slug: shop?.slug };
    };

    // Already settled — idempotent return.
    if (order.payment_status === "paid") {
      return NextResponse.json({ order: await withShop(order) });
    }

    // --------------------------------------------------------------------- //
    // Genius Pay branch                                                     //
    // --------------------------------------------------------------------- //
    if (isGenius) {
      let payment;
      try {
        payment = await fetchGeniusPayment(reference!);
      } catch (err) {
        console.error("[verify] Genius Pay fetch failed:", err);
        return NextResponse.json(
          { error: "Impossible de vérifier le paiement Mobile Money." },
          { status: 502 },
        );
      }

      const nextStatus = mapStatusToPaymentStatus(payment.status);
      const amountOk = payment.amount >= order.total_amount;
      const currencyOk =
        payment.currency.toUpperCase() === order.currency.toUpperCase();

      if (nextStatus === "paid" && amountOk && currencyOk) {
        await supabase
          .from("orders")
          .update({ payment_status: "paid", status: "confirmed" })
          .eq("id", order.id);
        return NextResponse.json({
          order: await withShop({
            ...order,
            payment_status: "paid",
            status: "confirmed",
          }),
        });
      }

      if (nextStatus === "paid" && (!amountOk || !currencyOk)) {
        console.warn("[verify] Genius Pay mismatch for order:", order.id);
        return NextResponse.json(
          { error: "Le montant ou la devise ne correspond pas à la commande." },
          { status: 400 },
        );
      }

      if (nextStatus === "failed") {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", status: "cancelled" })
          .eq("id", order.id);
        return NextResponse.json({ error: "Le paiement a échoué." }, { status: 400 });
      }

      return NextResponse.json(
        {
          error:
            "Le paiement est encore en cours de traitement. Réessayez dans quelques instants.",
        },
        { status: 202 },
      );
    }

    // --------------------------------------------------------------------- //
    // Stripe branch                                                          //
    // --------------------------------------------------------------------- //
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId!);

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
      return NextResponse.json({
        order: await withShop({
          ...order,
          payment_status: "paid",
          status: "confirmed",
        }),
      });
    }

    if (isFailed) {
      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", order.id);
      return NextResponse.json({ error: "Le paiement a échoué." }, { status: 400 });
    }

    if (isPaid && (!amountOk || !currencyOk)) {
      console.warn("[verify] Stripe amount/currency mismatch for order:", order.id);
      return NextResponse.json(
        { error: "Le montant ou la devise du paiement ne correspond pas à la commande." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Le paiement est encore en cours de traitement. Réessayez dans quelques instants.",
      },
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
