This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Mode par défaut : la commande part sur WhatsApp

Depuis le 14 septembre 2026 (décision fondateur), **Bio-Lien ne porte plus
l'argent des ventes**. Toute boutique fonctionne en mode WhatsApp : le bouton
« Commander sur WhatsApp » ouvre une conversation avec un message pré-rempli
(articles, total, référence), la commande apparaît **Non payée** dans le
tableau de bord, et c'est le vendeur qui la marque payée quand l'argent est
là — Mobile Money, espèces, virement, ça se règle entre lui et l'acheteur.

Le mode **En ligne** — la caisse Bio-Lien : Mobile Money acheteur via Genius
Pay, carte via Stripe Checkout, paiement à la livraison, livraison facturée,
commission 5 / 3 / 0 % selon le plan, grand livre et reversements — est
**masqué derrière un drapeau**, code conservé, réversible :

```bash
# Vide ou absente (le défaut) : caisse masquée, tout passe par WhatsApp.
# « 1 » : rallume la caisse pour tout le monde (Stripe / Mobile Money côté
# acheteur, paiement à la livraison, commission, reversements à l'écran).
# Valeur NEXT_PUBLIC_ : figée dans les bundles au build — redéployer après
# l'avoir changée. Voir src/lib/payments/online-checkout.ts.
NEXT_PUBLIC_ONLINE_CHECKOUT=
```

Le drapeau ne touche pas au revenu de Bio-Lien : les **abonnements vendeurs**
(Stripe par carte en CAD, Genius Pay prépayé en XOF) et les **boosts** ne le
lisent jamais. `STRIPE_*` et `GENIUSPAY_*` restent donc requis en production,
drapeau éteint compris. L'endpoint Stripe `/api/webhooks/stripe` doit recevoir
`checkout.session.completed`, `checkout.session.expired`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`, `charge.refunded`, `charge.dispute.created` et
`charge.dispute.closed`. Les commandes historiques `stripe` / `geniuspay` /
`cash_on_delivery` restent lisibles : aucune colonne, aucun enum, aucune
migration n'a été retirée. Les paragraphes marqués « mode En ligne, derrière
le drapeau » plus bas décrivent des parcours qui ne s'exécutent que drapeau
allumé.

## Getting Started

Create a local environment file (`.env.local`, see `.env.example`) with the
app, Neon, Stripe, and Anthropic values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Branche Neon « development » (schéma seul, sans données de production) :
#   npx neonctl connection-string development --project-id <projet> --pooled
DATABASE_URL=postgresql://...-pooler.<region>.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...<region>.aws.neon.tech/neondb?sslmode=require
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Required by the free AI tools under /api/outils/* (product descriptions, WhatsApp messages)
ANTHROPIC_API_KEY=sk-ant-...
# Distributed rate limiting + global budget cap for the AI tools (Upstash Redis).
# Provision via the Vercel Marketplace (Upstash) and copy the REST credentials.
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

The `/api/outils/*` endpoints are public and unauthenticated. They are
protected in three layers (see `src/lib/rate-limit.ts`):

- in-memory per-IP burst (instant, per-instance);
- distributed per-IP limits via Upstash — 10/min and 30/day;
- a **global daily budget ceiling of 300 generations/day** shared across all
  IPs and tools — the real guard on the Anthropic spend.

If the Upstash variables are absent (e.g. local dev) only the in-memory layer
applies, so **production must set them** for the distributed limits and budget
cap to take effect.

### Base de données : chaque environnement sur sa branche Neon

`src/lib/db/database-guard.ts` connaît l'endpoint Neon de la branche de
production et vérifie les deux sens, au démarrage du serveur (`next dev`,
`next start`, previews) comme au lancement du CLI Prisma (`migrate`,
`db push`, `studio`, `generate`) :

- hors d'un vrai déploiement Vercel Production, `DATABASE_URL` et
  `DIRECT_URL` ne doivent pas viser la production (dérogation assumée pour
  une maintenance : `ALLOW_PRODUCTION_DATABASE=1`) ;
- sur Vercel Production, elles doivent viser l'endpoint de production, sans
  dérogation : le build échoue et l'ancien déploiement reste en ligne. Pour
  changer de base de production, ajouter le nouvel endpoint à
  `PRODUCTION_DATABASE_HOST`.

Le développement local et les previews Vercel utilisent la branche Neon
`development`, créée en mode schéma seul. Ne tirez jamais le scope production
avec `vercel env pull`, et ne collez jamais les URL de `development` dans
Vercel Production.

**Previews désactivées pour l'instant.** Les variables Vercel sont
synchronisées depuis Infisical (environnement « Production »), et ce
mapping donne aujourd'hui aux previews la `DATABASE_URL` de production : le
garde-fou refuse le build (c'est son rôle) et chaque PR porte un check Vercel
rouge. En attendant que le mapping envoie la branche `development` à
Preview, `vercel.json` porte un `ignoreCommand` qui ne construit que
Vercel Production (`VERCEL_ENV=production`) ; les previews sont ignorées,
pas en échec. Retirer cette ligne le jour où Preview reçoit ses propres
variables.

### Santé, alertes et rapport quotidien

Tout ce qui casse en silence (webhook rejeté, paiement arrivé après
annulation, réconciliation en panne, e-mail mort, cron muet) est écrit dans
`ops_events` par `src/lib/ops/events.ts` et visible dans **Équipe → Santé**
(`/dashboard/admin/ops`, réservé à `ADMIN_EMAILS`). Une alerte **critique**
part aussitôt par e-mail à `ADMIN_EMAILS` (au plus une par problème toutes
les six heures) ; le reste attend le **rapport quotidien**, envoyé à la fin
du cron de 03:00 UTC — s'il n'arrive pas, c'est que le cron n'a pas tourné
ou que l'e-mail est en panne : dans les deux cas `/api/health` répond 503.

- `GET /api/health` (public, sans secret, 30 appels/min par IP) répond
  **200** ou **503** selon que la base répond, que toutes les migrations du
  build sont appliquées (l'incident du 13/09/2026 : code déployé avant sa
  migration), que le cron a tourné depuis moins de 26 h et que Resend n'a
  pas refusé d'envoi récemment. Branchez-le sur un moniteur gratuit
  (UptimeRobot, Better Stack…) toutes les cinq minutes : c'est lui qui
  appelle quand la page répond 503.
- `OPS_ALERT_WEBHOOK_URL` (optionnel) : un webhook sortant (Slack, ntfy…)
  qui reçoit chaque alerte critique en JSON (`text`, `title`, `severity`),
  utile quand c'est l'e-mail lui-même qui est en panne.
- Déploiement : appliquer `npm run db:deploy` (ou `prisma migrate deploy`)
  **avant** de fusionner une PR qui porte une migration — `/api/health`
  passe au rouge sinon, mais les pages, elles, tombent en 500.
- **Sonde TikTok** (`src/lib/ops/tiktok-link.ts`) : TikTok fait passer
  chaque lien de bio par `www.tiktok.com/link/v2` et décide par domaine —
  302 direct pour les domaines qu'il connaît (Linktree, Instagram, wa.me…
  et même example.com), page « Tu quittes TikTok… Ouvrir quand même » pour
  `bio-lien.com` (mesuré le 16/09/2026 ; rien côté site n'y change). Le
  cron rejoue la requête chaque nuit : la phrase est dans le rapport et
  sur l'écran Santé, et une alerte s'ouvre le jour où le statut bascule
  (`tiktok.link_direct` / `tiktok.link_interstitial`, et `tiktok.link_blocked`,
  critique, si TikTok sert sa page « Ce lien peut être dangereux » — elle
  aussi en 200, d'où la lecture du corps). TikTok tient deux listes : celle
  de l'app (`aid=1233`, le verdict qui compte) et celle du site tiktok.com
  (`aid=1988`), gardée à côté. À la main :
  `curl -s -o /dev/null -w '%{http_code}' 'https://www.tiktok.com/link/v2?aid=1233&scene=bio_url&target=https%3A%2F%2Fwww.bio-lien.com%2F'`
  → `302` = direct, `200` = écran (ou blocage : chercher `open-anyway-button`
  dans le corps pour les distinguer).

## Notifications WhatsApp du vendeur

> **Mode En ligne, derrière le drapeau.** Drapeau éteint (le défaut), il n'y a
> ni webhook de paiement ni page de succès : la commande *est* le message
> WhatsApp que l'acheteur envoie lui-même au vendeur. Ce qui suit ne
> s'exécute que `NEXT_PUBLIC_ONLINE_CHECKOUT=1`.

Quand une commande passe en « payé » (webhooks Stripe et GeniusPay — mode En
ligne, derrière le drapeau), le vendeur est prévenu sur WhatsApp par deux
canaux complémentaires :

**1. Relais acheteur — actif sans aucune configuration (page de succès :
mode En ligne, derrière le drapeau).** La page de succès du paiement propose
à l'acheteur « Prévenir le vendeur sur WhatsApp » : un wa.me pré-rempli
(référence, total, nom) vers le numéro du vendeur. C'est la norme du commerce
visé — et ce message ouvre la fenêtre de service de 24 h côté Meta, qui rend
le canal 2 livrable en texte libre.

**2. API Cloud WhatsApp — quand `WHATSAPP_ACCESS_TOKEN` et
`WHATSAPP_PHONE_NUMBER_ID` sont configurés.** `notifySellerOfPaidOrder()`
tente d'abord le **template** approuvé (`WHATSAPP_ORDER_TEMPLATE`, défaut
`nouvelle_commande`, langue `WHATSAPP_TEMPLATE_LANG`, défaut `fr`) — les
messages initiés par l'entreprise hors fenêtre de 24 h ne sont livrables que
par template (erreur Meta 131047). Si le template échoue, repli en texte
libre (livré si une fenêtre est ouverte), puis journalisation d'un lien
wa.me.

Pour activer le canal 2 : créer une app Meta Business → produit WhatsApp →
récupérer le *Phone Number ID* et un jeton permanent, puis créer et faire
approuver un template `nouvelle_commande` (catégorie Utility, langue fr)
avec ce corps :

```
🛍️ Nouvelle commande !

Client : {{1}}
Articles : {{2}}
Total : {{3}}
Référence : {{4}}

Détails : bio-lien.com/dashboard/orders
```

Les paramètres de template Meta ne peuvent contenir ni URL ni retour à la
ligne — le lien du dashboard doit rester dans le texte statique du template.

## La page bio (`/{slug}`)

The public page a seller pastes in their TikTok / Instagram bio is a centred
link-in-bio page with a **Liens / Boutique** switch — link buttons on one side,
the product catalogue on the other. `/{slug}#boutique` deep-links the shop tab.

Its whole look comes from `shops.bio_theme`, one of the presets in
`src/lib/bio-themes.ts` (`classic`, `noir`, `lagoon`, `sunset`, `sahel`,
`kente`, `mint`, `lavender`, `midnight`, or `brand` — which derives the palette
from the shop's own `theme_color` / `accent_color`). Sellers pick it under
**Réglages → Apparence**, next to a live preview.

Every palette is contrast-checked in `src/__tests__/bio-themes.test.ts`: body
text clears 3:1 on its background and button text clears 4.5:1 on its surface,
including the seller-derived `brand` theme.

The product page `/{slug}/{product}` is painted in the same palette: content
sits on a surface card (which is what keeps text readable under every theme),
with a back-to-shop chip, a per-product share sheet and themed related
products. `primaryActionColor()` picks the button fill that reads on that card
— the theme accent is chosen against the page background and can wash out on
the surface.

Link buttons support a square `thumbnail_url` and count taps through the
public `POST /api/shop-links/{id}/click` endpoint, which is backed by the
`track_shop_link_click()` SECURITY DEFINER function (migration 018) — visitors
can increment a counter without any UPDATE policy on `shop_links`.

**Stripe Checkout acheteur — mode En ligne, derrière le drapeau.** Stripe
Checkout redirects back to `/checkout/success?session_id=...` only when
`NEXT_PUBLIC_ONLINE_CHECKOUT=1`. Configure the Stripe webhook URL as
`/api/webhooks/stripe` regardless: the same endpoint carries the seller
subscriptions, so subscribe to `checkout.session.completed`,
`checkout.session.expired`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`, `charge.refunded`,
`charge.dispute.created` and `charge.dispute.closed`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
