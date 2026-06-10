import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Boutique introuvable | Bio-Lien",
  description: "Cette boutique n'existe pas ou n'est pas encore publiée.",
};

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
            Créer ma boutique
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Store className="size-8" />
          </div>

          <h1 className="text-3xl font-black mb-3">
            Cette boutique n&apos;existe pas
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            L&apos;adresse que tu as saisie est introuvable ou la boutique n&apos;a pas
            encore été publiée par son créateur.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="h-11 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              <Link href="/register">
                Créer ma boutique gratuitement
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Retour à l&apos;accueil</Link>
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
