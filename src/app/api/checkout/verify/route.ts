import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/checkout/verify?deposit_id=XXX
// Called from /checkout/success after PawaPay redirects back.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const depositId = searchParams.get("deposit_id");

    if (!depositId) {
      return NextResponse.json(
        { error: "Paramètre deposit_id manquant." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // -- Find order by deposit_id (stored as payment_ref) ---------------------
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, currency, payment_status, status, items, buyer_name, buyer_email",
      )
      .eq("payment_ref", depositId)
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

    // -- Verify with PawaPay --------------------------------------------------
    const pawapayToken = process.env.PAWAPAY_API_TOKEN;
    const pawapayBaseUrl =
      process.env.PAWAPAY_API_BASE_URL ?? "https://api.sandbox.pawapay.io";

    if (!pawapayToken) {
      console.error("[verify] missing PAWAPAY_API_TOKEN");
      return NextResponse.json(
        { error: "Service de paiement non configuré." },
        { status: 500 },
      );
    }

    const ppRes = await fetch(`${pawapayBaseUrl}/deposits/${encodeURIComponent(depositId)}`, {
      headers: { Authorization: `Bearer ${pawapayToken}` },
    });

    if (!ppRes.ok) {
      console.error("[verify] PawaPay API error:", ppRes.status);
      return NextResponse.json(
        { error: "Impossible de vérifier le paiement auprès de PawaPay." },
        { status: 502 },
      );
    }

    const ppData = await ppRes.json() as Array<{
      depositId: string;
      status: string;
      amount: string;
      currency: string;
    }>;

    // PawaPay returns an array
    const deposit = Array.isArray(ppData) ? ppData[0] : ppData;

    if (!deposit) {
      return NextResponse.json(
        { error: "Dépôt introuvable chez PawaPay." },
        { status: 404 },
      );
    }

    const isCompleted = deposit.status === "COMPLETED";
    const isFailed = deposit.status === "FAILED";
    const amountOk = parseFloat(deposit.amount) >= order.total_amount;
    const currencyOk =
      deposit.currency.toUpperCase() === order.currency.toUpperCase();

    if (isCompleted && amountOk && currencyOk) {
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

    // PENDING / ENQUEUED — payment still in progress
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
