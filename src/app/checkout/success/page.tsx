import { notFound } from "next/navigation";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import { CheckoutSuccessClient } from "./success-client";

/**
 * Page de retour de la caisse Bio-Lien (mode « En ligne »). Caisse masquée
 * (décision du 14 septembre 2026) : la page n'existe pas — vrai 404 côté
 * serveur, avant de monter le composant client qui lit l'URL et interroge
 * /api/checkout/verify.
 */
export default function CheckoutSuccessPage() {
  if (!isOnlineCheckoutEnabled()) notFound();
  return <CheckoutSuccessClient />;
}
