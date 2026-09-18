"use client";

import { TrackingPixels } from "@/components/shop/tracking-pixels";

/**
 * Les pixels de Bio-Lien lui-même (pas ceux des vendeurs, qui vivent sur
 * leurs boutiques) : sur les pages où une campagne peut atterrir — accueil,
 * tarifs, inscription, connexion — et nulle part ailleurs. Sans identifiant
 * dans l'environnement, rien n'est chargé.
 *
 * Deux événements suffisent à juger une campagne : l'inscription réussie
 * (`CompleteRegistration`) et l'abonnement activé (`Subscribe`), envoyés
 * par `trackMarketingEvent` depuis les écrans concernés.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null;
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || null;

export function MarketingPixels() {
  return <TrackingPixels metaPixelId={META_PIXEL_ID} tiktokPixelId={TIKTOK_PIXEL_ID} />;
}

export type MarketingEvent = "CompleteRegistration" | "Subscribe";

type PixelWindow = Window & {
  fbq?: (action: string, event: string, params?: Record<string, unknown>) => void;
  ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
};

/**
 * Signale un événement aux pixels présents. Ne lève jamais : un bloqueur de
 * publicité ou un script encore en chargement ne doit pas casser l'écran
 * qui vient de réussir.
 */
export function trackMarketingEvent(event: MarketingEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const w = window as PixelWindow;
  try {
    w.fbq?.("track", event, params);
  } catch {
    // Le pixel n'est pas notre affaire ici.
  }
  try {
    w.ttq?.track(event, params);
  } catch {
    // Idem.
  }
}
