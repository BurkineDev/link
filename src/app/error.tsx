"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

/**
 * Limite d'erreur du site.
 *
 * Sans elle, une exception non rattrapée affiche l'écran d'erreur brut de
 * Next — sur lequel un visiteur ne peut rien faire, et qui ne ressemble à
 * rien. Ici, il peut au moins réessayer sans recharger toute l'application.
 *
 * Le message d'erreur technique n'est jamais montré : il ne l'aiderait pas et
 * peut décrire des rouages internes.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <Logo size="sm" href="/" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 size-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="size-8" />
          </div>

          <h1 className="text-3xl font-black mb-3">Quelque chose a cassé</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Ce n&apos;est pas de ta faute. Réessaie — et si ça recommence,
            écris-nous, on regarde tout de suite.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={reset}
              className="h-11 font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              <RotateCw className="size-4" />
              Réessayer
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>

          {/* Le digest est l'identifiant que le support peut retrouver dans
              les journaux ; il ne divulgue rien du contenu de l'erreur. */}
          {error.digest && (
            <p className="mt-8 text-[11px] text-muted-foreground font-mono">
              Référence : {error.digest}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
