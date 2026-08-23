This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Create a local environment file with the app, Supabase, Stripe, and Anthropic values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
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

## Notifications WhatsApp du vendeur

Quand une commande passe en « payé » (webhooks Stripe et GeniusPay), le
vendeur est prévenu sur WhatsApp par deux canaux complémentaires :

**1. Relais acheteur — actif sans aucune configuration.** La page de succès
du paiement propose à l'acheteur « Prévenir le vendeur sur WhatsApp » : un
wa.me pré-rempli (référence, total, nom) vers le numéro du vendeur. C'est la
norme du commerce visé — et ce message ouvre la fenêtre de service de 24 h
côté Meta, qui rend le canal 2 livrable en texte libre.

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

Stripe Checkout redirects back to `/checkout/success?session_id=...`. Configure
the Stripe webhook URL as `/api/webhooks/stripe` and subscribe to
`checkout.session.completed` and `checkout.session.expired`.

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
