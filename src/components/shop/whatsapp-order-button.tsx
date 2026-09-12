"use client";

import { useState, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import { startWhatsAppOrder, type WhatsAppOrderRequest } from "@/lib/orders/whatsapp-client";

type Props = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  order: WhatsAppOrderRequest;
  disabled?: boolean;
};

/**
 * Bouton « Commander sur WhatsApp » : ancre vers le lien wa.me d'origine
 * (fonctionne sans JavaScript, sans enregistrement), qui au tap enregistre
 * la commande puis ouvre WhatsApp avec la référence et le lien de suivi.
 */
export function WhatsAppOrderButton({ order, disabled, children, ...props }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setBusy(true);
    void startWhatsAppOrder(order).finally(() => setBusy(false));
  };

  return (
    <a
      {...props}
      href={disabled ? undefined : order.fallbackUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled || busy}
      aria-busy={busy}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
