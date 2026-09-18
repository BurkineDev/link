"use client";

import { useEffect, useState } from "react";
import { installAdvice, type InstallAdvice } from "@/lib/pwa/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Ce que le navigateur permet pour épingler la page, et le geste pour le
 * faire. Sur Android/Chrome, `beforeinstallprompt` arrive quelques
 * instants après le chargement : l'état passe alors à « prompt » et le
 * bouton apparaît. Sur iOS rien n'arrive jamais : on montre les étapes.
 */
export function useInstallPrompt(): { advice: InstallAdvice; install: () => Promise<boolean> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [advice, setAdvice] = useState<InstallAdvice>({ kind: "unsupported" });

  useEffect(() => {
    const compute = (promptAvailable: boolean) =>
      installAdvice({
        userAgent: navigator.userAgent,
        standalone:
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
        promptAvailable,
      });
    // Premier calcul après montage : le rendu serveur ne connaît ni l'UA ni
    // le mode d'affichage, et il ne doit pas deviner.
    const initial = window.setTimeout(() => setAdvice(compute(false)), 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setAdvice(compute(true));
    };
    const onInstalled = () => {
      setDeferred(null);
      setAdvice({ kind: "installed" });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setAdvice({ kind: "installed" });
    return outcome === "accepted";
  }

  return { advice, install };
}
