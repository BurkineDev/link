"use client";

import { getAppLinkDestination, isMobileBrowser, openNativeApp } from "@/lib/links/app-link";

/**
 * Côté navigateur : enregistre la commande WhatsApp puis ouvre la
 * conversation. Si l'enregistrement échoue (réseau, boutique repassée en
 * ligne…), on ouvre quand même WhatsApp avec le message d'origine : la vente
 * ne doit jamais dépendre de nous.
 *
 * Sur ordinateur, l'onglet est ouvert AVANT l'appel réseau (un
 * `window.open` après un `await` est bloqué comme pop-up) ; sur mobile, on
 * navigue dans l'onglet courant pour laisser l'app WhatsApp prendre la main.
 */
export interface WhatsAppOrderRequest {
  shopId: string;
  items: Array<{ product_id: string; variant_id?: string | null; quantity: number }>;
  /** Lien wa.me d'origine, sans enregistrement, utilisé en repli. */
  fallbackUrl: string;
}

export async function startWhatsAppOrder(request: WhatsAppOrderRequest): Promise<void> {
  const mobile = typeof navigator !== "undefined" && isMobileBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const tab = mobile ? null : window.open("", "_blank", "noopener,noreferrer");

  let target = request.fallbackUrl;
  try {
    const res = await fetch("/api/orders/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: request.shopId, items: request.items }),
    });
    if (res.ok) {
      const json = (await res.json()) as { wa_url?: string };
      if (json.wa_url) target = json.wa_url;
    }
  } catch {
    // Repli silencieux : WhatsApp s'ouvre sans commande enregistrée.
  }

  if (tab) {
    tab.location.href = target;
    return;
  }
  const destination = getAppLinkDestination(target);
  openNativeApp(destination.nativeUrl, destination.webUrl, {
    androidPackage: destination.androidPackage,
    userAgent: navigator.userAgent,
  });
}
