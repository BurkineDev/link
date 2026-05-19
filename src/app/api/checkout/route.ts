import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  OrderInsert,
  OrderItem,
  ShippingAddress,
  ShopRow,
  ProductRow,
} from "@/lib/types/database";
import type { Currency } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const checkoutRequestSchema = z.object({
  shopId: z.string().uuid("shopId invalide"),
  buyerDetails: z.object({
    full_name: z.string().min(2).max(100).trim(),
    email: z.string().email(),
    phone: z.string().min(6).max(20),
  }),
  shippingAddress: z
    .object({
      full_name: z.string().min(2).max(100).trim(),
      address_line1: z.string().min(5).max(200).trim(),
      address_line2: z.string().max(200).trim().optional(),
      city: z.string().min(2).max(100).trim(),
      state: z.string().max(100).trim().optional(),
      postal_code: z.string().max(20).trim().optional(),
      country: z.string().length(2).toUpperCase(),
      phone: z.string().optional(),
    })
    .nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().nullable().optional(),
        quantity: z.number().int().positive().max(999),
        unit_price: z.number().nonnegative(),
      }),
    )
    .min(1)
    .max(100),
  paymentMethod: z.object({
    type: z.enum(["mobile_money", "card"]),
    mobileProvider: z.string().optional(),
  }),
  currency: z.string().min(3).max(3).toUpperCase(),
  notes: z.string().max(500).optional(),
});

function sanitizePhoneNumber(phone: string) {
  return phone.replace(/[^\d]/g, "").replace(/^00/, "");
}

// ---------------------------------------------------------------------------
// POST /api/checkout
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = checkoutRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      shopId,
      buyerDetails,
      shippingAddress,
      items,
      notes,
    } = parsed.data;

    // -- Fetch shop info -------------------------------------------------------
    const supabase = await createClient();

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, name, slug, currency, is_published, owner_id")
      .eq("id", shopId)
      .single() as { data: Pick<ShopRow, "id" | "name" | "slug" | "currency" | "is_published" | "owner_id"> | null; error: unknown };

    if (shopError || !shop) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    if (!shop.is_published) {
      return NextResponse.json(
        { error: "Cette boutique n'est pas encore ouverte." },
        { status: 403 },
      );
    }

    // -- Fetch product prices from DB to avoid price tampering -----------------
    const productIds = items.map((i) => i.product_id);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, currency, images, is_published, is_digital")
      .in("id", productIds) as { data: Pick<ProductRow, "id" | "name" | "price" | "currency" | "images" | "is_published" | "is_digital">[] | null; error: unknown };

    if (productsError || !products) {
      return NextResponse.json(
        { error: "Impossible de récupérer les produits." },
        { status: 500 },
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // -- Build order items -----------------------------------------------------
    let totalAmount = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Produit introuvable: ${item.product_id}` },
          { status: 400 },
        );
      }
      if (!product.is_published) {
        return NextResponse.json(
          { error: `Produit indisponible: ${product.name}` },
          { status: 400 },
        );
      }

      const unitPrice = product.price;
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id ?? undefined,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        product_snapshot: {
          product_id: item.product_id,
          product_name: product.name,
          variant_id: item.variant_id ?? undefined,
          unit_price: unitPrice,
          currency: (product.currency ?? shop.currency) as Currency,
          image_url: product.images?.[0]?.url,
        },
      });
    }

    // -- Create order in Supabase ----------------------------------------------
    const orderInsert = {
      shop_id: shopId,
      buyer_email: buyerDetails.email,
      buyer_name: buyerDetails.full_name,
      buyer_phone: buyerDetails.phone,
      status: "pending" as const,
      payment_status: "pending" as const,
      payment_provider: "pawapay" as const,
      payment_ref: null,
      total_amount: totalAmount,
      currency: shop.currency,
      items: orderItems as OrderItem[],
      shipping_address: (shippingAddress ?? null) as ShippingAddress | null,
      notes: notes ?? null,
    } satisfies OrderInsert;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single() as { data: { id: string } | null; error: unknown };

    if (orderError || !order) {
      console.error("[checkout] order insert error:", orderError);
      return NextResponse.json(
        { error: "Impossible de créer la commande." },
        { status: 500 },
      );
    }

    // -- Initiate PawaPay payment page session -------------------------------
    const depositId = randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const pawapayToken = process.env.PAWAPAY_API_TOKEN;
    const pawapayBaseUrl = process.env.PAWAPAY_API_BASE_URL ?? "https://api.sandbox.pawapay.io";

    if (!pawapayToken) {
      console.error("[checkout] missing PAWAPAY_API_TOKEN");
      return NextResponse.json(
        { error: "Le service de paiement n'est pas configuré." },
        { status: 500 },
      );
    }

    const paymentPageRequest = {
      depositId,
      returnUrl: `${appUrl}/checkout/success?deposit_id=${depositId}`,
      customerMessage: `Commande #${order.id.slice(0, 8).toUpperCase()}`,
      amountDetails: {
        amount: String(totalAmount),
        currency: shop.currency,
      },
      phoneNumber: sanitizePhoneNumber(buyerDetails.phone),
      language: "FR",
      reason: `Commande #${order.id.slice(0, 8).toUpperCase()}`,
      metadata: [
        { orderId: order.id },
        { shopId },
        { shopName: shop.name },
      ],
    };

    const pawapayRes = await fetch(`${pawapayBaseUrl}/v2/paymentpage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pawapayToken}`,
      },
      body: JSON.stringify(paymentPageRequest),
    });

    const pawapayData = await pawapayRes.json();

    if (!pawapayRes.ok || !pawapayData?.redirectUrl) {
      console.error("[checkout] PawaPay error:", pawapayData);
      return NextResponse.json(
        {
          error:
            "Impossible d'initialiser le paiement. Veuillez réessayer.",
        },
        { status: 502 },
      );
    }

    await supabase
      .from("orders")
      .update({ payment_ref: depositId })
      .eq("id", order.id);

    return NextResponse.json({
      paymentLink: pawapayData.redirectUrl as string,
      orderId: order.id,
    });
  } catch (err) {
    console.error("[checkout] unexpected error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
