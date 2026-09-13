"use client";

import { getAppLinkDestination, isMobileBrowser, openNativeApp } from "@/lib/links/app-link";

/**
 * Côté navigateur : enregistre la commande WhatsApp puis ouvre la
 * conversation. La vente ne doit jamais dépendre de nous : si
 * l'enregistrement échoue ou traîne (réseau, fonction à froid, boutique
 * repassée en ligne…), WhatsApp s'ouvre quand même avec le message d'origine.
 * Seul un refus métier (variante manquante, article épuisé) n'ouvre rien :
 * l'acheteur doit corriger, sinon le vendeur reçoit un message pour une
 * commande qui n'existe nulle part.
 *
 * Deux contraintes de navigateur dictent la forme du code :
 *
 *   • Sur ordinateur, un `window.open` après un `await` est bloqué comme
 *     pop-up. L'onglet est donc ouvert AVANT l'appel réseau, sans le
 *     feature `noopener` — avec lui, `window.open` renvoie null et l'onglet
 *     resterait vide à jamais. On coupe `opener` à la main.
 *   • Sur mobile, la navigation vers l'app n'est acceptée que dans les
 *     quelques secondes qui suivent le tap (activation transitoire, ~5 s sur
 *     Chrome comme sur WebKit). L'appel réseau est donc borné à
 *     `REGISTER_TIMEOUT_MS` : au-delà, on ouvre WhatsApp sans attendre, sans
 *     référence — mieux qu'un tap qui ne fait rien.
 */
export interface WhatsAppOrderRequest {
  shopId: string;
  items: Array<{ product_id: string; variant_id?: string | null; quantity: number }>;
  /** Lien wa.me d'origine, sans enregistrement, utilisé en repli. */
  fallbackUrl: string;
}

export type WhatsAppOrderOutcome =
  /** Commande enregistrée, WhatsApp ouvert avec la référence. */
  | { ok: true; orderId: string; reference: string }
  /** Refus métier : rien n'est ouvert, l'acheteur doit corriger. */
  | { ok: false; reason: "rejected"; message: string }
  /** Panne ou lenteur : WhatsApp ouvert sans commande enregistrée. */
  | { ok: false; reason: "fallback" };

/** Sous l'activation transitoire des navigateurs mobiles, marge comprise. */
export const REGISTER_TIMEOUT_MS = 3000;

/**
 * Sur Android, délai au bout duquel un intent:// resté sans effet (bloqué
 * faute de geste) laisse place à wa.me dans l'onglet courant.
 */
export const ANDROID_FALLBACK_DELAY_MS = 2000;

type Registration =
  | { status: "ok"; waUrl: string; orderId: string; reference: string }
  | { status: "rejected"; message: string }
  | { status: "failed" };

export async function startWhatsAppOrder(request: WhatsAppOrderRequest): Promise<WhatsAppOrderOutcome> {
  const mobile = typeof navigator !== "undefined" && isMobileBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const tab = mobile ? null : openWaitingTab();

  const registration = await registerOrder(request);

  if (registration.status === "rejected") {
    tab?.close();
    return { ok: false, reason: "rejected", message: registration.message };
  }

  const target = registration.status === "ok" ? registration.waUrl : request.fallbackUrl;

  if (!mobile) {
    // Pop-up bloqué : on navigue dans l'onglet courant plutôt que de ne rien
    // faire. wa.me ouvre WhatsApp Web ou l'app de bureau.
    if (tab) tab.location.href = target;
    else window.location.assign(target);
  } else {
    const destination = getAppLinkDestination(target);
    openNativeApp(destination.nativeUrl, destination.webUrl, {
      androidPackage: destination.androidPackage,
      userAgent: navigator.userAgent,
      androidFallbackDelayMs: ANDROID_FALLBACK_DELAY_MS,
    });
  }

  return registration.status === "ok"
    ? { ok: true, orderId: registration.orderId, reference: registration.reference }
    : { ok: false, reason: "fallback" };
}

/**
 * Onglet ouvert dans le geste du clic, rempli une fois la commande
 * enregistrée. `opener` est coupé pour que la page suivante n'ait pas la
 * main sur la boutique, ce que `noopener` ferait aussi… en nous privant de
 * la référence.
 */
function openWaitingTab(): Window | null {
  let tab: Window | null = null;
  try {
    tab = window.open("", "_blank");
  } catch {
    return null;
  }
  if (!tab) return null;
  try {
    tab.opener = null;
    tab.document.title = "Ouverture de WhatsApp…";
    const notice = tab.document.createElement("p");
    notice.textContent = "Ouverture de WhatsApp…";
    notice.style.cssText = "margin:20vh auto;text-align:center;font:16px system-ui,sans-serif;color:#444";
    tab.document.body.append(notice);
  } catch {
    // La page d'attente est un confort : l'onglet recevra sa destination.
  }
  return tab;
}

async function registerOrder(request: WhatsAppOrderRequest): Promise<Registration> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS) : null;
  try {
    const res = await fetch("/api/orders/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: request.shopId, items: request.items }),
      signal: controller?.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: unknown;
      code?: unknown;
      wa_url?: unknown;
      order_id?: unknown;
      reference?: unknown;
    };

    // Refus métier : la commande telle que composée ne peut pas être servie.
    // Une boutique repassée en ligne (NOT_WHATSAPP_MODE) n'en est pas un :
    // le vendeur a toujours WhatsApp.
    if ((res.status === 400 || res.status === 409) && json.code !== "NOT_WHATSAPP_MODE") {
      return {
        status: "rejected",
        message: typeof json.error === "string" ? json.error : "Impossible d'enregistrer la commande.",
      };
    }
    if (!res.ok || typeof json.wa_url !== "string") return { status: "failed" };
    return {
      status: "ok",
      waUrl: json.wa_url,
      orderId: typeof json.order_id === "string" ? json.order_id : "",
      reference: typeof json.reference === "string" ? json.reference : "",
    };
  } catch {
    // Réseau coupé, délai dépassé : WhatsApp s'ouvre sans enregistrement.
    return { status: "failed" };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
