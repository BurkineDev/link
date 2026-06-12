-- =============================================================================
-- Bio-Lien — Checkout mode (WhatsApp vs online) + bucket listing fix
-- Migration: 012_checkout_mode_and_bucket_hardening.sql
-- =============================================================================
-- Per the project concept, the default seller flow is "WhatsApp redirect":
-- the seller showcases products and buyers click "Order on WhatsApp" with a
-- prefilled message. Online payments (Stripe/Mobile Money) are an opt-in
-- advanced mode for sellers who want a real checkout.
--
-- Adds:
--   1. shops.checkout_mode: 'whatsapp' (default) | 'online'
--   2. Composite index supporting the new public marketplace (/explore)
--   3. Removes the listing-permitting SELECT policy on shop-assets — public
--      URLs continue to work (served by the CDN), but the storage API no
--      longer lets arbitrary clients enumerate files.
--
-- Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. shops.checkout_mode
-- ---------------------------------------------------------------------------

alter table public.shops
  add column if not exists checkout_mode text not null default 'whatsapp';

alter table public.shops
  drop constraint if exists shops_checkout_mode_check;

alter table public.shops
  add constraint shops_checkout_mode_check
  check (checkout_mode in ('whatsapp', 'online'));

comment on column public.shops.checkout_mode is
  'How buyers complete a purchase. "whatsapp" (default) opens a prefilled WhatsApp message; "online" enables the Stripe/GeniusPay cart checkout.';

-- ---------------------------------------------------------------------------
-- 2. Marketplace index (/explore)
-- ---------------------------------------------------------------------------
-- Featured shops first (NULL = not boosted, sorts last), then most recently
-- updated. Partial index on published shops keeps it small.

create index if not exists shops_explore_idx
  on public.shops (featured_until desc nulls last, updated_at desc)
  where is_published = true;

-- ---------------------------------------------------------------------------
-- 3. shop-assets bucket — block listing
-- ---------------------------------------------------------------------------
-- The previous "public read" SELECT policy let any client call the storage
-- list/select API and enumerate every file across every shop. Public URLs
-- are served by the CDN and do NOT require this policy. Dropping it keeps
-- image rendering working while closing the enumeration hole.

drop policy if exists "shop-assets: public read" on storage.objects;

-- =============================================================================
-- End of migration 012_checkout_mode_and_bucket_hardening.sql
-- =============================================================================
