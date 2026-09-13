/**
 * Server-only side effects triggered when an order transitions to "paid".
 * Buyer email + seller email (always) + seller WhatsApp (when configured).
 *
 * Callers wrap these in `after()` from next/server so the response is sent
 * first and the platform keeps the invocation alive until delivery settles.
 * Errors here never propagate to the buyer.
 */

import { prisma } from "@/lib/prisma";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import {
  buildWaMeLink,
  formatOrderMessageForSeller,
  isWhatsAppCloudConfigured,
  sendCloudApiMessage,
  sendOrderTemplate,
} from "@/lib/whatsapp";
import type { OrderItem } from "@/lib/types/database";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";

function formatTotal(amount: number, currency: Currency) {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.XOF;
  const formatted =
    meta.decimals === 0
      ? Math.round(amount).toLocaleString("fr-FR")
      : amount.toLocaleString("fr-FR", {
          minimumFractionDigits: meta.decimals,
          maximumFractionDigits: meta.decimals,
        });
  return `${formatted} ${meta.symbol}`;
}

/**
 * Resolve a sensible URL to point the seller at the order detail page.
 * Uses NEXT_PUBLIC_APP_URL when set, otherwise localhost.
 */
function orderUrl(orderId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/orders?focus=${orderId}`;
}

function publicOrderUrl(trackingToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/orders/track/${trackingToken}`;
}

export async function notifyBuyerOfPaidOrder(orderId: string): Promise<void> {
  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopId: true,
      buyerName: true,
      buyerEmail: true,
      totalAmount: true,
      currency: true,
      items: true,
      trackingToken: true,
    },
  });

  if (!orderRow) return;

  const [shop, downloadRowsRaw] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: orderRow.shopId },
      select: { name: true },
    }),
    prisma.digitalDownload.findMany({
      where: { orderId: orderRow.id },
      select: { token: true, fileName: true, expiresAt: true },
    }),
  ]);

  // Le reste de la fonction lit la forme Supabase (snake_case).
  const order = {
    id: orderRow.id,
    shop_id: orderRow.shopId,
    buyer_name: orderRow.buyerName,
    buyer_email: orderRow.buyerEmail,
    total_amount: Number(orderRow.totalAmount),
    currency: orderRow.currency,
    items: orderRow.items,
    tracking_token: orderRow.trackingToken,
  };
  const downloads = downloadRowsRaw.map((download) => ({
    token: download.token,
    file_name: download.fileName,
    expires_at: download.expiresAt?.toISOString() ?? null,
  }));

  const items = (order.items as unknown as OrderItem[]) ?? [];
  const trackingUrl = publicOrderUrl(order.tracking_token);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const downloadRows = (downloads ?? []).map((download) => ({
    name: download.file_name ?? "Fichier numérique",
    url: `${base}/api/downloads/${download.token}`,
  }));
  const itemText = items
    .map(
      (item) =>
        `• ${item.product_snapshot.product_name}${item.product_snapshot.variant_name ? ` — ${item.product_snapshot.variant_name}` : ""} × ${item.quantity}`,
    )
    .join("\n");
  const downloadsText = downloadRows.length
    ? `\n\nTéléchargements :\n${downloadRows.map((download) => `• ${download.name}: ${download.url}`).join("\n")}`
    : "";

  // Commande WhatsApp : pas d'e-mail acheteur, la confirmation se fait dans
  // la conversation.
  if (!order.buyer_email) return;

  await sendTransactionalEmail({
    to: order.buyer_email,
    subject: `Commande confirmée chez ${shop?.name ?? "Bio-Lien"}`,
    text: `Bonjour ${order.buyer_name},\n\nTon paiement est confirmé.\n\n${itemText}\n\nTotal : ${formatTotal(order.total_amount, order.currency as Currency)}\n\nSuivre la commande : ${trackingUrl}${downloadsText}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>Paiement confirmé</h1><p>Bonjour ${escapeEmailHtml(order.buyer_name)}, ta commande chez <strong>${escapeEmailHtml(shop?.name ?? "Bio-Lien")}</strong> est confirmée.</p><ul>${items.map((item) => `<li>${escapeEmailHtml(item.product_snapshot.product_name)}${item.product_snapshot.variant_name ? ` — ${escapeEmailHtml(item.product_snapshot.variant_name)}` : ""} × ${item.quantity}</li>`).join("")}</ul><p><strong>Total : ${escapeEmailHtml(formatTotal(order.total_amount, order.currency as Currency))}</strong></p><p><a href="${escapeEmailHtml(trackingUrl)}">Suivre ma commande</a></p>${downloadRows.length ? `<h2>Téléchargements</h2><ul>${downloadRows.map((download) => `<li><a href="${escapeEmailHtml(download.url)}">${escapeEmailHtml(download.name)}</a></li>`).join("")}</ul><p>Ces liens sont personnels et peuvent expirer.</p>` : ""}</div>`,
    idempotencyKey: `order-confirmed/${order.id}`,
  });
}

/** Ce que la commande attend du vendeur : la préparer, ou la préparer ET encaisser. */
export type SellerNotificationMode = "paid" | "cash_on_delivery";

export async function notifySellerOfPaidOrder(orderId: string): Promise<void> {
  return notifySellerOfOrder(orderId, "paid");
}

export async function notifySellerOfOrder(
  orderId: string,
  mode: SellerNotificationMode,
): Promise<void> {
  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopId: true,
      totalAmount: true,
      currency: true,
      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,
      shippingAddress: true,
      items: true,
      stockShortfall: true,
    },
  });

  if (!orderRow) return;

  const shopRow = await prisma.shop.findUnique({
    where: { id: orderRow.shopId },
    select: {
      name: true,
      whatsappNumber: true,
      contactEmail: true,
      owner: { select: { user: { select: { email: true } } } },
    },
  });

  if (!shopRow) return;

  const order = {
    id: orderRow.id,
    total_amount: Number(orderRow.totalAmount),
    currency: orderRow.currency,
    buyer_name: orderRow.buyerName,
    buyer_phone: orderRow.buyerPhone,
    buyer_email: orderRow.buyerEmail,
    items: orderRow.items,
  };
  const shop = {
    name: shopRow.name,
    whatsapp_number: shopRow.whatsappNumber,
    // L'e-mail de contact de la boutique prime ; sinon celui du compte.
    email: shopRow.contactEmail || shopRow.owner?.user?.email || null,
  };

  const items = (order.items as unknown as OrderItem[]) ?? [];
  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);
  const totalLabel = formatTotal(order.total_amount, order.currency as Currency);
  const detailUrl = orderUrl(order.id);
  // Deux acheteurs ont payé le dernier exemplaire : le vendeur doit le savoir
  // avant de préparer la commande.
  const shortfall = Array.isArray(orderRow.stockShortfall)
    ? (orderRow.stockShortfall as unknown as Array<{ product_name: string | null; requested: number; taken: number }>)
    : [];
  const stockWarning = shortfall.length
    ? `Attention : stock insuffisant au moment du paiement — ${shortfall
        .map((item) => `${item.product_name ?? "article"} : ${item.taken} sur ${item.requested} disponible(s)`)
        .join(", ")}. Contacte le client pour livrer plus tard ou remplacer ; pour un remboursement, écris à l'équipe Bio-Lien avec le numéro de commande.`
    : null;

  // 1. E-mail au vendeur, toujours. C'est le seul canal qui ne dépend ni
  //    d'un numéro WhatsApp renseigné ni de l'API Cloud : sans lui, une
  //    commande payée n'était vue que si le vendeur ouvrait son dashboard.
  const results = await Promise.allSettled([
    shop.email
      ? sendSellerEmail({
          mode,
          to: shop.email,
          shopName: shop.name,
          orderId: order.id,
          buyerName: order.buyer_name,
          buyerPhone: order.buyer_phone,
          buyerEmail: order.buyer_email,
          shippingAddress: orderRow.shippingAddress,
          items,
          itemCount,
          totalLabel,
          detailUrl,
          stockWarning,
        })
      : Promise.reject(
          new Error(`shop ${shop.name} has no email (contactEmail/owner) for order ${order.id}`),
        ),
    // 2. WhatsApp, en complément, quand le vendeur a un numéro.
    shop.whatsapp_number
      ? sendSellerWhatsApp({
          whatsappNumber: shop.whatsapp_number,
          shopName: shop.name,
          orderId: order.id,
          buyerName: order.buyer_name,
          buyerPhone: order.buyer_phone,
          itemCount,
          totalLabel,
          detailUrl,
          stockWarning:
            mode === "cash_on_delivery"
              ? [`Paiement à la livraison : ${totalLabel} à encaisser à la remise du colis.`, stockWarning]
                  .filter(Boolean)
                  .join(" ")
              : stockWarning,
        })
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[order-notifications] seller channel failed", result.reason);
    }
  }
}

async function sendSellerEmail(args: {
  mode: SellerNotificationMode;
  to: string;
  shopName: string;
  orderId: string;
  buyerName: string;
  buyerPhone: string | null;
  buyerEmail: string | null;
  shippingAddress: unknown;
  items: OrderItem[];
  itemCount: number;
  totalLabel: string;
  detailUrl: string;
  stockWarning?: string | null;
}): Promise<void> {
  const shortId = args.orderId.slice(0, 8).toUpperCase();
  const address = formatShippingAddress(args.shippingAddress);
  const warningText = args.stockWarning ? `\n\n${args.stockWarning}` : "";
  const warningHtml = args.stockWarning
    ? `<p style="background:#fff3cd;border:1px solid #f0c36d;padding:12px;border-radius:8px"><strong>${escapeEmailHtml(args.stockWarning)}</strong></p>`
    : "";
  const itemText = args.items
    .map(
      (item) =>
        `• ${item.product_snapshot.product_name}${item.product_snapshot.variant_name ? ` — ${item.product_snapshot.variant_name}` : ""} × ${item.quantity}`,
    )
    .join("\n");
  const contactText = [
    `Client : ${args.buyerName}`,
    args.buyerPhone ? `Téléphone : ${args.buyerPhone}` : null,
    args.buyerEmail ? `E-mail : ${args.buyerEmail}` : null,
    address ? `Livraison : ${address}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const contactHtml = [
    `<li>Client : ${escapeEmailHtml(args.buyerName)}</li>`,
    args.buyerPhone
      ? `<li>Téléphone : <a href="https://wa.me/${escapeEmailHtml(args.buyerPhone.replace(/\D/g, ""))}">${escapeEmailHtml(args.buyerPhone)}</a></li>`
      : "",
    args.buyerEmail ? `<li>E-mail : ${escapeEmailHtml(args.buyerEmail)}</li>` : "",
    address ? `<li>Livraison : ${escapeEmailHtml(address)}</li>` : "",
  ].join("");

  const cod = args.mode === "cash_on_delivery";
  const title = cod ? "Nouvelle commande à livrer" : "Nouvelle commande payée";
  const lead = cod
    ? `Un client a commandé <strong>${escapeEmailHtml(args.totalLabel)}</strong> sur <strong>${escapeEmailHtml(args.shopName)}</strong>, à régler à la livraison.`
    : `Un client vient de payer <strong>${escapeEmailHtml(args.totalLabel)}</strong> sur <strong>${escapeEmailHtml(args.shopName)}</strong>.`;
  const footer = cod
    ? "Prépare la commande, livre-la et encaisse à la remise. Une fois l'argent reçu, marque-la payée depuis ton tableau de bord."
    : "Prépare la commande et mets-la à jour depuis ton tableau de bord : le client suit son avancement.";

  await sendTransactionalEmail({
    to: args.to,
    subject: cod
      ? `Nouvelle commande à livrer — ${args.totalLabel} à encaisser (${shortId})`
      : `Nouvelle commande payée — ${args.totalLabel} (${shortId})`,
    text: `${title} sur ${args.shopName} !\n\n${itemText}\n\nTotal : ${args.totalLabel}${cod ? " — à encaisser à la livraison" : ""}\n\n${contactText}${warningText}\n\n${footer}\n\nVoir la commande : ${args.detailUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>${title}</h1><p>${lead}</p><ul>${args.items.map((item) => `<li>${escapeEmailHtml(item.product_snapshot.product_name)}${item.product_snapshot.variant_name ? ` — ${escapeEmailHtml(item.product_snapshot.variant_name)}` : ""} × ${item.quantity}</li>`).join("")}</ul><ul>${contactHtml}</ul>${warningHtml}<p><a href="${escapeEmailHtml(args.detailUrl)}" style="display:inline-block;background:#D9F55C;color:#151020;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Voir la commande ${escapeEmailHtml(shortId)}</a></p><p style="color:#5c5670;font-size:13px">${escapeEmailHtml(footer)}</p></div>`,
    idempotencyKey: `order-seller/${args.orderId}`,
  });
}

async function sendSellerWhatsApp(args: {
  whatsappNumber: string;
  shopName: string;
  orderId: string;
  buyerName: string;
  buyerPhone: string | null;
  itemCount: number;
  totalLabel: string;
  detailUrl: string;
  stockWarning?: string | null;
}): Promise<void> {
  const body =
    formatOrderMessageForSeller({
      shopName: args.shopName,
      buyerName: args.buyerName,
      buyerPhone: args.buyerPhone,
      totalLabel: args.totalLabel,
      itemCount: args.itemCount,
      orderUrl: args.detailUrl,
    }) + (args.stockWarning ? `\n\n⚠️ ${args.stockWarning}` : "");

  // Le template Meta n'a pas de champ pour l'avertissement de stock : quand
  // il y en a un, on passe directement au message texte (délivré dans la
  // fenêtre de 24 h) — l'e-mail porte l'avertissement de toute façon.
  if (isWhatsAppCloudConfigured()) {
    if (!args.stockWarning) {
      // Template first: business-initiated messages outside a 24h service
      // window are only deliverable as pre-approved templates (Meta 131047).
      const buyerLabel = args.buyerPhone
        ? `${args.buyerName} (${args.buyerPhone})`
        : args.buyerName;
      const viaTemplate = await sendOrderTemplate(args.whatsappNumber, {
        buyerLabel,
        itemCount: args.itemCount,
        totalLabel: args.totalLabel,
        orderShortId: args.orderId.slice(0, 8).toUpperCase(),
      });
      if (viaTemplate) return;
    }

    // Free text lands whenever the seller has messaged the business in the
    // last 24 hours (e.g. a buyer relayed their order confirmation).
    const viaText = await sendCloudApiMessage({ to: args.whatsappNumber, body });
    if (viaText) return;
  }

  console.info(
    `[order-notifications] WhatsApp fallback for shop ${args.shopName}: ${buildWaMeLink(args.whatsappNumber, body)}`,
  );
}

function formatShippingAddress(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const parts = ["address_line1", "address", "city", "country"]
    .map((key) => (typeof a[key] === "string" ? (a[key] as string).trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Commande à régler à la livraison : l'acheteur reçoit sa confirmation et
 * son lien de suivi (s'il a laissé un e-mail), le vendeur ce qu'il doit
 * préparer et encaisser.
 */
export async function notifyBuyerOfCashOnDeliveryOrder(orderId: string): Promise<void> {
  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopId: true,
      buyerName: true,
      buyerEmail: true,
      totalAmount: true,
      currency: true,
      items: true,
      trackingToken: true,
    },
  });
  if (!orderRow?.buyerEmail) return;

  const shop = await prisma.shop.findUnique({
    where: { id: orderRow.shopId },
    select: { name: true },
  });
  const items = (orderRow.items as unknown as OrderItem[]) ?? [];
  const totalLabel = formatTotal(Number(orderRow.totalAmount), orderRow.currency as Currency);
  const trackingUrl = publicOrderUrl(orderRow.trackingToken);
  const itemText = items
    .map(
      (item) =>
        `• ${item.product_snapshot.product_name}${item.product_snapshot.variant_name ? ` — ${item.product_snapshot.variant_name}` : ""} × ${item.quantity}`,
    )
    .join("\n");
  const shopName = shop?.name ?? "Bio-Lien";

  await sendTransactionalEmail({
    to: orderRow.buyerEmail,
    subject: `Commande enregistrée chez ${shopName} — à régler à la livraison`,
    text: `Bonjour ${orderRow.buyerName},\n\nTa commande est enregistrée. Tu règles ${totalLabel} à la livraison, en espèces ou en Mobile Money.\n\n${itemText}\n\nSuivre la commande : ${trackingUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>Commande enregistrée</h1><p>Bonjour ${escapeEmailHtml(orderRow.buyerName)}, ta commande chez <strong>${escapeEmailHtml(shopName)}</strong> est enregistrée. Tu règles <strong>${escapeEmailHtml(totalLabel)}</strong> à la livraison, en espèces ou en Mobile Money.</p><ul>${items.map((item) => `<li>${escapeEmailHtml(item.product_snapshot.product_name)}${item.product_snapshot.variant_name ? ` — ${escapeEmailHtml(item.product_snapshot.variant_name)}` : ""} × ${item.quantity}</li>`).join("")}</ul><p><a href="${escapeEmailHtml(trackingUrl)}">Suivre ma commande</a></p></div>`,
    idempotencyKey: `order-cod-buyer/${orderRow.id}`,
  });
}

export async function notifyCashOnDeliveryOrder(orderId: string): Promise<void> {
  const results = await Promise.allSettled([
    notifyBuyerOfCashOnDeliveryOrder(orderId),
    notifySellerOfOrder(orderId, "cash_on_delivery"),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[order-notifications] cod channel failed", result.reason);
    }
  }
}

export async function notifyPaidOrder(orderId: string): Promise<void> {
  const results = await Promise.allSettled([
    notifyBuyerOfPaidOrder(orderId),
    notifySellerOfPaidOrder(orderId),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[order-notifications] delivery failed", result.reason);
    }
  }
}
