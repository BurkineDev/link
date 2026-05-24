import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe, toStripeAmount } from "@/lib/stripe";
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
  // Only "card" is supported today (Stripe). Mobile Money is planned and
  // will be added via PawaPay/Flutterwave once provider access is granted.
  paymentMethod: z.object({
    type: z.literal("card"),
  }),
  currency: z.string().min(3).max(3).toUpperCase(),
  notes: z.string().max(500).optional(),
});

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

    // Block checkout if the shop owner's subscription is past_due.
    // The subscriptions row uses an admin-only read policy, so we use the
    // admin client here. The check is cheap (single indexed lookup).
    {
      const admin = getAdminClient();
      const { data: ownerSub } = await admin
        .from("creator_subscriptions")
        .select("status")
        .eq("user_id", shop.owner_id)
        .maybeSingle();
      if (ownerSub?.status === "past_due") {
        return NextResponse.json(
          { error: "Cette boutique est temporairement indisponible." },
          { status: 403 },
        );
      }
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

    // -- Atomically reserve stock ---------------------------------------------
    // The reserve_stock RPC locks each product/variant row, validates
    // availability, and decrements stock — all in a single transaction.
    // Untracked stock (stock_quantity = NULL) is treated as unlimited.
    const reservePayload = items.map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      quantity: it.quantity,
    }));

    const { data: reserveResult, error: reserveError } = await supabase.rpc(
      "reserve_stock",
      { items: reservePayload },
    );

    if (reserveError) {
      console.error("[checkout] reserve_stock error:", reserveError);
      return NextResponse.json(
        { error: "Impossible de vérifier le stock. Veuillez réessayer." },
        { status: 500 },
      );
    }

    const reservation = (reserveResult ?? {}) as {
      ok?: boolean;
      reason?: string;
      product_name?: string;
      available?: number;
      requested?: number;
    };

    if (!reservation.ok) {
      const friendlyMessage = (() => {
        switch (reservation.reason) {
          case "insufficient_stock":
            return reservation.product_name
              ? `Stock insuffisant pour « ${reservation.product_name} » (${reservation.available ?? 0} disponible${(reservation.available ?? 0) > 1 ? "s" : ""}).`
              : "Un article est en rupture de stock.";
          case "product_not_found":
          case "variant_not_found":
            return "Un article du panier n'est plus disponible.";
          default:
            return "Stock insuffisant pour finaliser la commande.";
        }
      })();

      return NextResponse.json({ error: friendlyMessage }, { status: 409 });
    }

    // -- Create order in Supabase ---------------------------------------------
    const orderInsert = {
      shop_id: shopId,
      buyer_email: buyerDetails.email,
      buyer_name: buyerDetails.full_name,
      buyer_phone: buyerDetails.phone,
      status: "pending" as const,
      payment_status: "pending" as const,
      payment_provider: "stripe" as const,
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
      // Roll back the stock reservation we just made.
      await supabase.rpc("release_stock", { items: reservePayload });
      return NextResponse.json(
        { error: "Impossible de créer la commande." },
        { status: 500 },
      );
    }

    // -- Initiate Stripe Checkout session ------------------------------------
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    let stripe: ReturnType<typeof getStripe>;

    try {
      stripe = getStripe();
    } catch (err) {
      console.error("[checkout] Stripe is not configured:", err);
      await supabase.rpc("release_stock", { items: reservePayload });
      await supabase
        .from("orders")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "Le service de paiement n'est pas configuré." },
        { status: 500 },
      );
    }

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: buyerDetails.email,
        client_reference_id: order.id,
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/checkout`,
        locale: "fr",
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        // 30-minute expiry — releases reserved stock if the buyer abandons.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          orderId: order.id,
          shopId,
          shopName: shop.name,
        },
        payment_intent_data: {
          metadata: {
            orderId: order.id,
            shopId,
          },
        },
        line_items: orderItems.map((item) => {
          const imageUrl = item.product_snapshot.image_url;
          return {
            quantity: item.quantity,
            price_data: {
              currency: shop.currency.toLowerCase(),
              unit_amount: toStripeAmount(item.unit_price, shop.currency),
              product_data: {
                name: item.product_snapshot.product_name,
                images: imageUrl?.startsWith("https://") ? [imageUrl] : undefined,
              },
            },
          };
        }),
      });
    } catch (err) {
      console.error("[checkout] Stripe session creation failed:", err);
      await supabase.rpc("release_stock", { items: reservePayload });
      await supabase
        .from("orders")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "Impossible d'initialiser le paiement. Veuillez réessayer." },
        { status: 502 },
      );
    }

    if (!checkoutSession.url) {
      console.error("[checkout] Stripe session missing url:", checkoutSession.id);
      await supabase.rpc("release_stock", { items: reservePayload });
      await supabase
        .from("orders")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "Impossible d'initialiser le paiement. Veuillez réessayer." },
        { status: 502 },
      );
    }

    await supabase
      .from("orders")
      .update({ payment_ref: checkoutSession.id })
      .eq("id", order.id);

    return NextResponse.json({
      paymentLink: checkoutSession.url,
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
