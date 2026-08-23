import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validations/next-path";
import { RegisterForm } from "./register-form";
import type { RegisterInvite } from "@/components/auth/starter-offer";

export const metadata: Metadata = {
  title: "Créer ma page",
  description:
    "Crée ta page Bio-Lien gratuitement : ton lien @pseudo, tes produits, et le paiement Mobile Money ou carte bancaire.",
};

interface Props {
  searchParams: Promise<{ de?: string; next?: string; email?: string }>;
}

/**
 * Inscription.
 *
 * Deux paramètres traversent cet écran.
 *
 * `?next=` porte l'intention du visiteur : venu de la page Tarifs après avoir
 * choisi un plan, il doit y revenir une fois sa boutique créée, pas être
 * abandonné sur le tableau de bord. Il est assaini ici — c'est une
 * redirection ouverte s'il ne l'est pas.
 *
 * `?de={slug}` dit de quelle page vendeur vient le visiteur.
 * On le résout ici, côté serveur : nommer cette boutique dans l'en-tête coûte
 * une requête déjà faite dans le même aller-retour, là où le faire depuis le
 * navigateur ajouterait un appel réseau sur l'écran le plus fragile du
 * parcours. Un slug inconnu ou une boutique non publiée retombe simplement
 * sur la page d'inscription normale — jamais d'erreur.
 */
export default async function RegisterPage({ searchParams }: Props) {
  const { de, next, email } = await searchParams;

  let invite: RegisterInvite | null = null;

  if (de) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("shops")
      .select("name, slug")
      .eq("slug", de)
      .eq("is_published", true)
      .maybeSingle();
    if (data) invite = { name: data.name, slug: data.slug };
  }

  // L'accueil propose de saisir son e-mail avant de cliquer. Le lui
  // redemander ici serait le punir de l'avoir fait.
  const prefilledEmail =
    typeof email === "string" && email.length <= 254 && email.includes("@")
      ? email
      : null;

  return (
    <RegisterForm
      invite={invite}
      next={safeNextPath(next)}
      prefilledEmail={prefilledEmail}
    />
  );
}
