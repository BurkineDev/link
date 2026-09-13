"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startWhatsAppOrder, type WhatsAppOrderRequest } from "@/lib/orders/whatsapp-client";

/**
 * Après le départ vers WhatsApp, le bouton reste inerte le temps que l'app
 * prenne la main : un second tap dans cet intervalle créerait une seconde
 * commande.
 */
const SETTLE_MS = 1500;

/**
 * Enregistre une commande WhatsApp puis ouvre la conversation, en ignorant
 * les taps répétés tant que la précédente n'a pas abouti. Un refus métier
 * (variante manquante, article épuisé) est montré à l'acheteur ; une panne
 * reste silencieuse, WhatsApp s'ouvrant de toute façon.
 */
export function useWhatsAppOrder() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const start = useCallback(async (order: WhatsAppOrderRequest) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    const release = () => {
      busyRef.current = false;
      setBusy(false);
    };

    try {
      const outcome = await startWhatsAppOrder(order);
      if (!outcome.ok && outcome.reason === "rejected") {
        toast.error(outcome.message);
        release();
        return;
      }
      settleTimer.current = setTimeout(release, SETTLE_MS);
    } catch {
      release();
    }
  }, []);

  return { busy, start };
}

type Props = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  order: WhatsAppOrderRequest;
  disabled?: boolean;
  /** Vérification avant l'envoi (variante choisie…) : `false` annule le tap. */
  onBeforeStart?: () => boolean;
};

/**
 * Bouton « Commander sur WhatsApp » : ancre vers le lien wa.me d'origine
 * (fonctionne sans JavaScript, sans enregistrement), qui au tap enregistre
 * la commande puis ouvre WhatsApp avec la référence et le lien de suivi.
 * Pendant l'enregistrement, le bouton le dit : un acheteur qui ne voit rien
 * bouger retape.
 */
export function WhatsAppOrderButton({
  order,
  disabled,
  onBeforeStart,
  children,
  className,
  ...props
}: Props) {
  const { busy, start } = useWhatsAppOrder();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (onBeforeStart && !onBeforeStart()) return;
    void start(order);
  };

  return (
    <a
      {...props}
      href={disabled ? undefined : order.fallbackUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled || busy}
      aria-busy={busy}
      className={cn(className, busy && "cursor-wait opacity-70")}
      onClick={handleClick}
    >
      {busy ? (
        <>
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Ouverture de WhatsApp…
        </>
      ) : (
        children
      )}
    </a>
  );
}
