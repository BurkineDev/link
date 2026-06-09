"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Plan = "free" | "starter" | "pro";
type Interval = "month" | "year";

const FREE_FEATURES = [
  "Jusqu'à 5 produits",
  "Lien @username unique",
  "Paiements carte bancaire + Mobile Money",
  "Templates inclus",
  "Analytics de base",
];

const STARTER_FEATURES = [
  "Jusqu'à 20 produits",
  "Commission réduite à 3 %",
  "Suppression du badge LinkBoutik",
  "Analytics standard",
  "Support email",
];

const PRO_FEATURES = [
  "Produits illimités",
  "0 % de commission sur tes ventes",
  "Analytics avancés (top produits, AOV, tendances)",
  "Templates premium",
  "Support prioritaire",
];

const PRICE_LABELS = {
  starter: { month: "2 000", year: "20 000" },
  pro: { month: "5 000", year: "30 000" },
} as const;

export function PricingClient({
  isAuthenticated,
  currentPlan,
}: {
  isAuthenticated: boolean;
  currentPlan: Plan;
}) {
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState<Interval>("month");
  const [checkingOutPlan, setCheckingOutPlan] = useState<Plan | null>(null);

  const wasCancelled = searchParams.get("cancelled") === "1";

  async function startCheckout(plan: "starter" | "pro") {
    if (!isAuthenticated) {
      window.location.assign(`/register?next=/pricing`);
      return;
    }

    setCheckingOutPlan(plan);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Impossible d'initialiser le paiement.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setCheckingOutPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        {wasCancelled && (
          <div className="mx-auto max-w-2xl mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tu as annulé le paiement. Tu peux réessayer quand tu veux.
          </div>
        )}

        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Tarifs simples
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black mb-3 leading-tight">
            Commence <span className="text-primary">gratuitement</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Pas de frais cachés. Monte d&apos;un palier le jour où ta boutique
            décolle.
          </p>
        </div>

        {/* Monthly / Yearly toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors",
                interval === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors inline-flex items-center gap-2",
                interval === "year"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Annuel
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5 py-0"
              >
                −50 %
              </Badge>
            </button>
          </div>
        </div>

        {/* 3-tier pricing grid */}
        <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
          {/* Découverte */}
          <Card className="border-2 border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="size-5 text-muted-foreground" />
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Découverte
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
                Démarre et teste ta boutique
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
                5 % de commission sur chaque vente.
              </p>
            </CardContent>
          </Card>

          {/* Starter */}
          <Card className="border-2 border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Rocket className="size-5 text-foreground" />
                <p className="text-sm font-semibold uppercase tracking-widest text-foreground">
                  Starter
                </p>
                {currentPlan === "starter" && (
                  <Badge variant="secondary" className="ml-auto">
                    Plan actuel
                  </Badge>
                )}
              </div>
              <p className="text-4xl font-black mb-1">
                {PRICE_LABELS.starter[interval]} FCFA
                <span className="text-base font-normal text-muted-foreground ml-1">
                  / {interval === "month" ? "mois" : "an"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Pour les vendeurs qui veulent plus que 5 produits
              </p>

              {currentPlan === "starter" ? (
                <Button variant="outline" className="w-full h-11 mb-6" disabled>
                  Tu es sur ce plan
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-11 mb-6 gap-2"
                  onClick={() => startCheckout("starter")}
                  disabled={checkingOutPlan !== null}
                >
                  {checkingOutPlan === "starter" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Passer en Starter
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              )}

              <ul className="space-y-2.5">
                <li className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Tout du plan Découverte, plus :
                </li>
                {STARTER_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <div className="mt-0.5 size-4 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                      <Check className="size-2.5 text-foreground" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/60">
                Sans engagement. Annule à tout moment.
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
                {PRICE_LABELS.pro[interval]} FCFA
                <span className="text-base font-normal text-muted-foreground ml-1">
                  / {interval === "month" ? "mois" : "an"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Pour les créateurs sérieux qui veulent grandir
              </p>

              {currentPlan === "pro" ? (
                <Button variant="outline" className="w-full h-11 mb-6" disabled>
                  Tu es sur ce plan
                </Button>
              ) : (
                <Button
                  className="w-full h-11 mb-6 font-semibold gap-2"
                  onClick={() => startCheckout("pro")}
                  disabled={checkingOutPlan !== null}
                >
                  {checkingOutPlan === "pro" ? (
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
                  Tout du plan Starter, plus :
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

        {/* Boosts */}
        <div className="max-w-3xl mx-auto mt-16 text-center">
          <h2 className="text-xl font-bold mb-2">Besoin d&apos;un coup d&apos;accélérateur ?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Des boosts ponctuels que tu peux activer depuis ton dashboard, sans
            t&apos;engager.
          </p>
          <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 text-left">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Mise en avant 24 h</p>
              <p className="text-sm text-muted-foreground">
                Ta boutique en haut de l&apos;explore pendant 24 heures.
              </p>
            </div>
            <p className="font-bold whitespace-nowrap">500 FCFA</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-xl font-bold mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              {
                q: "Quelle est la différence entre les plans ?",
                a: "Découverte (gratuit, 5 produits, 5 % de commission) sert à tester. Starter (2 000 FCFA/mois, 20 produits, 3 %) est fait pour les vendeurs qui ont dépassé les premiers articles. Pro (5 000 FCFA/mois, illimité, 0 %) est le plan optimal dès que tu vends régulièrement.",
              },
              {
                q: "Comment fonctionne la commission ?",
                a: "Sur les plans Découverte et Starter, on prélève automatiquement un % sur le total de chaque vente confirmée. Sur Pro, tu encaisses 100 % du prix de vente — c'est l'abonnement qui couvre les frais.",
              },
              {
                q: "L'abonnement annuel est-il vraiment moins cher ?",
                a: "Oui. 30 000 FCFA/an au lieu de 60 000 FCFA si tu payes au mois — soit ~50 % d'économie. Tu peux annuler à la fin de la période ; aucune donnée n'est supprimée.",
              },
              {
                q: "Le Mobile Money est-il disponible ?",
                a: "Oui. Tes clients peuvent payer par Wave, Orange Money, MTN Mobile Money et Moov Money via Genius Pay — en plus de la carte bancaire (Stripe).",
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
