import Link from "next/link";
import { Check } from "lucide-react";
import {
  PLAN_CURRENCY,
  PLAN_LIMITS,
  PLAN_PRICES,
  formatPlanPrice,
} from "@/lib/subscription";

/**
 * Ce que « gratuit » veut dire, montré au moment de l'inscription.
 *
 * Le visiteur qui arrive d'une page vendeur ne connaît pas Bio-Lien : lui
 * demander six champs avant de lui dire ce qu'il obtient, et à quel prix, est
 * la manière la plus sûre de le perdre. Ce panneau répond aux deux questions
 * qu'il se pose — « c'est vraiment gratuit ? » et « et après ? » — sans le
 * sortir de la page.
 *
 * Les chiffres viennent des constantes de plans, jamais d'un texte recopié :
 * une remise à jour des tarifs ne peut pas laisser cet écran mentir.
 */

/** La boutique dont le visiteur vient de voir la page. */
export interface RegisterInvite {
  name: string;
  slug: string;
}

export function StarterOffer() {
  const free = PLAN_LIMITS.free;
  const starterPrice = formatPlanPrice(PLAN_PRICES.starter.month, PLAN_CURRENCY);

  const included = [
    `Jusqu'à ${free.maxProducts} produits`,
    "Ton lien @pseudo",
    "Paiement Mobile Money + carte",
  ];

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

      {/* La commission est la contrepartie du plan gratuit : la cacher ici la
          ferait découvrir à la première vente, au pire moment. */}
      <p className="mt-2.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
        {Math.round(free.commissionRate * 100)} % de commission sur chaque vente.
        Sans carte bancaire, sans engagement.
      </p>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Plus de produits ou 0 % de commission ?{" "}
        <Link
          href="/pricing"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Starter dès {starterPrice}/mois
        </Link>
        .
      </p>
    </div>
  );
}
