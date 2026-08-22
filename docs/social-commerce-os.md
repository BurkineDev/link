# Bio-Lien → Social Commerce OS

Document de référence pour la refonte progressive. **Phase 0 : audit, gap
analysis, plan de migration.** Écrit à partir du code réel, pas d'hypothèses.

---

## 1. Audit de l'existant

| Domaine | État constaté |
|---|---|
| Frontend | Next.js **16.2.6** (App Router), React 19.2, TypeScript, Tailwind v4, Radix/shadcn, Zustand (panier), Sonner (toasts) |
| Backend | Routes API Next (`src/app/api/**`), pas de serveur séparé |
| Base de données | Supabase Postgres, **19 migrations**, RLS activée sur toutes les tables publiques |
| Authentification | Supabase Auth (email/mot de passe + Google), trigger `handle_new_user()` qui crée le profil |
| Paiements | **Stripe** (checkout, abonnements, boosts, webhook signé) et **GeniusPay** (mobile money, webhook signé) |
| Stock | RPC `reserve_stock` / `release_stock` en `security definer`, appelées côté checkout |
| Analytics | `shop_page_views` (compteur/jour), `shop_links.click_count`, RPC de tracking anonymes |
| Abonnements | `creator_subscriptions` + `PLAN_LIMITS` (free/starter/pro) |
| Tests | **127 tests**, 8 suites (checkout, webhooks Stripe & GeniusPay, abonnements, thèmes, WhatsApp, auth) |

### Tables

`profiles`, `templates`, `shops`, `categories`, `products`, `product_variants`,
`orders`, `order_items`, `creator_subscriptions`, `shop_links`, `promo_codes`,
`boost_purchases`, `shop_page_views`.

### Routes

25 routes API, 24 pages. Publiques : `/{username}`, `/{username}/{produit}`,
`/explore`, `/checkout`, `/outils`, `/pricing`. Dashboard : 10 pages.

---

## 2. Gap analysis

### ✅ À CONSERVER (fonctionne, testé, ne pas toucher pour uniformiser)

- **Les deux intégrations de paiement.** Stripe et GeniusPay sont câblées, avec
  signature de webhook vérifiée et idempotence (`payment_status` déjà réglé →
  no-op). 4 suites de tests les couvrent.
- **La réservation de stock** par RPC atomique — protège de la survente.
- **Le socle RLS.** Chaque table publique a ses politiques ; les écritures
  anonymes passent par des fonctions `security definer` à capacité unique.
- **Les thèmes de BioPage** (`bio-themes.ts`) et leurs garde-fous de contraste.
- **Les stories générées** (page + produit) et le tracking clics/vues.
- **Le checkout invité** — aucun compte requis pour acheter, déjà conforme à la cible.

### ♻️ À REFACTORER

| Sujet | Problème | Direction |
|---|---|---|
| **Objet racine** | `shops` est la racine ; la page bio est un rendu dérivé | `shops` devient le **Business** ; la page devient une composition de **Blocks** |
| **Composition de page** | Liens et produits sont deux listes câblées en dur dans le rendu | Table `page_blocks` typée et ordonnable |
| **Entitlements** | `plan === "pro"` dispersé dans 6+ fichiers | Fonction `can(business, capability)` centralisée |
| **Statuts de commande** | 7 statuts, pas d'historique | Ajouter `PREPARING`/`READY`/`PAYMENT_FAILED` + `order_timeline` |
| **Analytics** | 2 compteurs agrégés, pas d'événements | Table `analytics_events` typée, funnel calculable |
| **Onboarding** | Orienté « boutique » | Orienté intention (« que veux-tu faire ? ») |

### 🆕 À CRÉER

`page_blocks` (+ registre de types), `customers` (CRM), `order_timeline`,
`analytics_events`, entitlements, Page Builder, funnel, suivi de commande public.

### ⏬ À DÉPRIORISER

- `templates` — table morte depuis la refonte bio (les thèmes l'ont remplacée).
- `/explore` — conservé, mais couche de distribution secondaire tant que le
  nombre de vendeurs est faible.
- `boost_purchases` (mise en avant payante) — dépend d'un `/explore` fréquenté.

---

## 3. Décisions d'architecture (hypothèses documentées)

1. **`shops` EST le Business.** Créer une table `businesses` imposerait de
   réécrire 19 migrations de RLS, tous les webhooks et tout le dashboard, pour
   un gain nul aujourd'hui (1 business = 1 vendeur). La table est renommée
   *conceptuellement*, pas physiquement. Le jour où un vendeur aura plusieurs
   pages ou plusieurs membres, `shops.id` deviendra `business_id` sans rupture.

2. **Une BioPage par Business, portée par `shops`.** Le slug (`/{username}`),
   le thème, le profil et la publication vivent déjà sur `shops`. Y ajouter une
   table `bio_pages` 1:1 n'apporterait qu'une jointure. Les Blocks référencent
   donc `shop_id` — renommable plus tard en `page_id`.

3. **`config` en JSONB validé par Zod**, pas une colonne par type de bloc :
   c'est ce qui permet d'ajouter un BlockType sans migration ni réécriture du
   Page Builder, comme l'exige la mission.

4. **Rétrocompatibilité par synthèse.** Tant qu'un vendeur n'a pas de blocs, la
   page publique en *synthétise* depuis ses liens et produits existants. Aucune
   page ne casse, aucune donnée n'est perdue, et la migration se fait au premier
   passage dans le Page Builder.

---

## 4. Plan de migration par phases

| Phase | Contenu | État |
|---|---|---|
| 0 | Audit, gap analysis, décisions | ✅ ce document |
| 1 | Modèle `Block` + registre de types + résolveur rétrocompatible | 🚧 en cours |
| 2 | Onboarding par intention + Page Builder + preview | à venir |
| 3 | Page publique pilotée par les blocs | à venir |
| 4 | Produits (collections, SEO, disponibilité) | à venir |
| 5 | Commandes : state machine + timeline + durcissement paiement | à venir |
| 6 | Customers / CRM | à venir |
| 7 | Analytics event-driven + funnel | à venir |
| 8 | Growth (coupons, UTM, relance panier) | à venir |
| 9 | Recommandations | à venir |
| 10 | Marketplace | à venir |

À la fin de chaque phase : lint, typecheck, tests, build, migrations, revue
sécurité, vérification de non-régression.

---

## 5. Boucle produit de référence

Toute fonctionnalité doit servir :

```
BIOPAGE → ATTIRER → VENDRE → ENCAISSER → LIVRER → FIDÉLISER → DÉVELOPPER
```

Test à appliquer à chaque proposition : aide-t-elle le vendeur à créer sa
présence, obtenir du trafic, convertir, vendre, encaisser, gérer, fidéliser,
comprendre ? Si non partout : ce n'est pas prioritaire.
