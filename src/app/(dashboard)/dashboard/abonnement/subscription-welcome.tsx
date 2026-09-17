"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { trackMarketingEvent } from "@/components/marketing/marketing-pixels";
import { supportHref, supportLabel } from "@/lib/support";
import Link from "next/link";
import { ArrowRight, Check, Crown, Loader2, Mail, RefreshCw, Sparkles, WandSparkles, PackagePlus, EyeOff } from "lucide-react";
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

// Faux sur le serveur et pendant l'hydratation, vrai ensuite : les dates
// se formatent dans le fuseau du vendeur, sans écart avec le HTML serveur.
const noopSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

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
  reference,
}: {
  /** Plan acheté d'après l'URL de retour ; null si on arrive ici sans contexte. */
  expected: ExpectedPlan | null;
  via: PaymentVia;
  initial: Snapshot;
  plans: Record<ExpectedPlan, PlanCard>;
  productCount: number;
  /** Référence Genius Pay du paiement en attente, à donner au support. */
  reference: string | null;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [timedOut, setTimedOut] = useState(false);
  // Chaque « Vérifier à nouveau » relance une fenêtre de sondage complète.
  const [attempt, setAttempt] = useState(0);
  const recheck = () => {
    setTimedOut(false);
    setAttempt((n) => n + 1);
  };
  const mounted = useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
  const periodEnd = mounted && snapshot.current_period_end ? formatDate(snapshot.current_period_end) : null;

  const arrived = expected ? planArrived(expected, snapshot.effective_plan) : snapshot.effective_plan !== "free";

  // Le webhook qui crédite l'abonnement arrive après la redirection : on
  // interroge le serveur jusqu'à ce que le plan attendu soit là, deux
  // minutes et demie au plus par tentative.
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
  }, [arrived, expected, attempt]);

  const shownPlan: ExpectedPlan = arrived
    ? snapshot.effective_plan === "pro"
      ? "pro"
      : "starter"
    : (expected ?? "starter");
  const card = plans[shownPlan];
  const prepaid = snapshot.provider === "geniuspay";
  // Sans contexte d'achat (URL tapée, favori) et sans plan payant, la page
  // serveur redirige vers Tarifs ; ici on ne montre jamais un sablier qui
  // n'attend rien.
  const waiting = Boolean(expected) && !timedOut;
  const supportMail = supportHref(
    `Abonnement ${card.label} non activé`,
    [
      `Plan : ${card.label}`,
      `Paiement : ${via === "mobile-money" ? "Mobile Money" : "carte bancaire"}`,
      reference ? `Référence : ${reference}` : "",
      "Heure du paiement : ",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // L'abonnement vient d'être confirmé à l'écran : c'est l'événement qui
  // dit à une campagne qu'elle a payé. Une fois par arrivée, pas à chaque
  // rendu, et jamais pour un plan déjà actif avant la visite.
  useEffect(() => {
    if (!arrived || !expected) return;
    trackMarketingEvent("Subscribe", { plan: expected, via });
  }, [arrived, expected, via]);

  if (arrived) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-6">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/20">
            <Crown className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Tu es en {card.label} 🎉</h1>
          <p className="mt-2 text-muted-foreground">
            {prepaid && periodEnd
              ? `Ton accès est ouvert jusqu'au ${periodEnd}. Rien n'est prélevé automatiquement : tu rachètes une période quand tu veux.`
              : periodEnd
                ? `Renouvelé automatiquement ; prochaine échéance le ${periodEnd}. Résiliable depuis ton profil.`
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
            <Link href="/dashboard/settings?tab=appearance">
              <span className="flex items-center gap-2">
                <EyeOff className="size-4" />
                Masquer le badge Bio-Lien
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {shownPlan === "pro" && (
            <Button asChild variant="outline" className="h-12 justify-between gap-2 sm:col-span-2">
              <Link href="/dashboard/settings">
                <span className="flex items-center gap-2">
                  <WandSparkles className="size-4" />
                  Écrire ma bio avec l&apos;IA
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
      <div className="text-center" role="status">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          {waiting ? <Loader2 className="size-8 animate-spin text-muted-foreground" /> : <Sparkles className="size-8 text-muted-foreground" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          {waiting ? `Activation de ${card.label} en cours…` : expected ? "Paiement pas encore confirmé" : "Tu es en Découverte"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {!expected
            ? "Choisis un plan pour débloquer plus de produits et masquer le badge Bio-Lien."
            : waiting
              ? via === "mobile-money"
                ? "Dès que ton opérateur confirme le paiement, ton plan s'active ici. Pas besoin de recharger : cette page se met à jour d'elle-même."
                : "Stripe nous confirme le paiement dans quelques secondes. Pas besoin de recharger : cette page se met à jour d'elle-même."
              : via === "mobile-money"
                ? "Nous n'avons pas encore reçu la confirmation de ton opérateur. Si tu as validé sur ton téléphone, attends encore un peu puis appuie sur « Vérifier à nouveau » — ne paie pas une seconde fois. Si tu n'as rien validé, rien n'a été débité : tu peux réessayer, ou payer par carte. Si l'argent est parti et que rien ne change, écris-nous : on active à la main."
                : "Stripe n'a pas encore confirmé le paiement. Ça arrive dans la minute en général : attends un peu puis appuie sur « Vérifier à nouveau ». Si ton profil n'affiche toujours pas le plan, écris-nous."}
        </p>
        {!waiting && reference && (
          <p className="mt-3 font-mono text-sm">Référence : {reference}</p>
        )}
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

      {!waiting && (
        <div className="grid gap-3 sm:grid-cols-2">
          {expected && (
            <Button variant="outline" className="h-11 gap-2" onClick={recheck}>
              <RefreshCw className="size-4" />
              Vérifier à nouveau
            </Button>
          )}
          {expected && (
            <Button asChild variant="outline" className="h-11 gap-2">
              <a href={supportMail}>
                <Mail className="size-4" />
                {supportLabel()}
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="h-11">
            <Link href="/pricing">{expected ? "Retour aux tarifs" : "Voir les plans"}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/dashboard/profile">Voir mon profil</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
