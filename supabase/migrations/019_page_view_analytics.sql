-- ---------------------------------------------------------------------------
-- Migration 019: Page view analytics for the public bio page
-- ---------------------------------------------------------------------------
-- Sellers need to see whether their bio link works: how many people open the
-- page, and how many tap each button (shop_links.click_count already counts
-- the taps). This adds the missing half — page views — as a per-day counter,
-- small enough to stay free-tier friendly: one row per shop per day, whatever
-- the traffic.
--
-- Adds:
--   * shop_page_views          — (shop_id, day) → views, upserted counter
--   * track_shop_page_view()   — SECURITY DEFINER RPC so anonymous visitors
--                                can count a view without any INSERT/UPDATE
--                                policy on the table.
-- ---------------------------------------------------------------------------

create table if not exists public.shop_page_views (
  shop_id  uuid not null references public.shops (id) on delete cascade,
  day      date not null,
  views    integer not null default 0,

  primary key (shop_id, day),
  constraint shop_page_views_positive check (views >= 0)
);

comment on table public.shop_page_views is
  'Daily view counter for the public bio page. One row per shop per day, incremented via track_shop_page_view().';

alter table public.shop_page_views enable row level security;

-- Only the shop owner reads their stats; nobody writes through the API —
-- all writes go through the SECURITY DEFINER function below.
drop policy if exists "shop_page_views: owner read" on public.shop_page_views;
create policy "shop_page_views: owner read"
  on public.shop_page_views for select
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_page_views.shop_id
        and s.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- track_shop_page_view(uuid)
-- ---------------------------------------------------------------------------
-- Mirrors track_shop_link_click(): pinned search_path, single capability
-- (+1 on today's counter of a published shop), silent no-op for unknown or
-- unpublished shops so the endpoint cannot probe which ids exist.

create or replace function public.track_shop_page_view(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.is_published = true
  ) then
    insert into public.shop_page_views as v (shop_id, day, views)
    values (p_shop_id, current_date, 1)
    on conflict (shop_id, day)
    do update set views = v.views + 1;
  end if;
end;
$$;

comment on function public.track_shop_page_view(uuid) is
  'Increments today''s view counter for a published shop. Safe to call anonymously; unknown ids are a no-op.';

revoke all on function public.track_shop_page_view(uuid) from public;
grant execute on function public.track_shop_page_view(uuid) to anon, authenticated;
