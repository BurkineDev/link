"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crown, Loader2, Sparkles, WandSparkles, PackagePlus, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { planArrived, WELCOME_POLL_MS, WELCOME_TIMEOUT_MS, type ExpectedPlan, type PaymentVia } from "@/lib/plans/welcome";
import type { SubscriptionPlan, SubscriptionProvider } from "@/lib/types/database";

interface Snapshot {
  effective_plan: SubscriptionPlan;
  provider: SubscriptionProvider | null;
  current_period_end: string | null;
}

interface PlanCard {
  label: string;
  features: readonly string[];
  maxProducts: number;
}

export function SubscriptionWelcome({
  expected,
  via,
  initial,
  plans,
  productCount,
}: {
  /** Plan acheté d'après l'URL de retour ; null si on arrive ici sans contexte. */
  expected: ExpectedPlan | null;
  via: PaymentVia;
  initial: Snapshot;
  plans: Record<ExpectedPlan, PlanCard>;
  productCount: number;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [timedOut, setTimedOut] = useState(false);

  const arrived = expected ? planArrived(expected, snapshot.effective_plan) : snapshot.effective_plan !== "free";

  // Le webhook qui crédite l'abonnement arrive après la redirection : on
  // interroge le serveur jusqu'à ce que le plan attendu soit là, deux
  // minutes au plus.
  useEffect(() => {
    if (arrived || !expected) return;
    let cancelled = false;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const res = await fetch("/api/subscription/status", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as Snapshot;
          if (!cancelled) setSnapshot(body);
          if (planArrived(expected, body.effective_plan)) return;
        }
      } catch {
        // Réseau capricieux : on réessaie au prochain tour.
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= WELCOME_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(tick, WELCOME_POLL_MS);
    };
    let timer = setTimeout(tick, WELCOME_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [arrived, expected]);

  const shownPlan: ExpectedPlan = arrived
    ? snapshot.effective_plan === "pro"
      ? "pro"
      : "starter"
    : (expected ?? "starter");
  const card = plans[shownPlan];
  const prepaid = snapshot.provider === "geniuspay";

  if (arrived) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/20">
            <Crown className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Tu es en {card.label} 🎉</h1>
          <p className="mt-2 text-muted-foreground">
            {prepaid && snapshot.current_period_end
              ? `Ton accès est ouvert jusqu'au ${formatDate(snapshot.current_period_end)}. Rien n'est prélevé automatiquement : tu rachètes une période quand tu veux.`
              : snapshot.current_period_end
                ? `Renouvelé automatiquement ; prochaine échéance le ${formatDate(snapshot.current_period_end)}. Résiliable depuis ton profil.`
                : "C'est actif dès maintenant."}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Ce que ça débloque
            </p>
            <ul className="space-y-2.5">
              {card.features.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <Check className="size-2.5 text-primary" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild className="h-12 justify-between gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-0">
            <Link href="/dashboard/products/new">
              <span className="flex items-center gap-2">
                <PackagePlus className="size-4" />
                Ajouter un produit
                <span className="text-xs opacity-70">
                  {Number.isFinite(card.maxProducts) ? `${productCount} / ${card.maxProducts}` : `${productCount}, sans limite`}
                </span>
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 justify-between gap-2">
            <Link href="/dashboard/settings">
              <span className="flex items-center gap-2">
                <EyeOff className="size-4" />
                Masquer le badge Bio-Lien
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {shownPlan === "pro" && (
            <Button asChild variant="outline" className="h-12 justify-between gap-2 sm:col-span-2">
              <Link href="/dashboard/products/new">
                <span className="flex items-center gap-2">
                  <WandSparkles className="size-4" />
                  Rédiger une fiche produit avec l&apos;IA
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/dashboard/profile" className="underline underline-offset-2 hover:text-foreground">
            Voir mon abonnement dans mon profil
          </Link>
        </p>
      </div>
    );
  }

  // Pas encore crédité : on attend le webhook, sans faire croire au vendeur
  // qu'il a payé pour rien — ni qu'il a payé si ce n'est pas le cas.
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          {timedOut ? <Sparkles className="size-8 text-muted-foreground" /> : <Loader2 className="size-8 animate-spin text-muted-foreground" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          {timedOut ? "Paiement pas encore confirmé" : `Activation de ${card.label} en cours…`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {timedOut
            ? via === "mobile-money"
              ? "Nous n'avons pas reçu la confirmation de ton opérateur. Si tu n'as pas validé la demande sur ton téléphone, rien n'a été débité : tu peux réessayer, ou payer par carte. Si tu as bien validé et que l'argent est parti, écris-nous avec l'heure du paiement : on active à la main."
              : "Stripe n'a pas encore confirmé le paiement. Ça arrive dans la minute en général. Si ton profil n'affiche toujours pas le plan d'ici quelques minutes, écris-nous avec l'heure du paiement."
            : via === "mobile-money"
              ? "Dès que ton opérateur confirme le paiement, ton plan s'active ici. Pas besoin de recharger : cette page se met à jour d'elle-même."
              : "Stripe nous confirme le paiement dans quelques secondes. Pas besoin de recharger : cette page se met à jour d'elle-même."}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Ce que {card.label} va débloquer
          </p>
          <ul className="space-y-2.5">
            {card.features.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Check className="size-2.5" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {timedOut && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href="/pricing">Retour aux tarifs</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href="/dashboard/profile">Voir mon profil</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
