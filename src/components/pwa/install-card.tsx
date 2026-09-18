"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { INSTALL_DISMISSED_KEY, isDismissed } from "@/lib/pwa/install";

/**
 * « Ajoute Bio-Lien à ton écran d'accueil » — la carte du tableau de bord.
 *
 * Elle ne s'affiche que si le téléphone sait le faire : un bouton sur
 * Android (le navigateur a proposé l'installation), les deux gestes sur
 * iPhone, « ouvre dans Chrome » depuis TikTok. Déjà installé, ou sur un
 * ordinateur : rien. Fermée d'un geste, elle ne revient pas avant un mois.
 */
export function InstallCard({ appName = "Bio-Lien" }: { appName?: string }) {
  const { advice, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(INSTALL_DISMISSED_KEY);
    } catch {
      // Stockage indisponible (navigation privée) : on montre la carte.
    }
    const timer = window.setTimeout(() => setDismissed(isDismissed(stored, Date.now())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // Sans stockage, la carte reviendra à la prochaine visite : acceptable.
    }
  }

  if (dismissed || advice.kind === "installed" || advice.kind === "unsupported") return null;

  return (
    <div
      role="region"
      aria-label={`Ajouter ${appName} à l'écran d'accueil`}
      className="relative rounded-2xl border border-border bg-card p-4 pr-12 shadow-sm"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
          <Smartphone className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="font-semibold leading-tight">Ajoute {appName} à ton écran d&apos;accueil</p>
          {advice.kind === "prompt" && (
            <>
              <p className="text-sm text-muted-foreground">Comme une appli : une icône, et tu y es en un geste, même sans lien.</p>
              <Button className="h-11" onClick={() => void install()}>
                Installer sur mon téléphone
              </Button>
            </>
          )}
          {advice.kind === "ios-steps" && (
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>
                Appuie sur <Share className="inline size-4 align-text-bottom" aria-label="Partager" /> <b>Partager</b> en bas de Safari.
              </li>
              <li>
                Choisis <b>« Sur l&apos;écran d&apos;accueil »</b>, puis <b>Ajouter</b>.
              </li>
            </ol>
          )}
          {advice.kind === "open-in-browser" && (
            <p className="text-sm text-muted-foreground">
              Tu es dans {advice.platform === "ios" ? "une appli" : "TikTok ou Instagram"} : appuie sur <b>⋯</b> puis{" "}
              <b>« Ouvrir dans {advice.platform === "ios" ? "Safari" : "Chrome"} »</b>, et l&apos;option apparaîtra.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
