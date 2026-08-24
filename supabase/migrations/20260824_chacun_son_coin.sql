-- ---------------------------------------------------------------------------
-- Chacun son coin : refermer trois portes restées ouvertes
-- ---------------------------------------------------------------------------
-- Appliquée sur le projet `linkboutik` le 2026-08-24. Conservée ici pour que
-- l'historique du schéma vive dans le dépôt et pas seulement dans la console.

-- 1. Plus d'insertion anonyme de commandes.
--    `orders: public insert` autorisait n'importe qui muni de la clé anonyme
--    (qui est publique — elle part dans le navigateur de chaque visiteur) à
--    créer des commandes arbitraires dans n'importe quelle boutique publiée :
--    faux nom, faux téléphone, montant choisi. Illisibles pour l'attaquant,
--    mais bien visibles dans la liste des commandes du vendeur et comptées
--    dans son chiffre d'affaires.
--    Aucune perte : /api/checkout écrit avec la clé de service, jamais avec le
--    client anonyme (voir le commentaire de src/app/api/checkout/route.ts).
drop policy if exists "orders: public insert" on public.orders;

-- 2. Même chose pour order_items, table qui n'est même plus utilisée : les
--    lignes d'une commande sont stockées en JSONB sur `orders`.
drop policy if exists "order_items: public insert" on public.order_items;

-- 3. profiles était en lecture publique intégrale (`using (true)`).
--    Pas d'e-mail ni de téléphone dedans, mais username, `full_name` (le vrai
--    nom civil, tel que Google le renvoie) et bio de TOUS les inscrits —
--    y compris ceux qui n'ont jamais publié de page. Un compte non publié n'a
--    rien demandé de tel.
--    Désormais : ton propre profil, plus ceux dont une boutique est publiée.
drop policy if exists "profiles: public read" on public.profiles;

create policy "profiles: read own or published"
  on public.profiles
  for select
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.shops s
      where s.owner_id = profiles.id
        and s.is_published = true
    )
  );

-- 4. Le formulaire d'inscription vérifiait la disponibilité d'un pseudo en
--    lisant `profiles` — c'est ce qui rendait la lecture publique nécessaire.
--    Cette fonction répond à la seule question utile, par oui ou par non, et
--    ne laisse rien filtrer d'autre. `search_path` est figé : sans ça, une
--    fonction SECURITY DEFINER peut être détournée vers une table homonyme.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
