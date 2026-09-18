"use client";

import { Share, Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

/**
 * « Ajouter à l'écran d'accueil » sur la page d'une vendeuse : le client
 * garde la boutique comme une appli, avec son nom et son icône (voir le
 * manifeste par boutique). Un bouton quand le navigateur le permet, les
 * deux gestes sur iPhone, rien quand ça ne marcherait pas.
 */
export function AddToHomeScreen({ shopName, className }: { shopName: string; className?: string }) {
  const { advice, install } = useInstallPrompt();
  if (advice.kind === "installed" || advice.kind === "unsupported") return null;

  const base = cn("flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left text-sm", className);

  if (advice.kind === "prompt") {
    return (
      <button type="button" onClick={() => void install()} className={cn(base, "transition-colors hover:bg-muted")}>
        <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          <span className="block font-semibold">Ajouter {shopName} à mon écran d&apos;accueil</span>
          <span className="block text-muted-foreground">Comme une appli, pour la retrouver en un geste.</span>
        </span>
      </button>
    );
  }

  return (
    <div className={base}>
      <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>
        <span className="block font-semibold">Garder {shopName} sur mon écran d&apos;accueil</span>
        {advice.kind === "ios-steps" ? (
          <span className="block text-muted-foreground">
            <Share className="inline size-3.5 align-text-bottom" aria-label="Partager" /> Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </span>
        ) : (
          <span className="block text-muted-foreground">
            Appuie sur ⋯ puis « Ouvrir dans {advice.platform === "ios" ? "Safari" : "Chrome"} », et l&apos;option apparaîtra.
          </span>
        )}
      </span>
    </div>
  );
}
