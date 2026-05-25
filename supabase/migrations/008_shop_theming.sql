-- ---------------------------------------------------------------------------
-- Migration 008: Shop theming — granular design controls
-- ---------------------------------------------------------------------------
-- Adds six new columns to public.shops so creators can tune their storefront
-- design beyond just a template + primary color:
--   * accent_color   — secondary brand color (text-on-primary, secondary CTAs)
--   * font_family    — typography family used by the storefront
--   * border_radius  — global radius scale for product cards
--   * card_style     — product card visual style (flat / bordered / elevated / glass)
--   * cta_shape      — CTA button shape (pill / rounded / square)
--   * cta_style      — CTA button style (filled / outline / soft)
--
-- All columns are NOT NULL with sensible defaults so existing rows stay valid.
-- CHECK constraints enforce the same enums declared client-side.
-- ---------------------------------------------------------------------------

alter table public.shops
  add column if not exists accent_color  text not null default '#0F172A',
  add column if not exists font_family   text not null default 'sans',
  add column if not exists border_radius text not null default 'lg',
  add column if not exists card_style    text not null default 'bordered',
  add column if not exists cta_shape     text not null default 'rounded',
  add column if not exists cta_style     text not null default 'filled';

-- Drop constraints first if they exist (idempotent re-run safety)
alter table public.shops
  drop constraint if exists shops_accent_color_format,
  drop constraint if exists shops_font_family_enum,
  drop constraint if exists shops_border_radius_enum,
  drop constraint if exists shops_card_style_enum,
  drop constraint if exists shops_cta_shape_enum,
  drop constraint if exists shops_cta_style_enum;

alter table public.shops
  add constraint shops_accent_color_format
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint shops_font_family_enum
    check (font_family in ('sans','serif','mono','display')),
  add constraint shops_border_radius_enum
    check (border_radius in ('none','sm','md','lg','xl','2xl')),
  add constraint shops_card_style_enum
    check (card_style in ('flat','bordered','elevated','glass')),
  add constraint shops_cta_shape_enum
    check (cta_shape in ('pill','rounded','square')),
  add constraint shops_cta_style_enum
    check (cta_style in ('filled','outline','soft'));

comment on column public.shops.accent_color  is 'Secondary brand color, used for text-on-primary and secondary CTAs (#RRGGBB).';
comment on column public.shops.font_family   is 'Typography family for the storefront (sans|serif|mono|display).';
comment on column public.shops.border_radius is 'Global radius scale for product cards (none|sm|md|lg|xl|2xl).';
comment on column public.shops.card_style    is 'Product card visual style (flat|bordered|elevated|glass).';
comment on column public.shops.cta_shape     is 'CTA button shape (pill|rounded|square).';
comment on column public.shops.cta_style     is 'CTA button style (filled|outline|soft).';
