import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
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
//
// Uses the ADMIN client on purpose: the buyer is anonymous and the orders
// RLS policies only grant reads to the shop owner, so the anon client sees
// no row and every buyer landed on "commande introuvable" after paying.
// The high-entropy payment_ref (Stripe cs_…, GeniusPay MTX-…) acts as the
// bearer capability, and the status updates only run after the provider
// itself confirmed the payment.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const provider = searchParams.get("provider");
    const reference = searchParams.get("reference");
    const orderId = searchParams.get("order");

    // Genius Pay ne nous donne la référence qu'*après* avoir créé le paiement,
    // alors que l'URL de retour, elle, doit être fournie *pendant*. On y met
    // donc l'identifiant de commande, connu avant l'appel — la référence est
    // ensuite relue depuis la commande. (L'ancienne URL portait un gabarit
    // `{REFERENCE}` que Genius Pay ne remplaçait pas et refusait même de
    // valider : les accolades ne sont pas des caractères d'URL.)
    const isGeniusByOrder =
      provider === "geniuspay" && !!orderId && /^[0-9a-f-]{36}$/i.test(orderId);
    const isGenius = provider === "geniuspay" && (!!reference || isGeniusByOrder);
    const isStripe = !!sessionId;

    if (!isGenius && !isStripe) {
      return NextResponse.json(
        { error: "Paramètres de vérification manquants." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const selection =
      "id, shop_id, total_amount, currency, payment_status, status, items, buyer_name, buyer_email, payment_provider, payment_ref, discount_amount, promo_code";

    const query = supabase.from("orders").select(selection);

    const { data: order, error: orderError } = await (isGeniusByOrder
      ? query.eq("id", orderId!)
      : query.eq("payment_ref", (isGenius ? reference : sessionId) as string)
    ).maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Commande introuvable pour cette référence." },
        { status: 404 },
      );
    }

    const withShop = async (orderObj: typeof order) => {
      const { data: shop } = await supabase
        .from("shops")
        .select("name, slug, whatsapp_number")
        .eq("id", orderObj.shop_id)
        .single();
      // whatsapp_number is already public (it powers the wa.me CTAs on the
      // shop page); exposing it here lets the buyer relay their confirmation.
      return {
        ...orderObj,
        shop_name: shop?.name,
        shop_slug: shop?.slug,
        shop_whatsapp: shop?.whatsapp_number ?? null,
      };
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
        payment = await fetchGeniusPayment(
          reference ?? (order.payment_ref as string),
        );
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

      // Tracé volontairement : une commande bloquée en attente sans aucune
      // trace côté serveur est impossible à diagnostiquer après coup — c'est
      // exactement ce qui s'est passé au premier paiement réel.
      console.info(
        `[verify] order ${order.id} still pending — geniuspay status=${payment.status} ref=${payment.reference} method=${payment.payment_method ?? "?"} provider=${payment.payment_provider ?? "?"}`,
      );

      // 202 — l'opérateur n'a pas encore confirmé. La page de retour reboucle
      // dessus ; on lui rend la référence pour qu'elle puisse l'afficher à
      // l'acheteur, qui en a besoin pour se faire identifier auprès du vendeur.
      return NextResponse.json(
        {
          error:
            "Le paiement est encore en cours de traitement. Réessayez dans quelques instants.",
          reference: payment.reference ?? (order.payment_ref as string | null),
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
