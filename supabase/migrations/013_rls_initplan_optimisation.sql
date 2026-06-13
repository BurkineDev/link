-- =============================================================================
-- Bio-Lien — RLS performance: wrap auth.uid() in (select auth.uid())
-- Migration: 013_rls_initplan_optimisation.sql
-- =============================================================================
-- The Supabase performance advisor (auth_rls_initplan) flagged every owner
-- policy: `auth.uid()` is re-evaluated once PER ROW, which degrades at scale.
-- Wrapping it as `(select auth.uid())` lets Postgres evaluate it once as an
-- initplan. Pure performance change — the predicates are semantically
-- identical. Policies are dropped + recreated; behaviour is unchanged.
--
-- Only policies that referenced auth.uid() are touched. Public-only policies
-- (templates, profiles public read, the public insert policies on orders /
-- order_items) are left as-is.
-- =============================================================================

-- ---- boost_purchases --------------------------------------------------------
drop policy if exists "boost_purchases: owner read" on public.boost_purchases;
create policy "boost_purchases: owner read" on public.boost_purchases
  for select using (user_id = (select auth.uid()));

-- ---- creator_subscriptions --------------------------------------------------
drop policy if exists "creator_subscriptions: owner read" on public.creator_subscriptions;
create policy "creator_subscriptions: owner read" on public.creator_subscriptions
  for select using (user_id = (select auth.uid()));

-- ---- categories -------------------------------------------------------------
drop policy if exists "categories: owner delete" on public.categories;
create policy "categories: owner delete" on public.categories
  for delete using (exists (
    select 1 from public.shops
    where shops.id = categories.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "categories: owner insert" on public.categories;
create policy "categories: owner insert" on public.categories
  for insert with check (exists (
    select 1 from public.shops
    where shops.id = categories.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "categories: owner update" on public.categories;
create policy "categories: owner update" on public.categories
  for update using (exists (
    select 1 from public.shops
    where shops.id = categories.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select using (exists (
    select 1 from public.shops
    where shops.id = categories.shop_id
      and (shops.is_published = true or shops.owner_id = (select auth.uid()))));

-- ---- order_items ------------------------------------------------------------
drop policy if exists "order_items: owner read" on public.order_items;
create policy "order_items: owner read" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = order_items.order_id and s.owner_id = (select auth.uid())));

-- ---- orders -----------------------------------------------------------------
drop policy if exists "orders: owner read" on public.orders;
create policy "orders: owner read" on public.orders
  for select using (exists (
    select 1 from public.shops
    where shops.id = orders.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "orders: owner update" on public.orders;
create policy "orders: owner update" on public.orders
  for update using (exists (
    select 1 from public.shops
    where shops.id = orders.shop_id and shops.owner_id = (select auth.uid())));

-- ---- products ---------------------------------------------------------------
drop policy if exists "products: owner delete" on public.products;
create policy "products: owner delete" on public.products
  for delete using (exists (
    select 1 from public.shops
    where shops.id = products.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "products: owner insert" on public.products;
create policy "products: owner insert" on public.products
  for insert with check (exists (
    select 1 from public.shops
    where shops.id = products.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "products: owner update" on public.products;
create policy "products: owner update" on public.products
  for update using (exists (
    select 1 from public.shops
    where shops.id = products.shop_id and shops.owner_id = (select auth.uid())));

drop policy if exists "products: public read published" on public.products;
create policy "products: public read published" on public.products
  for select using (
    is_published = true or exists (
      select 1 from public.shops
      where shops.id = products.shop_id and shops.owner_id = (select auth.uid())));

-- ---- product_variants -------------------------------------------------------
drop policy if exists "product_variants: owner delete" on public.product_variants;
create policy "product_variants: owner delete" on public.product_variants
  for delete using (exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_variants.product_id and s.owner_id = (select auth.uid())));

drop policy if exists "product_variants: owner insert" on public.product_variants;
create policy "product_variants: owner insert" on public.product_variants
  for insert with check (exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_variants.product_id and s.owner_id = (select auth.uid())));

drop policy if exists "product_variants: owner update" on public.product_variants;
create policy "product_variants: owner update" on public.product_variants
  for update using (exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_variants.product_id and s.owner_id = (select auth.uid())));

drop policy if exists "product_variants: public read via published product" on public.product_variants;
create policy "product_variants: public read via published product" on public.product_variants
  for select using (exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_variants.product_id
      and (p.is_published = true or s.owner_id = (select auth.uid()))));

-- ---- profiles ---------------------------------------------------------------
drop policy if exists "profiles: owner update" on public.profiles;
create policy "profiles: owner update" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---- promo_codes ------------------------------------------------------------
drop policy if exists "promo_codes: owner delete" on public.promo_codes;
create policy "promo_codes: owner delete" on public.promo_codes
  for delete using (exists (
    select 1 from public.shops s
    where s.id = promo_codes.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "promo_codes: owner insert" on public.promo_codes;
create policy "promo_codes: owner insert" on public.promo_codes
  for insert with check (exists (
    select 1 from public.shops s
    where s.id = promo_codes.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "promo_codes: owner select" on public.promo_codes;
create policy "promo_codes: owner select" on public.promo_codes
  for select using (exists (
    select 1 from public.shops s
    where s.id = promo_codes.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "promo_codes: owner update" on public.promo_codes;
create policy "promo_codes: owner update" on public.promo_codes
  for update using (exists (
    select 1 from public.shops s
    where s.id = promo_codes.shop_id and s.owner_id = (select auth.uid())));

-- ---- shop_links -------------------------------------------------------------
drop policy if exists "shop_links: owner delete" on public.shop_links;
create policy "shop_links: owner delete" on public.shop_links
  for delete using (exists (
    select 1 from public.shops s
    where s.id = shop_links.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "shop_links: owner insert" on public.shop_links;
create policy "shop_links: owner insert" on public.shop_links
  for insert with check (exists (
    select 1 from public.shops s
    where s.id = shop_links.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "shop_links: owner update" on public.shop_links;
create policy "shop_links: owner update" on public.shop_links
  for update using (exists (
    select 1 from public.shops s
    where s.id = shop_links.shop_id and s.owner_id = (select auth.uid())));

drop policy if exists "shop_links: public read active" on public.shop_links;
create policy "shop_links: public read active" on public.shop_links
  for select using (
    (is_active = true and exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.is_published = true))
    or exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.owner_id = (select auth.uid())));

-- ---- shops ------------------------------------------------------------------
drop policy if exists "shops: owner delete" on public.shops;
create policy "shops: owner delete" on public.shops
  for delete using (owner_id = (select auth.uid()));

drop policy if exists "shops: owner insert" on public.shops;
create policy "shops: owner insert" on public.shops
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists "shops: owner update" on public.shops;
create policy "shops: owner update" on public.shops
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "shops: public read published" on public.shops;
create policy "shops: public read published" on public.shops
  for select using (is_published = true or owner_id = (select auth.uid()));

-- =============================================================================
-- End of migration 013_rls_initplan_optimisation.sql
-- =============================================================================
