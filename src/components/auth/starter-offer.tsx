import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/subscription";
import { commissionNote, planFeatures, planPricing } from "@/lib/plans/catalog";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";

/**
 * Ce que « gratuit » veut dire, montré au moment de l'inscription.
 *
 * Le visiteur qui arrive d'une page vendeur ne connaît pas Bio-Lien : lui
 * demander six champs avant de lui dire ce qu'il obtient, et à quel prix, est
 * la manière la plus sûre de le perdre. Ce panneau répond aux deux questions
 * qu'il se pose — « c'est vraiment gratuit ? » et « et après ? » — sans le
 * sortir de la page.
 *
 * Les chiffres et la liste viennent du catalogue des plans, jamais d'un
 * texte recopié : une remise à jour des tarifs ne peut pas laisser cet écran
 * mentir. Le catalogue suit le mode (src/lib/payments/online-checkout.ts) :
 * caisse masquée, on ne parle ni de commission ni de paiement en ligne.
 */

/** La boutique dont le visiteur vient de voir la page. */
export interface RegisterInvite {
  name: string;
  slug: string;
}

export function StarterOffer() {
  const free = PLAN_LIMITS.free;
  // Le prix mis en avant est celui de la voie principale : le prépayé en FCFA.
  const starterPrice = planPricing("starter").prepaid.months1;
  const proPrice = planPricing("pro").prepaid.months1;

  const included = planFeatures("free").slice(0, 3);
  const online = isOnlineCheckoutEnabled();
  // Vide caisse masquée : le paragraphe ne commence alors pas par un espace.
  const commission = commissionNote("free");

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold">Plan {free.label}</p>
        <p className="text-sm font-bold text-primary">Gratuit</p>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {included.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* Caisse allumée, la commission est la contrepartie du plan gratuit :
          la cacher ici la ferait découvrir à la première vente, au pire
          moment. Caisse masquée, il n'y en a pas — rien à annoncer. */}
      <p className="mt-2.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
        {commission ? `${commission} ` : ""}Sans carte bancaire, sans engagement.
      </p>

      {/* Deux envies, deux plans. Caisse allumée : Starter réduit la
          commission, seul Pro la supprime — les mélanger promettait à Starter
          le 0 % de Pro. Caisse masquée : Pro, c'est les produits illimités et
          la rédaction IA. */}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Plus de produits ?{" "}
        <Link
          href="/pricing"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Starter dès {starterPrice}/mois
        </Link>
        . {online ? "0 % de commission ?" : "Produits illimités et rédaction IA ?"}{" "}
        <Link
          href="/pricing"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Pro dès {proPrice}/mois
        </Link>
        .
      </p>
    </div>
  );
}
