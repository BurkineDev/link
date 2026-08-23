import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

/**
 * 404 pour tout le site hors boutiques (celles-ci ont la leur, qui parle du
 * vendeur). Sans ce fichier, Next sert sa page brute en Times — la première
 * chose que verrait quelqu'un qui se trompe d'adresse.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <Link
            href="/register"
            className="text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
          >
            Créer ma page
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Compass className="size-8" />
          </div>

          <p className="text-sm font-bold tracking-widest text-muted-foreground mb-2">
            ERREUR 404
          </p>
          <h1 className="text-3xl font-black mb-3">Cette page n&apos;existe pas</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Le lien est peut-être incomplet, ou la page a été déplacée. Si tu
            cherchais la boutique de quelqu&apos;un, son adresse ressemble à
            <span className="font-mono text-foreground"> bio-lien.com/son-pseudo</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              className="h-11 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              <Link href="/">
                Retour à l&apos;accueil
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/explore">Découvrir des boutiques</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Bio-Lien
      </footer>
    </div>
  );
}
