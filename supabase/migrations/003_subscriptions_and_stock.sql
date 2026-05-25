-- =============================================================================
-- LinkBoutik — Subscriptions, stock management, and onboarding flag
-- Migration: 003_subscriptions_and_stock.sql
-- =============================================================================
-- Adds:
--   • creator_subscriptions table (Free / Pro / past_due / cancelled)
--   • subscription_status & subscription_plan enums
--   • atomic stock reservation RPC + decrement RPC
--   • profile.onboarding_completed flag
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.subscription_plan as enum ('free', 'pro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'active', 'trialing', 'past_due', 'cancelled', 'incomplete'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- creator_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.creator_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles (id) on delete cascade,
  plan                     public.subscription_plan not null default 'free',
  status                   public.subscription_status not null default 'active',
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.creator_subscriptions is
  'Tracks the LinkBoutik subscription plan for each shop owner.';

create index if not exists creator_subscriptions_status_idx
  on public.creator_subscriptions (status);

create trigger creator_subscriptions_updated_at
  before update on public.creator_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.creator_subscriptions enable row level security;

create policy "creator_subscriptions: owner read"
  on public.creator_subscriptions for select
  using (user_id = auth.uid());

-- Inserts and updates happen exclusively via the admin client (service role)
-- from the Stripe webhook + /api/subscription endpoints, so no public policy.

-- ---------------------------------------------------------------------------
-- Auto-create a 'free' row on profile creation
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_profile_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creator_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_subscription on public.profiles;
create trigger on_profile_created_subscription
  after insert on public.profiles
  for each row execute function public.handle_new_profile_subscription();

-- Backfill for existing profiles
insert into public.creator_subscriptions (user_id, plan, status)
select id, 'free', 'active' from public.profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- profile.onboarding_completed
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Anyone with a shop has effectively onboarded — backfill
update public.profiles p
set onboarding_completed = true
where exists (select 1 from public.shops s where s.owner_id = p.id);

-- ---------------------------------------------------------------------------
-- Stock reservation RPC
-- ---------------------------------------------------------------------------
-- reserve_stock(items jsonb) — atomically validates and decrements stock
-- for every line. Returns either { ok: true } or { ok: false, reason, ... }.
-- Items shape: [{ product_id: uuid, variant_id: uuid|null, quantity: int }]
--
-- Implementation: row-locks each product / variant with FOR UPDATE inside
-- a single transaction (the function body runs inside a tx by default in pg).
-- Untracked stock (stock_quantity IS NULL) is treated as infinite.
-- ---------------------------------------------------------------------------

create or replace function public.reserve_stock(items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item              jsonb;
  v_product_id      uuid;
  v_variant_id      uuid;
  v_quantity        integer;
  v_available       integer;
  v_product_name    text;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_items');
  end if;

  for item in select * from jsonb_array_elements(items) loop
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := nullif(item->>'variant_id', '')::uuid;
    v_quantity   := coalesce((item->>'quantity')::integer, 0);

    if v_quantity <= 0 then
      return jsonb_build_object(
        'ok', false,
        'reason', 'invalid_quantity',
        'product_id', v_product_id
      );
    end if;

    if v_variant_id is not null then
      select stock_quantity into v_available
      from public.product_variants
      where id = v_variant_id
      for update;

      if not found then
        return jsonb_build_object(
          'ok', false,
          'reason', 'variant_not_found',
          'variant_id', v_variant_id
        );
      end if;

      if v_available is not null then
        if v_available < v_quantity then
          select p.name into v_product_name
          from public.products p
          where p.id = v_product_id;

          return jsonb_build_object(
            'ok', false,
            'reason', 'insufficient_stock',
            'product_id', v_product_id,
            'variant_id', v_variant_id,
            'product_name', v_product_name,
            'available', v_available,
            'requested', v_quantity
          );
        end if;

        update public.product_variants
        set stock_quantity = stock_quantity - v_quantity
        where id = v_variant_id;
      end if;
    else
      select stock_quantity, name into v_available, v_product_name
      from public.products
      where id = v_product_id
      for update;

      if not found then
        return jsonb_build_object(
          'ok', false,
          'reason', 'product_not_found',
          'product_id', v_product_id
        );
      end if;

      if v_available is not null then
        if v_available < v_quantity then
          return jsonb_build_object(
            'ok', false,
            'reason', 'insufficient_stock',
            'product_id', v_product_id,
            'product_name', v_product_name,
            'available', v_available,
            'requested', v_quantity
          );
        end if;

        update public.products
        set stock_quantity = stock_quantity - v_quantity
        where id = v_product_id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.reserve_stock is
  'Atomically reserves stock for a list of order items. Returns {ok:true} or {ok:false, reason, ...}.';

-- ---------------------------------------------------------------------------
-- Stock release RPC (used when an order is cancelled / payment expires)
-- ---------------------------------------------------------------------------

create or replace function public.release_stock(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item         jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity   integer;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return;
  end if;

  for item in select * from jsonb_array_elements(items) loop
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := nullif(item->>'variant_id', '')::uuid;
    v_quantity   := coalesce((item->>'quantity')::integer, 0);

    if v_quantity <= 0 then continue; end if;

    if v_variant_id is not null then
      update public.product_variants
      set stock_quantity = stock_quantity + v_quantity
      where id = v_variant_id
        and stock_quantity is not null;
    else
      update public.products
      set stock_quantity = stock_quantity + v_quantity
      where id = v_product_id
        and stock_quantity is not null;
    end if;
  end loop;
end;
$$;

comment on function public.release_stock is
  'Releases reserved stock back to inventory when an order is cancelled.';

-- =============================================================================
-- End of migration 003
-- =============================================================================
