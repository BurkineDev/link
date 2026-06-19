import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe, toStripeAmount } from "@/lib/stripe";
import {
  createPayment as createGeniusPayment,
  isGeniusPayConfigured,
  type CreatePaymentInput,
} from "@/lib/geniuspay";
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
  /**
   * "card"         → Stripe Checkout (Visa, Mastercard)
   * "mobile_money" → Genius Pay (Wave, Orange Money, MTN MoMo, Moov, Free, …)
   *
   * For mobile_money we let Genius Pay pick the rail automatically from the
   * buyer's phone country code; the optional `mobileProvider` overrides that.
   */
  paymentMethod: z.object({
    type: z.enum(["card", "mobile_money"]),
    mobileProvider: z
      .enum(["wave", "orange_money", "mtn_money", "moov_money", "airtel_money"])
      .optional(),
  }),
  currency: z.string().min(3).max(3).toUpperCase(),
  promoCode: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
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
      paymentMethod,
      promoCode,
    } = parsed.data;

    // -- Mobile Money availability ---------------------------------------------
    if (paymentMethod.type === "mobile_money" && !isGeniusPayConfigured()) {
      return NextResponse.json(
        { error: "Le paiement Mobile Money n'est pas encore disponible. Choisis la carte bancaire." },
        { status: 503 },
      );
    }

    // -- Fetch shop info -------------------------------------------------------
    const supabase = await createClient();

    const { data: shop, error: shopError } = (await supabase
      .from("shops")
      .select("id, name, slug, currency, is_published, owner_id")
      .eq("id", shopId)
      .single()) as {
      data: Pick<
        ShopRow,
        "id" | "name" | "slug" | "currency" | "is_published" | "owner_id"
      > | null;
      error: unknown;
    };

    if (shopError || !shop) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    if (!shop.is_published) {
      return NextResponse.json(
        { error: "Cette boutique n'est pas encore ouverte." },
        { status: 403 },
      );
    }

    const admin = getAdminClient();

    // Block checkout if the shop owner's subscription is past_due.
    {
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

    const { data: products, error: productsError } = (await supabase
      .from("products")
      .select("id, name, price, currency, images, is_published, is_digital")
      .in("id", productIds)
      .eq("shop_id", shopId)) as {
      data:
        | Pick<
            ProductRow,
            "id" | "name" | "price" | "currency" | "images" | "is_published" | "is_digital"
          >[]
        | null;
      error: unknown;
    };

    if (productsError || !products) {
      return NextResponse.json(
        { error: "Impossible de récupérer les produits." },
        { status: 500 },
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Any cart item whose product was deleted, unpublished, or belongs to a
    // different shop is "unavailable". Report them all at once with a code the
    // client can act on (drop them from the cart) — never surface a raw UUID.
    const unavailableProductIds = [
      ...new Set(
        items
          .filter((item) => {
            const p = productMap.get(item.product_id);
            return !p || !p.is_published;
          })
          .map((item) => item.product_id),
      ),
    ];

    if (unavailableProductIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Certains articles ne sont plus disponibles. Ils ont été retirés de ton panier — vérifie ta commande puis réessaie.",
          code: "ITEMS_UNAVAILABLE",
          unavailableProductIds,
        },
        { status: 409 },
      );
    }

    // -- Build order items -----------------------------------------------------
    let subtotalAmount = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) continue; // unreachable: validated above; keeps types happy

      const unitPrice = product.price;
      const subtotal = unitPrice * item.quantity;
      subtotalAmount += subtotal;

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

    // -- Apply promo code (atomic) --------------------------------------------
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    if (promoCode) {
      const { data: redeemResult, error: redeemError } = await admin.rpc(
        "redeem_promo_code",
        {
          p_shop_id: shopId,
          p_code: promoCode.toUpperCase(),
          p_order_total: subtotalAmount,
        },
      );

      if (redeemError) {
        console.error("[checkout] redeem_promo_code error:", redeemError);
        return NextResponse.json(
          { error: "Impossible de valider le code promo." },
          { status: 500 },
        );
      }

      const redeem = (redeemResult ?? {}) as {
        ok?: boolean;
        reason?: string;
        discount?: number;
        min_order_amount?: number;
      };

      if (!redeem.ok) {
        const message =
          redeem.reason === "not_found"
            ? "Code promo introuvable."
            : redeem.reason === "expired"
              ? "Ce code promo est expiré."
              : redeem.reason === "max_uses_reached"
                ? "Ce code promo a atteint sa limite d'utilisations."
                : redeem.reason === "min_order_not_met"
                  ? `Montant minimum non atteint pour ce code (${redeem.min_order_amount ?? "-"}).`
                  : "Code promo invalide.";
        return NextResponse.json({ error: message, code: "PROMO_INVALID" }, { status: 400 });
      }

      discountAmount = Math.max(0, Math.min(subtotalAmount, redeem.discount ?? 0));
      appliedPromoCode = promoCode.toUpperCase();
    }

    const totalAmount = Math.max(0, subtotalAmount - discountAmount);

    // Online payment providers reject a zero charge. This usually means every
    // item is priced at 0 — surface a clear message instead of a cryptic
    // provider error further down.
    if (totalAmount <= 0) {
      return NextResponse.json(
        {
          error:
            "Le montant à payer est de 0. Vérifie le prix de tes articles avant de continuer.",
        },
        { status: 400 },
      );
    }

    // -- Atomically reserve stock ---------------------------------------------
    const reservePayload = items.map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      quantity: it.quantity,
    }));

    // reserve_stock requires service_role since 006_security_hardening
    // revoked EXECUTE from public roles. The check is still safe — the
    // RPC validates ownership-agnostic stock levels, never auth state.
    const { data: reserveResult, error: reserveError } = await admin.rpc(
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
      payment_provider:
        paymentMethod.type === "mobile_money"
          ? ("geniuspay" as const)
          : ("stripe" as const),
      payment_ref: null,
      total_amount: totalAmount,
      currency: shop.currency,
      items: orderItems as OrderItem[],
      shipping_address: (shippingAddress ?? null) as ShippingAddress | null,
      notes: notes ?? null,
      promo_code: appliedPromoCode,
      discount_amount: discountAmount,
    } satisfies OrderInsert;

    const { data: order, error: orderError } = (await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (orderError || !order) {
      console.error("[checkout] order insert error:", orderError);
      await admin.rpc("release_stock", { items: reservePayload });
      return NextResponse.json(
        { error: "Impossible de créer la commande." },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const rollback = async () => {
      await admin.rpc("release_stock", { items: reservePayload });
      await supabase
        .from("orders")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", order.id);
    };

    // -- Route to the right payment provider ----------------------------------
    if (paymentMethod.type === "mobile_money") {
      try {
        const payload: CreatePaymentInput = {
          amount: Math.round(totalAmount),
          currency: shop.currency,
          description: `Commande ${shop.name}`,
          customer: {
            name: buyerDetails.full_name,
            email: buyerDetails.email,
            phone: buyerDetails.phone,
            country: shippingAddress?.country,
          },
          payment_method: paymentMethod.mobileProvider,
          success_url: `${appUrl}/checkout/success?provider=geniuspay&reference={REFERENCE}`,
          error_url: `${appUrl}/checkout?cancelled=1`,
          metadata: {
            orderId: order.id,
            shopId,
            shopName: shop.name,
          },
        };

        const result = await createGeniusPayment(payload);
        const paymentLink = result.payment_url ?? result.checkout_url;

        if (!paymentLink) {
          console.error(
            "[checkout] Genius Pay returned no payment URL:",
            result.reference,
          );
          await rollback();
          return NextResponse.json(
            { error: "Impossible d'initialiser le paiement Mobile Money." },
            { status: 502 },
          );
        }

        await supabase
          .from("orders")
          .update({ payment_ref: result.reference })
          .eq("id", order.id);

        // Replace the literal placeholder in success_url so the page can
        // verify the right transaction (Genius Pay does NOT expand it for us).
        return NextResponse.json({
          paymentLink: paymentLink,
          orderId: order.id,
          reference: result.reference,
          provider: "geniuspay" as const,
        });
      } catch (err) {
        console.error("[checkout] Genius Pay create failed:", err);
        await rollback();
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Impossible d'initialiser le paiement Mobile Money.",
          },
          { status: 502 },
        );
      }
    }

    // -- Card → Stripe Checkout -----------------------------------------------
    let stripe: ReturnType<typeof getStripe>;
    try {
      stripe = getStripe();
    } catch (err) {
      console.error("[checkout] Stripe is not configured:", err);
      await rollback();
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
        cancel_url: `${appUrl}/checkout?cancelled=1`,
        locale: "fr",
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          orderId: order.id,
          shopId,
          shopName: shop.name,
        },
        payment_intent_data: {
          metadata: { orderId: order.id, shopId },
        },
        line_items: [
          // Goods
          ...orderItems.map((item) => {
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
          // Promo line item (negative discount via Stripe coupon would be cleaner,
          // but inline price_data must stay positive — we apply the discount as
          // a separate negative-priced row using Stripe's "discounts" parameter
          // when STRIPE_COUPON_ID is provided. Until then, we just store the
          // discount in the DB and surface it on the order summary client-side.)
          // -- See order.discount_amount for the source of truth. --
        ],
        ...(discountAmount > 0 && process.env.STRIPE_COUPON_ID
          ? { discounts: [{ coupon: process.env.STRIPE_COUPON_ID }] }
          : {}),
      });
    } catch (err) {
      console.error("[checkout] Stripe session creation failed:", err);
      await rollback();
      return NextResponse.json(
        { error: "Impossible d'initialiser le paiement. Veuillez réessayer." },
        { status: 502 },
      );
    }

    if (!checkoutSession.url) {
      console.error("[checkout] Stripe session missing url:", checkoutSession.id);
      await rollback();
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
      provider: "stripe" as const,
    });
  } catch (err) {
    console.error("[checkout] unexpected error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
