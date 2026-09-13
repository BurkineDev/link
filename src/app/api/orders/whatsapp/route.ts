import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkStockAvailability } from "@/lib/db/stock";
import { enforceLimits, getClientIp } from "@/lib/rate-limit";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/utils/whatsapp";
import { formatPrice } from "@/lib/utils/format";
import {
  formatWhatsAppOrderMessage,
  orderReference,
  whatsAppUrl,
  type WhatsAppOrderLine,
} from "@/lib/orders/whatsapp-order";
import type { OrderItem } from "@/lib/types/database";
import type { Prisma } from "../../../../../prisma/generated/client/client";
import type { Currency } from "@/lib/constants";

/**
 * POST /api/orders/whatsapp — enregistre une commande passée sur WhatsApp,
 * puis renvoie le lien wa.me à ouvrir (voir src/lib/orders/whatsapp-order.ts).
 *
 * Public et anonyme comme le checkout : les prix sont relus en base, la
 * boutique doit être publiée et en mode WhatsApp avec un numéro valide, le
 * stock réel est vérifié (sans réservation : une commande WhatsApp n'engage
 * rien tant qu'elle n'est pas payée), et une même IP ne crée pas plus de
 * 40 commandes par 10 minutes — plus large que le checkout, parce que les
 * opérateurs mobiles partagent une adresse entre des centaines d'abonnés
 * et qu'au-delà le bouton retombe sur WhatsApp sans enregistrement.
 */

const schema = z.object({
  shopId: z.string().uuid(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().nullable().optional(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(20),
});

const PER_IP = { limit: 40, windowSeconds: 10 * 60 };

function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const first = images[0] as { url?: unknown } | undefined;
  return typeof first?.url === "string" ? first.url : undefined;
}

export async function POST(request: NextRequest) {
  const blocked = await enforceLimits([
    { name: "whatsapp-order:ip", key: getClientIp(request), ...PER_IP },
  ]);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }
  const { shopId, items } = parsed.data;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      slug: true,
      currency: true,
      isPublished: true,
      checkoutMode: true,
      whatsappNumber: true,
      _count: { select: { shippingZones: { where: { isActive: true } } } },
    },
  });
  if (!shop || !shop.isPublished) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }
  if (shop.checkoutMode !== "whatsapp" || !isValidWhatsAppNumber(shop.whatsappNumber)) {
    return NextResponse.json(
      { error: "Cette boutique ne prend pas les commandes sur WhatsApp.", code: "NOT_WHATSAPP_MODE" },
      { status: 409 },
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.product_id) }, shopId, isPublished: true },
    select: { id: true, name: true, price: true, images: true, hasVariants: true, currency: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantIds = items.map((item) => item.variant_id).filter((id): id is string => !!id);
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true, name: true, price: true, sku: true },
      })
    : [];
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const orderItems: OrderItem[] = [];
  const lines: WhatsAppOrderLine[] = [];
  let total = 0;
  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      return NextResponse.json({ error: "Un article du panier n'est plus disponible." }, { status: 400 });
    }
    const variant = item.variant_id ? variantMap.get(item.variant_id) : undefined;
    if ((product.hasVariants && !variant) || (item.variant_id && (!variant || variant.productId !== product.id))) {
      return NextResponse.json({ error: `Choisis une variante pour « ${product.name} ».` }, { status: 400 });
    }
    const unitPrice = Number(variant?.price ?? product.price);
    const subtotal = unitPrice * item.quantity;
    total += subtotal;
    orderItems.push({
      product_id: product.id,
      variant_id: variant?.id ?? undefined,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
      product_snapshot: {
        product_id: product.id,
        product_name: product.name,
        variant_id: variant?.id ?? undefined,
        variant_name: variant?.name,
        sku: variant?.sku ?? undefined,
        unit_price: unitPrice,
        currency: (product.currency ?? shop.currency) as Currency,
        image_url: firstImageUrl(product.images),
      },
    });
    lines.push({ product_name: product.name, variant_name: variant?.name ?? null, quantity: item.quantity, unit_price: unitPrice });
  }

  const availability = await checkStockAvailability(
    items.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id ?? null, quantity: item.quantity })),
    { shopId },
  );
  if (!availability.ok) {
    const message =
      availability.reason === "insufficient_stock"
        ? `Stock insuffisant pour « ${availability.product_name ?? "cet article"} » (${availability.available} disponible${availability.available > 1 ? "s" : ""}).`
        : "Un article du panier n'est plus disponible.";
    return NextResponse.json({ error: message, code: "OUT_OF_STOCK" }, { status: 409 });
  }

  const order = await prisma.order.create({
    data: {
      shopId,
      buyerName: "Client WhatsApp",
      buyerEmail: null,
      buyerPhone: null,
      status: "pending",
      paymentStatus: "pending",
      paymentProvider: "manual",
      totalAmount: total,
      shippingAmount: 0,
      currency: shop.currency,
      items: orderItems as unknown as Prisma.InputJsonValue,
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
      statusEvents: {
        create: {
          status: "pending",
          publicMessage:
            "Commande envoyée au vendeur sur WhatsApp. Il confirme la disponibilité et le paiement dans la conversation.",
        },
      },
    },
    select: { id: true, trackingToken: true },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const reference = orderReference(order.id);
  // L'adresse n'est pas connue : la livraison, si la boutique en facture
  // une, se règle dans la conversation.
  const deliversWithFees = shop._count.shippingZones > 0;
  const message = formatWhatsAppOrderMessage({
    shopName: shop.name,
    lines,
    totalLabel: deliversWithFees
      ? `${formatPrice(total, shop.currency)} (hors livraison)`
      : formatPrice(total, shop.currency),
    reference,
    trackingUrl: `${appUrl}/orders/track/${order.trackingToken}`,
    formatPrice: (amount) => formatPrice(amount, shop.currency),
  });

  return NextResponse.json(
    {
      order_id: order.id,
      reference,
      wa_url: whatsAppUrl(normalizeWhatsAppNumber(shop.whatsappNumber), message),
    },
    { status: 201 },
  );
}
