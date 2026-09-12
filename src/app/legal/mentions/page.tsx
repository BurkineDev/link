import Link from "next/link";

export const metadata = {
  alternates: { canonical: "/legal/mentions" },
  title: "Mentions légales",
  description: "Informations légales sur l'éditeur du service Bio-Lien.",
};

const LAST_UPDATED = "11 septembre 2026";

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
          États-Unis — <a href="https://vercel.com">vercel.com</a> (application web,
          déployée dans la région fra1 — Francfort, Allemagne)
        </li>
        <li>
          <strong>Neon, LLC</strong> (groupe Databricks, Inc.) — 160 Spear Street,
          Suite 1300, San Francisco, CA 94105, États-Unis —{" "}
          <a href="https://neon.com">neon.com</a> (base de données PostgreSQL, hébergée
          dans la région eu-central-1 — Francfort, Allemagne)
        </li>
        <li>
          <strong>Cloudflare, Inc.</strong> — 101 Townsend St, San Francisco, CA 94107,
          États-Unis — <a href="https://www.cloudflare.com">cloudflare.com</a> (stockage
          des fichiers via le service R2 : images des produits et des boutiques, fichiers
          des produits numériques)
        </li>
      </ul>

      <h2>Autres prestataires techniques</h2>
      <p>
        Bio-Lien fait également appel aux prestataires suivants :
      </p>
      <ul>
        <li>
          <strong>Plus Five Five, Inc.</strong> (Resend) — 2261 Market Street #5039,
          San Francisco, CA 94114, États-Unis —{" "}
          <a href="https://resend.com">resend.com</a> (envoi des e-mails
          transactionnels : commandes, notifications, connexion au compte)
        </li>
        <li>
          <strong>Upstash, Inc.</strong> — société de droit du Delaware, San José,
          Californie, États-Unis — <a href="https://upstash.com">upstash.com</a>{" "}
          (limitation du débit des requêtes et protection contre les abus)
        </li>
        <li>
          <strong>Anthropic, PBC</strong> — 548 Market St, PMB 90375, San Francisco,
          CA 94104, États-Unis — <a href="https://www.anthropic.com">anthropic.com</a>{" "}
          (génération de textes par IA pour les outils de rédaction assistée)
        </li>
        <li>
          <strong>Google LLC</strong> — 1600 Amphitheatre Parkway, Mountain View,
          CA 94043, États-Unis — <a href="https://www.google.com">google.com</a>{" "}
          (uniquement en cas de connexion via un compte Google)
        </li>
      </ul>
      <p>
        L&apos;authentification des comptes est assurée directement par Bio-Lien, sans
        prestataire tiers (hors connexion facultative via un compte Google).
      </p>

      <h2>Paiements</h2>
      <p>
        Les paiements en ligne sont traités par :
      </p>
      <ul>
        <li>
          <strong>Stripe Payments Europe, Limited</strong> — 1 Grand Canal Street Lower,
          Grand Canal Dock, Dublin, Irlande — <a href="https://stripe.com">stripe.com</a>{" "}
          (paiements par carte bancaire et abonnements)
        </li>
        <li>
          <strong>GENIUS GROUPS SAS</strong> (Genius Pay) — Lot n° 524, Îlot n° 40,
          Abidjan, Côte d&apos;Ivoire — RCCM CI-ABJ-03-2025-B17-00081 —{" "}
          <a href="https://geniuspay.ci">geniuspay.ci</a> (paiements par Mobile Money)
        </li>
      </ul>

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
