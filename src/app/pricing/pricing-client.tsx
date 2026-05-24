"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Crown, Loader2, Sparkles } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FREE_FEATURES = [
  "Jusqu'à 5 produits",
  "Lien @username unique",
  "Templates inclus",
  "Paiements par carte bancaire (Mobile Money bientôt)",
  "Analytics de base",
  "Support par email",
];

const PRO_FEATURES = [
  "Produits illimités",
  "0% de commission sur tes ventes",
  "Analytics avancés (top produits, AOV, tendances)",
  "Suppression du badge LinkBoutik",
  "Templates premium",
  "Support prioritaire",
];

export function PricingClient({
  isAuthenticated,
  currentPlan,
}: {
  isAuthenticated: boolean;
  currentPlan: "free" | "pro";
}) {
  const searchParams = useSearchParams();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const wasCancelled = searchParams.get("cancelled") === "1";

  async function startCheckout() {
    if (!isAuthenticated) {
      window.location.assign("/register?next=/pricing");
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/subscription/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Impossible d'initialiser le paiement.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Top bar */}
      <header className="border-b bg-background/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            {isAuthenticated ? "Retour au dashboard" : "Retour à l'accueil"}
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
        {wasCancelled && (
          <div className="mx-auto max-w-2xl mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tu as annulé le paiement. Tu peux réessayer quand tu veux.
          </div>
        )}

        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Tarifs simples
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black mb-3 leading-tight">
            Commence{" "}
            <span className="gradient-brand-text">gratuitement</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Pas de frais cachés. Passe en Pro le jour où ta boutique décolle.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Free */}
          <Card className="border-2 border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="size-5 text-primary" />
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Gratuit
                </p>
                {currentPlan === "free" && (
                  <Badge variant="secondary" className="ml-auto">
                    Plan actuel
                  </Badge>
                )}
              </div>
              <p className="text-4xl font-black mb-1">
                0 FCFA
                <span className="text-base font-normal text-muted-foreground ml-1">
                  / mois
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Pour démarrer et tester ta boutique
              </p>

              <Button
                variant="outline"
                className="w-full h-11 mb-6"
                asChild
                disabled={currentPlan === "free"}
              >
                {currentPlan === "free" ? (
                  <span>Tu es sur ce plan</span>
                ) : (
                  <Link href="/register">Commencer gratuitement</Link>
                )}
              </Button>

              <ul className="space-y-2.5">
                {FREE_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <div className="mt-0.5 size-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="size-2.5 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/60">
                Une commission de 5 % est appliquée sur chaque vente pour couvrir
                les frais de la plateforme.
              </p>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-2 border-primary relative shadow-lg shadow-primary/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">
                Recommandé
              </Badge>
            </div>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="size-5 text-primary" />
                <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                  Pro
                </p>
                {currentPlan === "pro" && (
                  <Badge variant="secondary" className="ml-auto">
                    Plan actuel
                  </Badge>
                )}
              </div>
              <p className="text-4xl font-black mb-1">
                5 000 FCFA
                <span className="text-base font-normal text-muted-foreground ml-1">
                  / mois
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Pour les créateurs qui veulent grandir
              </p>

              {currentPlan === "pro" ? (
                <Button variant="outline" className="w-full h-11 mb-6" disabled>
                  Tu es sur ce plan
                </Button>
              ) : (
                <Button
                  className="w-full h-11 mb-6 font-semibold gap-2"
                  onClick={startCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Passer en Pro
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              )}

              <ul className="space-y-2.5">
                <li className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Tout du plan Gratuit, plus :
                </li>
                {PRO_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <div className="mt-0.5 size-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="size-2.5 text-primary-foreground" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/60">
                Sans engagement. Annule à tout moment depuis ton profil.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-xl font-bold mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              {
                q: "Puis-je commencer gratuitement ?",
                a: "Oui. Le plan Gratuit te laisse créer ta boutique, ajouter jusqu'à 5 produits et accepter des paiements. Une commission de 5% est appliquée sur les ventes pour couvrir les frais.",
              },
              {
                q: "Comment fonctionne le paiement Pro ?",
                a: "5 000 FCFA / mois facturés via Stripe. Tu peux annuler à tout moment depuis ton profil, sans frais cachés.",
              },
              {
                q: "Que se passe-t-il si j'annule ?",
                a: "Ton plan reste Pro jusqu'à la fin de la période payée. Ensuite tu retournes au plan Gratuit (5 produits max). Aucune donnée n'est supprimée.",
              },
              {
                q: "Le Mobile Money est-il disponible ?",
                a: "Pas encore. Pour l'instant, les acheteurs paient par carte bancaire via Stripe. L'intégration Orange Money, MTN MoMo et Wave arrive bientôt.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group border border-border rounded-xl bg-card overflow-hidden"
              >
                <summary className="cursor-pointer px-5 py-4 font-semibold text-sm hover:bg-muted/50 transition-colors list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
