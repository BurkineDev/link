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

/**
 * Send a text message via the WhatsApp Cloud API. Returns `false` if the
 * API isn't configured or the request fails — the caller can decide
 * whether to fall back to a wa.me link (e.g. in an email).
 */
export async function sendCloudApiMessage(args: {
  to: string;
  body: string;
}): Promise<boolean> {
  if (!isWhatsAppCloudConfigured()) return false;

  const url = `${CLOUD_API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(args.to),
        type: "text",
        text: { body: args.body },
      }),
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
