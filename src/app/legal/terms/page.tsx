export const metadata = {
  title: "Conditions Générales d'Utilisation | LinkBoutik",
  description:
    "Conditions générales d'utilisation de la plateforme LinkBoutik pour les créateurs et acheteurs.",
};

const LAST_UPDATED = "24 mai 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Conditions Générales d&apos;Utilisation</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (« CGU ») régissent l&apos;accès et
        l&apos;utilisation de la plateforme LinkBoutik (« la Plateforme »), un service en
        ligne permettant aux créateurs et entrepreneurs (« Vendeurs ») de créer une
        boutique en ligne et d&apos;y vendre leurs produits à leurs clients (« Acheteurs »).
      </p>

      <h2>2. Acceptation des CGU</h2>
      <p>
        L&apos;utilisation de la Plateforme implique l&apos;acceptation sans réserve des
        présentes CGU. Si vous n&apos;êtes pas d&apos;accord avec ces conditions, vous ne devez
        pas utiliser la Plateforme.
      </p>

      <h2>3. Inscription et compte utilisateur</h2>
      <p>
        Pour créer une boutique, le Vendeur doit créer un compte en fournissant des
        informations exactes et à jour. Le Vendeur est seul responsable de la
        confidentialité de son mot de passe. Toute activité réalisée depuis le compte
        est présumée effectuée par son titulaire.
      </p>
      <ul>
        <li>Le Vendeur doit être âgé d&apos;au moins 18 ans (ou de l&apos;âge légal de la majorité dans son pays).</li>
        <li>Un seul compte par personne physique est autorisé.</li>
        <li>LinkBoutik se réserve le droit de suspendre tout compte en cas d&apos;usage frauduleux.</li>
      </ul>

      <h2>4. Plans et facturation</h2>
      <p>
        LinkBoutik propose deux plans :
      </p>
      <ul>
        <li>
          <strong>Plan Gratuit</strong> : limité à 5 produits par boutique. Une commission
          de 5% est prélevée sur chaque vente pour couvrir les frais de la plateforme.
        </li>
        <li>
          <strong>Plan Pro (5 000 FCFA / mois)</strong> : produits illimités, 0% de
          commission, analytics avancés, support prioritaire.
        </li>
      </ul>
      <p>
        L&apos;abonnement Pro est facturé mensuellement via Stripe. Le Vendeur peut résilier
        son abonnement à tout moment depuis son profil. La résiliation prend effet à la
        fin de la période de facturation en cours.
      </p>

      <h2>5. Rôle de LinkBoutik</h2>
      <p>
        LinkBoutik agit en tant que prestataire technique et intermédiaire de paiement.
        Le contrat de vente est conclu directement entre le Vendeur et l&apos;Acheteur.
        LinkBoutik n&apos;est pas partie à ce contrat de vente et n&apos;est pas responsable des
        produits vendus, de leur conformité, de leur livraison ou de leur après-vente.
      </p>

      <h2>6. Obligations du Vendeur</h2>
      <p>Le Vendeur s&apos;engage à :</p>
      <ul>
        <li>Respecter la législation applicable, notamment en matière de vente à distance, de fiscalité et de protection des consommateurs.</li>
        <li>Décrire ses produits de manière exacte et complète (prix, disponibilité, frais de livraison).</li>
        <li>Honorer les commandes payées dans des délais raisonnables.</li>
        <li>Ne pas vendre de produits illicites, dangereux, contrefaits ou contraires aux bonnes mœurs.</li>
        <li>Gérer le service après-vente, les retours et les remboursements avec ses Acheteurs.</li>
      </ul>

      <h2>7. Paiements et reversements</h2>
      <p>
        Les paiements sont traités par Stripe. LinkBoutik collecte les paiements pour le
        compte du Vendeur puis lui reverse les sommes dues, déduction faite de la
        commission applicable et des frais de paiement Stripe. Les conditions de
        reversement sont communiquées au Vendeur lors de la configuration de sa boutique.
      </p>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        Le Vendeur conserve l&apos;intégralité des droits sur le contenu (textes, images,
        marques) qu&apos;il publie sur sa boutique. En publiant ce contenu, il concède à
        LinkBoutik une licence non exclusive et gratuite pour l&apos;héberger, l&apos;afficher
        publiquement et le distribuer dans le cadre du fonctionnement de la Plateforme.
      </p>

      <h2>9. Suspension et résiliation</h2>
      <p>
        LinkBoutik se réserve le droit de suspendre ou résilier un compte en cas de
        manquement grave aux présentes CGU, sans préavis et sans indemnité. Le Vendeur
        peut résilier son compte à tout moment depuis ses paramètres.
      </p>

      <h2>10. Responsabilité</h2>
      <p>
        LinkBoutik est tenue à une obligation de moyens et ne saurait être responsable
        des préjudices indirects subis par le Vendeur ou par un Acheteur. Sa
        responsabilité ne pourra excéder le montant des sommes versées par le Vendeur au
        titre de son abonnement au cours des 12 derniers mois.
      </p>

      <h2>11. Modification des CGU</h2>
      <p>
        LinkBoutik peut modifier les présentes CGU à tout moment. Les utilisateurs
        seront informés par email au moins 15 jours avant l&apos;entrée en vigueur des
        modifications.
      </p>

      <h2>12. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGU sont soumises au droit en vigueur dans le pays du siège social
        de LinkBoutik. Tout litige sera soumis aux tribunaux compétents de ce ressort,
        sauf disposition légale impérative contraire.
      </p>

      <h2>13. Contact</h2>
      <p>
        Pour toute question relative aux présentes CGU, contactez-nous à l&apos;adresse{" "}
        <a href="mailto:support@linkboutik.com">support@linkboutik.com</a>.
      </p>
    </>
  );
}
