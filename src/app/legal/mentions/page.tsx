import Link from "next/link";

export const metadata = {
  title: "Mentions légales | Bio-Lien",
  description: "Informations légales sur l'éditeur du service Bio-Lien.",
};

const LAST_UPDATED = "24 mai 2026";

export default function MentionsPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <h2>Éditeur du service</h2>
      <p>
        <strong>Bio-Lien</strong>
        <br />
        Plateforme e-commerce pour créateurs et entrepreneurs africains.
      </p>
      <p>
        Email : <a href="mailto:support@bio-lien.com">support@bio-lien.com</a>
        <br />
        Site : <a href="https://www.bio-lien.com">bio-lien.com</a>
      </p>
      <p className="text-sm text-muted-foreground italic">
        Les informations légales détaillées (raison sociale, capital, numéro
        d&apos;immatriculation, siège social, représentant légal) seront publiées ici
        dès l&apos;immatriculation de la société.
      </p>

      <h2>Directeur de la publication</h2>
      <p>Le représentant légal de Bio-Lien.</p>

      <h2>Hébergement</h2>
      <p>
        Le service est hébergé par :
      </p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133, Walnut, CA 91789,
          États-Unis — <a href="https://vercel.com">vercel.com</a> (application web)
        </li>
        <li>
          <strong>Supabase Inc.</strong> — 970 Toa Payoh North #07-04, Singapour 318992
          — <a href="https://supabase.com">supabase.com</a> (base de données et stockage)
        </li>
      </ul>

      <h2>Paiements</h2>
      <p>
        Les paiements en ligne sont traités par{" "}
        <strong>Stripe Payments Europe, Limited</strong> — 1 Grand Canal Street Lower,
        Grand Canal Dock, Dublin, Irlande.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du contenu de la Plateforme (textes, graphismes, logos, icônes,
        images, code source) est la propriété exclusive de Bio-Lien ou de ses
        partenaires et est protégé par les lois en vigueur sur la propriété
        intellectuelle. Toute reproduction non autorisée est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Les modalités de collecte et de traitement des données personnelles sont
        décrites dans notre <Link href="/legal/privacy">Politique de confidentialité</Link>.
      </p>

      <h2>Litiges</h2>
      <p>
        Tout litige relatif à l&apos;utilisation du service est régi par les Conditions
        Générales d&apos;Utilisation, disponibles à l&apos;adresse{" "}
        <Link href="/legal/terms">/legal/terms</Link>.
      </p>
    </>
  );
}
