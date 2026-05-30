import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité | LinkBoutik",
  description:
    "Comment LinkBoutik collecte, utilise et protège vos données personnelles.",
};

const LAST_UPDATED = "24 mai 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <p>
        LinkBoutik (« nous », « notre ») accorde une grande importance à la
        protection de votre vie privée. Cette politique explique quelles données nous
        collectons, comment nous les utilisons et quels sont vos droits.
      </p>

      <h2>1. Données que nous collectons</h2>
      <p>Nous collectons les catégories de données suivantes :</p>
      <ul>
        <li>
          <strong>Données de compte</strong> (Vendeurs) : email, nom complet, nom
          d&apos;utilisateur, mot de passe (haché), avatar, bio.
        </li>
        <li>
          <strong>Données de boutique</strong> : nom, description, logo, bannière,
          produits, commandes.
        </li>
        <li>
          <strong>Données d&apos;achat</strong> (Acheteurs) : nom, email, téléphone,
          adresse de livraison, contenu de la commande.
        </li>
        <li>
          <strong>Données de paiement</strong> : traitées exclusivement par Stripe. Nous
          ne stockons jamais de numéros de carte bancaire.
        </li>
        <li>
          <strong>Données techniques</strong> : adresse IP, type d&apos;appareil, navigateur,
          pages visitées, à des fins de sécurité et d&apos;amélioration du service.
        </li>
      </ul>

      <h2>2. Finalités du traitement</h2>
      <p>Vos données sont traitées pour :</p>
      <ul>
        <li>Fournir et améliorer le service LinkBoutik.</li>
        <li>Traiter les commandes et les paiements.</li>
        <li>Communiquer avec vous (confirmation de commande, support, notifications).</li>
        <li>Prévenir la fraude et garantir la sécurité de la plateforme.</li>
        <li>Respecter nos obligations légales et fiscales.</li>
      </ul>

      <h2>3. Base légale</h2>
      <p>
        Le traitement de vos données repose sur (i) l&apos;exécution du contrat qui nous lie,
        (ii) votre consentement explicite lorsqu&apos;il est requis, (iii) nos obligations
        légales, ou (iv) notre intérêt légitime à exploiter et sécuriser la plateforme.
      </p>

      <h2>4. Partage des données</h2>
      <p>Nous partageons certaines données avec des prestataires de confiance :</p>
      <ul>
        <li>
          <strong>Stripe</strong> — traitement des paiements (commandes et abonnements).
        </li>
        <li>
          <strong>Supabase</strong> — hébergement de la base de données et stockage des
          fichiers.
        </li>
        <li>
          <strong>Vercel</strong> — hébergement de l&apos;application.
        </li>
        <li>
          <strong>Google</strong> — uniquement si vous utilisez la connexion via OAuth.
        </li>
      </ul>
      <p>
        Nous ne vendons jamais vos données à des tiers. Nous pouvons être amenés à les
        communiquer à une autorité judiciaire en cas d&apos;obligation légale.
      </p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>Données de compte : aussi longtemps que votre compte est actif, puis 3 ans.</li>
        <li>Données de commande : 10 ans pour des raisons fiscales et comptables.</li>
        <li>Logs techniques : 12 mois maximum.</li>
      </ul>

      <h2>6. Vos droits</h2>
      <p>
        Conformément aux lois applicables à la protection des données, vous disposez
        des droits suivants :
      </p>
      <ul>
        <li><strong>Accès</strong> à vos données.</li>
        <li><strong>Rectification</strong> des données inexactes.</li>
        <li><strong>Effacement</strong> (« droit à l&apos;oubli »).</li>
        <li><strong>Limitation</strong> du traitement.</li>
        <li><strong>Portabilité</strong> de vos données dans un format structuré.</li>
        <li><strong>Opposition</strong> au traitement pour motif légitime.</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez{" "}
        <a href="mailto:privacy@linkboutik.com">privacy@linkboutik.com</a>. Nous
        répondrons dans un délai d&apos;un mois.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Nous utilisons des cookies strictement nécessaires au fonctionnement du service
        (session d&apos;authentification, panier d&apos;achat) ainsi que des cookies de mesure
        d&apos;audience anonymisée. Aucun cookie de profilage publicitaire n&apos;est utilisé.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles
        appropriées pour protéger vos données : chiffrement en transit (HTTPS), Row
        Level Security en base de données, accès restreints, audits réguliers.
      </p>

      <h2>9. Mineurs</h2>
      <p>
        Le service n&apos;est pas destiné aux personnes de moins de 18 ans. Nous ne
        collectons pas sciemment de données concernant des mineurs.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. La version en vigueur est toujours
        accessible à l&apos;adresse <Link href="/legal/privacy">/legal/privacy</Link>.
      </p>

      <h2>11. Contact</h2>
      <p>
        Délégué à la protection des données :{" "}
        <a href="mailto:privacy@linkboutik.com">privacy@linkboutik.com</a>.
      </p>
    </>
  );
}
