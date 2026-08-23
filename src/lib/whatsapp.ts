/**
 * WhatsApp helpers.
 *
 * Two integrations are supported:
 *
 * 1. wa.me click-to-chat link — works WITHOUT any API key. The buyer (or
 *    the seller, from their order email/dashboard) opens a pre-filled
 *    WhatsApp conversation. This is the default fallback.
 *
 * 2. WhatsApp Cloud API (Meta) — when both `WHATSAPP_PHONE_NUMBER_ID` and
 *    `WHATSAPP_ACCESS_TOKEN` are set in the environment, we can push a
 *    template message directly to the seller. Otherwise we no-op.
 */

const CLOUD_API_BASE = "https://graph.facebook.com/v19.0";

export function isWhatsAppCloudConfigured(): boolean {
  return (
    !!process.env.WHATSAPP_PHONE_NUMBER_ID &&
    !!process.env.WHATSAPP_ACCESS_TOKEN
  );
}

/** Clean a raw phone number → digits only (E.164-friendly minus the "+"). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Build a click-to-chat URL: https://wa.me/<phone>?text=<msg>. */
export function buildWaMeLink(phone: string, message: string): string {
  const clean = normalizePhone(phone);
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Format the seller-side notification body for a paid order. */
export function formatOrderMessageForSeller(args: {
  shopName: string;
  buyerName: string;
  buyerPhone?: string | null;
  totalLabel: string;
  itemCount: number;
  orderUrl: string;
}): string {
  const { shopName, buyerName, buyerPhone, totalLabel, itemCount, orderUrl } = args;
  return [
    `🛍️ Nouvelle commande sur ${shopName} !`,
    "",
    `Client : ${buyerName}${buyerPhone ? ` (${buyerPhone})` : ""}`,
    `Articles : ${itemCount}`,
    `Total : ${totalLabel}`,
    "",
    `Voir le détail : ${orderUrl}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Cloud API — template messages
// ---------------------------------------------------------------------------
// Business-initiated messages (which an order notification is) are only
// deliverable through a pre-approved template, unless the seller has messaged
// the business within the last 24 hours. Free text outside that window is
// rejected by Meta (error 131047), so the notification flow tries the
// template first and only falls back to free text — which will land whenever
// a service window happens to be open.

/** Name of the approved template used for order alerts (see README). */
export function orderTemplateName(): string {
  return process.env.WHATSAPP_ORDER_TEMPLATE ?? "nouvelle_commande";
}

export function orderTemplateLang(): string {
  return process.env.WHATSAPP_TEMPLATE_LANG ?? "fr";
}

export interface OrderTemplateParams {
  buyerLabel: string;
  itemCount: number;
  totalLabel: string;
  orderShortId: string;
}

/**
 * Builds the Cloud API payload for the order-alert template.
 *
 * The template's body must declare four parameters, in this order:
 *   {{1}} buyer ("Awa Diallo (+226 70 00 00 00)")
 *   {{2}} item count
 *   {{3}} total ("12 500 FCFA")
 *   {{4}} order reference ("A1B2C3D4")
 * Meta rejects template parameters containing URLs or newlines, so the
 * dashboard link must live in the template's static text.
 */
export function buildOrderTemplatePayload(
  to: string,
  params: OrderTemplateParams,
): Record<string, unknown> {
  const text = (value: string) => ({
    type: "text",
    // Newlines/tabs/4+ spaces are rejected by the API inside parameters.
    text: value.replace(/\s+/g, " ").trim(),
  });

  return {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name: orderTemplateName(),
      language: { code: orderTemplateLang() },
      components: [
        {
          type: "body",
          parameters: [
            text(params.buyerLabel),
            text(String(params.itemCount)),
            text(params.totalLabel),
            text(params.orderShortId),
          ],
        },
      ],
    },
  };
}

async function postCloudApi(payload: Record<string, unknown>): Promise<boolean> {
  const url = `${CLOUD_API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[whatsapp] cloud API responded", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[whatsapp] cloud API request failed", err);
    return false;
  }
}

/**
 * Send the order-alert template. Returns `false` when the API isn't
 * configured or Meta refuses the send (unknown template, bad params…).
 */
export async function sendOrderTemplate(
  to: string,
  params: OrderTemplateParams,
): Promise<boolean> {
  if (!isWhatsAppCloudConfigured()) return false;
  return postCloudApi(buildOrderTemplatePayload(to, params));
}

/**
 * Send a text message via the WhatsApp Cloud API. Returns `false` if the
 * API isn't configured or the request fails — the caller can decide
 * whether to fall back to a wa.me link (e.g. in an email).
 *
 * Only deliverable inside an open 24h customer-service window — use
 * `sendOrderTemplate` for business-initiated notifications.
 */
export async function sendCloudApiMessage(args: {
  to: string;
  body: string;
}): Promise<boolean> {
  if (!isWhatsAppCloudConfigured()) return false;
  return postCloudApi({
    messaging_product: "whatsapp",
    to: normalizePhone(args.to),
    type: "text",
    text: { body: args.body },
  });
}
