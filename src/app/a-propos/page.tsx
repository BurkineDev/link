import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/lib/seo/json-ld";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";

export const metadata: Metadata = {
  title: "À propos de Bio-Lien",
  description:
    "Bio-Lien, c'est la boutique WhatsApp des vendeurs d'Afrique de l'Ouest, dans un seul lien de bio. Édité par WEND TECH, entreprise burkinabè fondée par Aristide Sawadogo.",
  alternates: { canonical: "/a-propos" },
};

/**
 * La page « qui sommes-nous ». Elle existe d'abord pour les gens qui
 * cherchent « Bio-Lien » et veulent savoir qui est derrière, et ensuite
 * pour les moteurs : sans elle, la marque n'a pas d'entité — un blog bio ou
 * un outil « lien en bio » quelconque passe devant.
 */
export default function AboutPage() {
  const online = isOnlineCheckoutEnabled();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "À propos de Bio-Lien",
          url: "https://www.bio-lien.com/a-propos",
          mainEntity: { "@type": "Organization", name: "Bio-Lien", url: "https://www.bio-lien.com" },
        }}
      />
      <h1>À propos de Bio-Lien</h1>
      <p className="text-sm text-muted-foreground mb-8">Bio-Lien se prononce « bio lien » et s&apos;écrit avec un trait d&apos;union.</p>

      <h2>Ce que c&apos;est</h2>
      <p>
        Bio-Lien donne à une vendeuse ou un créateur d&apos;Afrique de l&apos;Ouest une page à son nom —{" "}
        <strong>bio-lien.com/sa-boutique</strong> — à mettre dans sa bio TikTok, Instagram ou Facebook. Dessus : ses
        liens, ses réseaux, ses produits avec les prix en FCFA, et un bouton WhatsApp.{" "}
        {online
          ? "Le client choisit, commande et paie en Mobile Money ou par carte ; le vendeur suit ses commandes."
          : "Le client choisit et écrit sur WhatsApp ; le vendeur conclut la vente comme il l'a toujours fait."}
      </p>
      <p>
        La page s&apos;ouvre en cinq minutes depuis un téléphone, sans site à construire ni informaticien. Les thèmes —
        Bogolan, Wax, Indigo, Pagne tissé — sont dessinés pour l&apos;Afrique de l&apos;Ouest, lisibles en plein soleil sur
        un téléphone d&apos;entrée de gamme.
      </p>

      <h2>Pour qui</h2>
      <p>
        Les vendeuses de mode et d&apos;accessoires qui vendent chaque semaine sur TikTok et concluent sur WhatsApp, les
        artisans, les créateurs de contenu, les petits commerces d&apos;Abidjan, Dakar, Ouagadougou, Bamako, Lomé ou Cotonou
        — et la diaspora qui vend vers le pays.
      </p>

      <h2>Qui est derrière</h2>
      <p>
        Bio-Lien est édité par <strong>WEND TECH</strong>, entreprise individuelle immatriculée au Burkina Faso
        (Bobo-Dioulasso), fondée par <strong>Aristide Sawadogo</strong>, ingénieur en génie informatique, burkinabè installé
        à Toronto. Le projet est né d&apos;un constat simple : les outils de « lien en bio » sont pensés pour l&apos;Amérique et
        l&apos;Europe — carte bancaire, anglais, dollars — alors qu&apos;ici la vente se conclut sur WhatsApp et se paie en Mobile
        Money.
      </p>

      <h2>Ce qu&apos;on promet, et ce qu&apos;on ne promet pas</h2>
      <ul>
        <li>Une page gratuite pour commencer, sans carte bancaire.</li>
        <li>Des plans payants clairs, en FCFA, payables d&apos;avance en Mobile Money là où c&apos;est disponible.</li>
        <li>Pas de commission sur ce qui se vend sur WhatsApp : l&apos;argent va au vendeur.</li>
        <li>Pas d&apos;application à télécharger : la page s&apos;épingle sur l&apos;écran d&apos;accueil.</li>
      </ul>

      <h2>Nous écrire</h2>
      <p>
        <a href="mailto:support@bio-lien.com">support@bio-lien.com</a> — ou depuis la page{" "}
        <Link href="/pricing">Tarifs</Link>. Les informations légales sont dans les{" "}
        <Link href="/legal/mentions">mentions légales</Link>.
      </p>
    </>
  );
}
