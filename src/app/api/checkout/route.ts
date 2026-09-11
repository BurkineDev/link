import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveStock, releaseStock } from "@/lib/db/stock";
import { redeemPromoCode, releasePromoRedemption } from "@/lib/db/promo";
import { cancelUnpaidOrder, settlePaidOrder } from "@/lib/db/orders";
import { getStripe, toStripeAmount } from "@/lib/stripe";
import {
  createPayment as createGeniusPayment,
  isGeniusPayConfigured,
  type CreatePaymentInput,
} from "@/lib/geniuspay";
import type { OrderItem } from "@/lib/types/database";
import type { Prisma } from "../../../../prisma/generated/client/client";
import type { Currency } from "@/lib/constants";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

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
      currency,
    } = parsed.data;

    // -- Mobile Money availability ---------------------------------------------
    if (paymentMethod.type === "mobile_money" && !isGeniusPayConfigured()) {
      return NextResponse.json(
        { error: "Le paiement Mobile Money n'est pas encore disponible. Choisis la carte bancaire." },
        { status: 503 },
      );
    }

    // -- Fetch shop info -------------------------------------------------------
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        isPublished: true,
        ownerId: true,
        shippingEnabled: true,
      },
    });

    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    if (!shop.isPublished) {
      return NextResponse.json(
        { error: "Cette boutique n'est pas encore ouverte." },
        { status: 403 },
      );
    }

    if (currency !== shop.currency) {
      return NextResponse.json(
        { error: "La devise du panier ne correspond pas à celle de la boutique." },
        { status: 400 },
      );
    }

    // Block checkout if the shop owner's subscription is past_due.
    const ownerSub = await prisma.creatorSubscription.findUnique({
      where: { userId: shop.ownerId },
      select: { status: true },
    });
    if (ownerSub?.status === "past_due") {
      return NextResponse.json(
        { error: "Cette boutique est temporairement indisponible." },
        { status: 403 },
      );
    }

    // -- Fetch product prices from DB to avoid price tampering -----------------
    const productIds = items.map((i) => i.product_id);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        shopId: true,
        name: true,
        price: true,
        currency: true,
        images: true,
        isPublished: true,
        isDigital: true,
        hasVariants: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // A variant is a priced inventory item of its own. The client-provided
    // variant id therefore has to be resolved and tied back to the selected
    // product before we calculate a centime of the order.
    const variantIds = [
      ...new Set(
        items
          .map((item) => item.variant_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const variants =
      variantIds.length > 0
        ? await prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true, name: true, price: true, sku: true },
          })
        : [];

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    // -- Build order items -----------------------------------------------------
    let subtotalAmount = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Produit introuvable: ${item.product_id}` },
          { status: 400 },
        );
      }
      if (product.shopId !== shopId) {
        return NextResponse.json(
          { error: `Produit introuvable: ${item.product_id}` },
          { status: 400 },
        );
      }
      if (!product.isPublished) {
        return NextResponse.json(
          { error: `Produit indisponible: ${product.name}` },
          { status: 400 },
        );
      }

      const variant = item.variant_id
        ? variantMap.get(item.variant_id)
        : undefined;

      if (product.hasVariants && !variant) {
        return NextResponse.json(
          { error: `Choisissez une variante pour « ${product.name} ».` },
          { status: 400 },
        );
      }

      if (item.variant_id && (!variant || variant.productId !== product.id)) {
        return NextResponse.json(
          { error: `Variante invalide pour « ${product.name} ».` },
          { status: 400 },
        );
      }

      // `Decimal` ou nombre selon la source : `Number()` accepte les deux.
      const unitPrice = Number(variant?.price ?? product.price);
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
          variant_name: variant?.name,
          sku: variant?.sku ?? undefined,
          unit_price: unitPrice,
          currency: (product.currency ?? shop.currency) as Currency,
          image_url: firstImageUrl(product.images),
        },
      });
    }

    // -- Apply promo code (atomic) --------------------------------------------
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    const releasePromo = async () => {
      if (!appliedPromoCode) return;
      try {
        await releasePromoRedemption(shopId, appliedPromoCode);
      } catch (error) {
        console.error("[checkout] release_promo_redemption error:", error);
      }
      appliedPromoCode = null;
    };

    if (promoCode) {
      let redeem: Awaited<ReturnType<typeof redeemPromoCode>>;
      try {
        redeem = await redeemPromoCode(shopId, promoCode.toUpperCase(), subtotalAmount);
      } catch (error) {
        console.error("[checkout] redeem_promo_code error:", error);
        return NextResponse.json(
          { error: "Impossible de valider le code promo." },
          { status: 500 },
        );
      }

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

    const hasPhysicalItems = items.some(
      (item) => !productMap.get(item.product_id)?.isDigital,
    );
    let shippingAmount = 0;

    if (hasPhysicalItems && shop.shippingEnabled) {
      if (!shippingAddress) {
        await releasePromo();
        return NextResponse.json(
          { error: "Une adresse de livraison est requise." },
          { status: 422 },
        );
      }

      let zones: Array<{
        countries: string[];
        rate: unknown;
        freeAbove: unknown;
        currency: string;
      }>;
      try {
        zones = await prisma.shippingZone.findMany({
          where: { shopId, isActive: true },
          select: { countries: true, rate: true, freeAbove: true, currency: true },
        });
      } catch (error) {
        console.error("[checkout] shipping zones error:", error);
        await releasePromo();
        return NextResponse.json(
          { error: "Impossible de calculer la livraison." },
          { status: 500 },
        );
      }

      const country = shippingAddress.country.toUpperCase();
      const zone = zones.find(
        (candidate) =>
          candidate.currency === shop.currency &&
          candidate.countries.map((code) => code.toUpperCase()).includes(country),
      );
      if (!zone) {
        await releasePromo();
        return NextResponse.json(
          { error: "La livraison n'est pas disponible pour ce pays." },
          { status: 422 },
        );
      }
      shippingAmount =
        zone.freeAbove != null && subtotalAmount >= Number(zone.freeAbove)
          ? 0
          : Number(zone.rate);
    }

    const totalAmount = Math.max(
      0,
      subtotalAmount - discountAmount + shippingAmount,
    );

    // -- Atomically reserve stock ---------------------------------------------
    const reservePayload = items.map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      quantity: it.quantity,
    }));

    let reservation: Awaited<ReturnType<typeof reserveStock>>;
    try {
      reservation = await reserveStock(reservePayload);
    } catch (error) {
      console.error("[checkout] reserve_stock error:", error);
      await releasePromo();
      return NextResponse.json(
        { error: "Impossible de vérifier le stock. Veuillez réessayer." },
        { status: 500 },
      );
    }

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

      await releasePromo();
      return NextResponse.json({ error: friendlyMessage }, { status: 409 });
    }

    // -- Create order ---------------------------------------------------------
    const paymentProvider =
      paymentMethod.type === "mobile_money" ? ("geniuspay" as const) : ("stripe" as const);

    // La commande et ses lignes sont créées d'un seul tenant : Prisma
    // enveloppe une création imbriquée dans une transaction. L'ancienne
    // version faisait deux insertions séparées et devait annuler la commande
    // à la main si la seconde échouait.
    //
    // Le montant ne vient pas du client : les prix ont été relus depuis
    // `products`, la boutique vérifiée publiée, et le stock déjà réservé.
    let order: { id: string };
    try {
      order = await prisma.order.create({
        data: {
          shopId,
          buyerEmail: buyerDetails.email,
          buyerName: buyerDetails.full_name,
          buyerPhone: buyerDetails.phone,
          status: "pending",
          paymentStatus: "pending",
          paymentProvider,
          paymentRef: null,
          totalAmount,
          shippingAmount,
          currency: shop.currency,
          items: orderItems as unknown as Prisma.InputJsonValue,
          // Colonne JSON nullable : omettre le champ écrit NULL, comme avant.
          shippingAddress: shippingAddress
            ? (shippingAddress as unknown as Prisma.InputJsonValue)
            : undefined,
          notes: notes ?? null,
          promoCode: appliedPromoCode,
          discountAmount,
          orderItems: {
            create: orderItems.map((item) => ({
              productId: item.product_id,
              variantId: item.variant_id ?? null,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              subtotal: item.subtotal,
              productSnapshot: item.product_snapshot as unknown as Prisma.InputJsonValue,
            })),
          },
        },
        select: { id: true },
      });
    } catch (error) {
      console.error("[checkout] order insert error:", error);
      await releaseStock(reservePayload).catch((releaseError) =>
        console.error("[checkout] release_stock error:", releaseError),
      );
      await releasePromo();
      return NextResponse.json(
        { error: "Impossible de créer la commande." },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Annule la commande et rend stock + promo en une seule transaction.
    const rollback = async () => {
      try {
        await cancelUnpaidOrder(order.id, null, paymentProvider);
      } catch (error) {
        console.error("[checkout] cancel_unpaid_order error:", error);
      }
      // The database transaction has returned the promo use as well.
      appliedPromoCode = null;
    };

    // A 100% promo is a valid free order. Sending a zero-value payment to a
    // gateway would fail, so settle it locally and use the order UUID as the
    // high-entropy verification capability on the success page.
    if (totalAmount === 0) {
      const paymentReference = `promo:${appliedPromoCode ?? "free"}`;
      let settled = false;
      try {
        settled = (await settlePaidOrder(order.id, paymentReference, "free")).settled;
      } catch (error) {
        console.error("[checkout] free order settlement error:", error);
      }
      if (!settled) {
        await rollback();
        return NextResponse.json(
          { error: "Impossible de confirmer la commande gratuite." },
          { status: 500 },
        );
      }
      scheduleAfterResponse(
        () => notifyPaidOrder(order.id),
        (error) => console.warn("[checkout] order notification failed", error),
      );

      return NextResponse.json({
        paymentLink: `${appUrl}/checkout/success?provider=free&order=${order.id}`,
        orderId: order.id,
        provider: "free" as const,
      });
    }

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
          // L'identifiant de commande, pas la référence : celle-ci n'existe
          // qu'après cet appel. Un gabarit `{REFERENCE}` rendait l'URL
          // invalide et Genius Pay la refusait (validation.url).
          success_url: `${appUrl}/checkout/success?provider=geniuspay&order=${order.id}`,
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

        await prisma.order.update({
          where: { id: order.id },
          data: { paymentRef: result.reference },
        });

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
      const stripeCoupon =
        discountAmount > 0
          ? await stripe.coupons.create(
              {
                amount_off: toStripeAmount(discountAmount, shop.currency),
                currency: shop.currency.toLowerCase(),
                duration: "once",
                max_redemptions: 1,
                name: appliedPromoCode
                  ? `Code promo ${appliedPromoCode}`
                  : "Remise Bio-Lien",
                metadata: { orderId: order.id, shopId },
              },
              { idempotencyKey: `order-discount-${order.id}` },
            )
          : null;

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
          ...(shippingAmount > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: shop.currency.toLowerCase(),
                    unit_amount: toStripeAmount(shippingAmount, shop.currency),
                    product_data: { name: "Livraison" },
                  },
                },
              ]
            : []),
        ],
        ...(stripeCoupon
          ? { discounts: [{ coupon: stripeCoupon.id }] }
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

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: checkoutSession.id },
    });

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

/** `images` est un JSON libre : `[{ url }]` en pratique, mais rien ne l'impose. */
function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const first = images[0];
  if (typeof first !== "object" || first === null) return undefined;
  const url = (first as { url?: unknown }).url;
  return typeof url === "string" ? url : undefined;
}
