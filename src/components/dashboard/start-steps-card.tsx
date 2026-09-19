"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { allStepsDone, planLine, startSteps, stepStorageKey } from "@/lib/dashboard/start-steps";
import { shareTexts } from "@/lib/onboarding/simple";

/**
 * « Trois étapes pour vendre » sur l'accueil du tableau de bord, jusqu'à ce
 * que les trois soient faites. Les deux dernières ne se voient pas depuis
 * le serveur (un lien collé dans TikTok, un message envoyé) : elles se
 * cochent quand la vendeuse fait le geste ici, et le téléphone s'en souvient.
 */
export function StartStepsCard({
  slug,
  shopName,
  publicUrl,
  productsCount,
  plan,
}: {
  slug: string;
  shopName: string;
  publicUrl: string;
  productsCount: number;
  plan: { label: string; maxProducts: number; isFree: boolean };
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    let copied = false;
    let sharedBefore = false;
    try {
      copied = window.localStorage.getItem(stepStorageKey(slug, "bio-link")) === "1";
      sharedBefore = window.localStorage.getItem(stepStorageKey(slug, "whatsapp-share")) === "1";
    } catch {
      // Sans mémoire locale, les étapes restent à faire : mieux qu'un faux « fait ».
    }
    const timer = window.setTimeout(() => {
      setLinkCopied(copied);
      setShared(sharedBefore);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [slug]);

  function remember(step: "bio-link" | "whatsapp-share") {
    try {
      window.localStorage.setItem(stepStorageKey(slug, step), "1");
    } catch {
      // Ignoré : l'étape se recochera à la prochaine visite.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // Le presse-papiers peut être refusé : le lien reste visible, à copier à la main.
    }
    setLinkCopied(true);
    setJustCopied(true);
    remember("bio-link");
    window.setTimeout(() => setJustCopied(false), 2000);
  }

  const steps = startSteps({ productsCount, linkCopied, sharedOnWhatsApp: shared });
  const share = shareTexts(publicUrl, shopName);
  const atLimit = Number.isFinite(plan.maxProducts) && productsCount >= plan.maxProducts;

  return (
    <section aria-label="Trois étapes pour vendre" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{allStepsDone(steps) ? "Tu es lancée" : "Trois étapes pour vendre"}</h2>
        <p className="text-sm text-muted-foreground">
          {planLine(plan.label, productsCount, plan.maxProducts)}
          {plan.isFree && (
            <>
              {" · "}
              <Link href="/pricing" className="underline">
                {atLimit ? "Passer à Starter" : "Voir les plans"}
              </Link>
            </>
          )}
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className={cn("flex items-start gap-3 rounded-xl border p-3", step.done ? "border-primary/40 bg-primary/10" : "border-border")}>
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                step.done ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
              aria-hidden="true"
            >
              {step.done ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold leading-snug", step.done && "line-through decoration-2 opacity-70")}>{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
              {!step.done && step.id === "products" && (
                <Button asChild size="sm" className="mt-2 h-10 gap-2">
                  <Link href={atLimit ? "/pricing" : "/dashboard/products/new"}>
                    <Plus className="size-4" /> {atLimit ? "Débloquer plus de produits" : "Ajouter un produit"}
                  </Link>
                </Button>
              )}
              {!step.done && step.id === "bio-link" && (
                <Button size="sm" variant="outline" className="mt-2 h-10 gap-2" onClick={() => void copyLink()}>
                  {justCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {justCopied ? "Copié" : "Copier mon lien"}
                </Button>
              )}
              {!step.done && step.id === "whatsapp-share" && (
                <Button asChild size="sm" variant="outline" className="mt-2 h-10 gap-2">
                  <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => { setShared(true); remember("whatsapp-share"); }}>
                    <MessageCircle className="size-4" /> Partager sur WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
