-- =============================================================================
-- LinkBoutik — Subscription tiers + shop boosts
-- Migration: 011_subscription_tiers_and_boosts.sql
-- =============================================================================
-- Adds:
--   • 'starter' value to the subscription_plan enum (between 'free' and 'pro')
--   • billing_interval on creator_subscriptions ('month' | 'year')
--   • boost_purchases table (one-shot Stripe payments for shop boosts)
--   • shops.featured_until (target of the 'featured_24h' boost)
--
-- The 'free' enum value is kept as the technical name of the Discovery tier
-- (displayed as "Découverte" in the UI). No data migration is needed for
-- existing subscribers — they remain on 'free' with their current limits.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Subscription plan enum: add 'starter'
-- ---------------------------------------------------------------------------

do $$ begin
  alter type public.subscription_plan add value if not exists 'starter' before 'pro';
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- creator_subscriptions.billing_interval
-- ---------------------------------------------------------------------------
-- 'month' for monthly recurring, 'year' for annual prepay. Null for the
-- 'free' (Discovery) plan, which has no Stripe subscription attached.

do $$ begin
  create type public.billing_interval as enum ('month', 'year');
exception when duplicate_object then null;
end $$;

alter table public.creator_subscriptions
  add column if not exists billing_interval public.billing_interval;

-- ---------------------------------------------------------------------------
-- boost_purchases — one-shot Stripe payments that unlock shop boosts
-- ---------------------------------------------------------------------------
-- Currently driven boost types:
--   • 'featured_24h'      — shop promoted on /explore for 24h (500 XOF)
--   • 'custom_domain'     — connect a custom domain (1000 XOF, infra TBD)
--   • 'premium_templates' — unlock the premium templates pack (10000 XOF)
-- The table supports all 3 from day one so future boosts ship without a
-- migration; only 'featured_24h' has an active UX in this sprint.

create table if not exists public.boost_purchases (
  id                          uuid primary key default gen_random_uuid(),
  shop_id                     uuid not null references public.shops(id) on delete cascade,
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  type                        text not null check (type in (
                                'featured_24h',
                                'custom_domain',
                                'premium_templates'
                              )),
  amount                      integer not null check (amount >= 0),
  currency                    text not null default 'XOF',
  status                      text not null default 'pending' check (status in (
                                'pending',
                                'paid',
                                'failed',
                                'expired'
                              )),
  stripe_session_id           text unique,
  stripe_payment_intent_id    text unique,
  activated_at                timestamptz,
  expires_at                  timestamptz,
  metadata                    jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table public.boost_purchases is
  'One-shot Stripe payments that unlock paid boosts on a shop (featured slot, custom domain, premium templates).';

create index if not exists boost_purchases_shop_idx
  on public.boost_purchases (shop_id);

create index if not exists boost_purchases_user_idx
  on public.boost_purchases (user_id);

create index if not exists boost_purchases_status_idx
  on public.boost_purchases (status);

create trigger boost_purchases_updated_at
  before update on public.boost_purchases
  for each row execute function public.handle_updated_at();

alter table public.boost_purchases enable row level security;

create policy "boost_purchases: owner read"
  on public.boost_purchases for select
  using (user_id = auth.uid());

-- Inserts and updates happen exclusively via the admin client (service role)
-- from the Stripe webhook + /api/boosts/checkout endpoint, so no public policy
-- for writes.

-- ---------------------------------------------------------------------------
-- shops.featured_until — drives the 'featured_24h' boost
-- ---------------------------------------------------------------------------
-- When non-null and in the future, the shop is shown on the public /explore
-- discover page and gets a "À la une" badge on its public profile.

alter table public.shops
  add column if not exists featured_until timestamptz;

create index if not exists shops_featured_until_idx
  on public.shops (featured_until)
  where featured_until is not null;

-- =============================================================================
-- End of migration 011
-- =============================================================================
