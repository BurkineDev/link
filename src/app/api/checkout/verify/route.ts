import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/checkout/verify?tx_ref=XXX&transaction_id=YYY
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");

    if (!txRef) {
      return NextResponse.json(
        { error: "Paramètre tx_ref manquant." },
        { status: 400 },
      );
    }

    // -- Look up the order in Supabase by tx_ref (payment_ref) ----------------
    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, currency, payment_status, status, payment_provider, items, buyer_name, buyer_email, buyer_phone",
      )
      .eq("payment_ref", txRef)
      .single();

    if (orderError || !order) {
      // Try matching prefix (tx_ref starts with LBK-{orderId}-...)
      const parts = txRef.split("-");
      // LBK-{uuid_part1}-...-{timestamp} → orderId is parts[1..5] joined
      const possibleOrderId = parts.slice(1, 6).join("-");

      const { data: orderById } = await supabase
        .from("orders")
        .select(
          "id, shop_id, total_amount, currency, payment_status, status, payment_provider, items, buyer_name, buyer_email, buyer_phone",
        )
        .eq("id", possibleOrderId)
        .maybeSingle();

      if (!orderById) {
        return NextResponse.json(
          { error: "Commande introuvable pour cette référence." },
          { status: 404 },
        );
      }

      return await verifyAndUpdate(
        orderById,
        txRef,
        transactionId,
        supabase,
      );
    }

    return await verifyAndUpdate(order, txRef, transactionId, supabase);
  } catch (err) {
    console.error("[verify] unexpected error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Verify with Flutterwave and update order
// ---------------------------------------------------------------------------

async function verifyAndUpdate(
  order: {
    id: string;
    shop_id: string;
    total_amount: number;
    currency: string;
    payment_status: string;
    status: string;
    payment_provider: string | null;
    items: unknown;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string | null;
  },
  txRef: string,
  transactionId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<NextResponse> {
  // If already paid, return order details immediately
  if (order.payment_status === "paid") {
    const { data: shop } = await supabase
      .from("shops")
      .select("name, slug")
      .eq("id", order.shop_id)
      .single();

    return NextResponse.json({
      order: {
        ...order,
        shop_name: shop?.name,
        shop_slug: shop?.slug,
      },
    });
  }

  if (order.payment_provider === "pawapay") {
    const pawaPayBaseUrl =
      process.env.PAWAPAY_API_BASE_URL ?? "https://api.sandbox.pawapay.io";
    const verifyRes = await fetch(`${pawaPayBaseUrl}/v2/deposits/${encodeURIComponent(txRef)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
      },
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error("[verify] pawaPay lookup error:", verifyData);
      return NextResponse.json(
        { error: "Échec de la vérification du paiement auprès de pawaPay." },
        { status: 502 },
      );
    }

    const deposit = verifyData?.data;
    const depositStatus = deposit?.status;
    const depositAmount = Number(deposit?.amount);
    const depositCurrency = deposit?.currency;
    const failureMessage = deposit?.failureReason?.failureMessage;

    if (!deposit || !depositStatus) {
      return NextResponse.json(
        {
          error:
            "Impossible de récupérer l'état du paiement. Veuillez réessayer plus tard.",
        },
        { status: 502 },
      );
    }

    if (depositStatus !== "COMPLETED") {
      return NextResponse.json(
        {
          error:
            depositStatus === "FAILED"
              ? failureMessage || "Le paiement a échoué."
              : "Le paiement est en cours de traitement. Veuillez patienter.",
        },
        { status: 400 },
      );
    }

    const amountOk = depositAmount >= order.total_amount;
    const currencyOk =
      typeof depositCurrency === "string" &&
      depositCurrency.toUpperCase() === order.currency.toUpperCase();

    if (!amountOk || !currencyOk) {
      return NextResponse.json(
        {
          error: !amountOk
            ? "Le montant reçu est insuffisant."
            : "Devise incorrecte.",
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_ref: txRef,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[verify] order update error:", updateError);
      // Return success anyway — pawaPay confirmed payment
    }

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

  // -- Verify with Flutterwave -----------------------------------------------
  let flwTxId = transactionId;

  // If no transaction_id provided, search by tx_ref
  if (!flwTxId) {
    const searchRes = await fetch(
      `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      },
    );
    const searchData = await searchRes.json();
    const transactions = searchData?.data as Array<{ id: number }> | undefined;
    if (transactions && transactions.length > 0) {
      flwTxId = String(transactions[0].id);
    }
  }

  if (!flwTxId) {
    return NextResponse.json(
      {
        error:
          "Impossible de trouver la transaction. Le paiement est peut-être encore en cours de traitement.",
      },
      { status: 404 },
    );
  }

  const verifyRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${flwTxId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      },
    },
  );

  const verifyData = await verifyRes.json();

  if (!verifyRes.ok || verifyData.status !== "success") {
    return NextResponse.json(
      { error: "Échec de la vérification du paiement auprès de Flutterwave." },
      { status: 502 },
    );
  }

  const txData = verifyData.data as {
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
  };

  // -- Validate the response -------------------------------------------------
  const isSuccessful = txData.status === "successful";
  const amountOk = txData.amount >= order.total_amount;
  const currencyOk =
    txData.currency.toUpperCase() === order.currency.toUpperCase();

  if (!isSuccessful || !amountOk || !currencyOk) {
    return NextResponse.json(
      {
        error: !isSuccessful
          ? "Le paiement n'a pas abouti."
          : !amountOk
          ? "Le montant reçu est insuffisant."
          : "Devise incorrecte.",
      },
      { status: 400 },
    );
  }

  // -- Update order in Supabase ----------------------------------------------
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      payment_ref: txRef,
    })
    .eq("id", order.id);

  if (updateError) {
    console.error("[verify] order update error:", updateError);
    // Return success anyway — Flutterwave confirmed payment
  }

  // Fetch shop for return
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
