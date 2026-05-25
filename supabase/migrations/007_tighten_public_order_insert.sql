-- =============================================================================
-- LinkBoutik — Tighten public INSERT policies on orders + order_items
-- Migration: 007_tighten_public_order_insert.sql
-- =============================================================================
-- Buyers remain unauthenticated (anon role) at checkout, but they must only
-- be able to write orders for SHOPS THAT ARE PUBLISHED. The previous
-- `with check (true)` policy let anyone create rows referencing any (or
-- fake) shop_id.
-- =============================================================================

drop policy if exists "orders: public insert" on public.orders;
create policy "orders: public insert"
  on public.orders for insert
  with check (
    exists (
      select 1 from public.shops s
      where s.id = orders.shop_id
        and s.is_published = true
    )
  );

drop policy if exists "order_items: public insert" on public.order_items;
create policy "order_items: public insert"
  on public.order_items for insert
  with check (
    exists (
      select 1
      from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id
        and s.is_published = true
    )
  );
