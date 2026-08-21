-- ---------------------------------------------------------------------------
-- Migration 018: Bio page — Linktree-grade public page
-- ---------------------------------------------------------------------------
-- The public page at /{slug} is no longer a banner + product grid: it is a
-- centred "link in bio" page with a Liens / Boutique switch, exactly the
-- surface a creator pastes in their TikTok or Instagram bio.
--
-- Adds:
--   * shops.bio_theme         — curated full-page theme preset (background,
--                               button surface, text colors). 'brand' derives
--                               everything from the shop's own colors.
--   * shop_links.thumbnail_url — square image shown at the left of a link
--                               button (the visual that makes Linktree rows
--                               tappable and recognisable).
--   * shop_links.click_count  — how many times the button was tapped.
--   * track_shop_link_click() — SECURITY DEFINER RPC so anonymous visitors can
--                               increment that counter without an UPDATE
--                               policy on shop_links.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. shops.bio_theme
-- ---------------------------------------------------------------------------

alter table public.shops
  add column if not exists bio_theme text not null default 'classic';

alter table public.shops
  drop constraint if exists shops_bio_theme_enum;

alter table public.shops
  add constraint shops_bio_theme_enum
    check (bio_theme in (
      'classic','noir','lagoon','sunset','sahel',
      'kente','mint','lavender','midnight','brand'
    ));

comment on column public.shops.bio_theme is
  'Full-page theme preset for the public bio page (see src/lib/bio-themes.ts). ''brand'' derives the palette from theme_color/accent_color.';

-- ---------------------------------------------------------------------------
-- 2. shop_links.thumbnail_url + click_count
-- ---------------------------------------------------------------------------

alter table public.shop_links
  add column if not exists thumbnail_url text,
  add column if not exists click_count   integer not null default 0;

alter table public.shop_links
  drop constraint if exists shop_links_thumbnail_url_format,
  drop constraint if exists shop_links_click_count_positive;

alter table public.shop_links
  add constraint shop_links_thumbnail_url_format
    check (
      thumbnail_url is null
      or (thumbnail_url ~ '^https://' and char_length(thumbnail_url) <= 500)
    ),
  add constraint shop_links_click_count_positive
    check (click_count >= 0);

comment on column public.shop_links.thumbnail_url is
  'Square image (https only) displayed at the left of the link button.';
comment on column public.shop_links.click_count is
  'Number of taps on this link button. Incremented via track_shop_link_click().';

-- ---------------------------------------------------------------------------
-- 3. track_shop_link_click(uuid)
-- ---------------------------------------------------------------------------
-- Anonymous visitors must be able to count a tap, but shop_links has no public
-- UPDATE policy (and must not get one — that would let anyone rewrite a
-- seller's URLs). A SECURITY DEFINER function with a pinned search_path gives
-- exactly one capability: +1 on the counter of an active link that belongs to
-- a published shop. Unknown ids are a silent no-op so the endpoint cannot be
-- used to probe which link ids exist.

create or replace function public.track_shop_link_click(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.shop_links l
     set click_count = l.click_count + 1
   where l.id = p_link_id
     and l.is_active = true
     and exists (
       select 1
         from public.shops s
        where s.id = l.shop_id
          and s.is_published = true
     );
end;
$$;

comment on function public.track_shop_link_click(uuid) is
  'Increments click_count for an active link of a published shop. Safe to call anonymously; unknown ids are a no-op.';

revoke all on function public.track_shop_link_click(uuid) from public;
grant execute on function public.track_shop_link_click(uuid) to anon, authenticated;
