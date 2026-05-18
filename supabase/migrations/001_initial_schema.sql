-- =============================================================================
-- LinkBoutik — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================
-- Tables:
--   profiles, shops, templates, categories, products, product_variants,
--   orders, order_items
--
-- Features:
--   • Row Level Security (RLS) on every table
--   • Enum types for currencies, statuses, and providers
--   • Automatic updated_at triggers via moddatetime (pg_moddatetime extension)
--   • Full-text search index on products
--   • Auto-create profile row when a new auth user is inserted
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";          -- gen_random_uuid()
create extension if not exists "pg_trgm";           -- trigram similarity for search
create extension if not exists "unaccent";          -- accent-insensitive search

-- ---------------------------------------------------------------------------
-- Custom enum types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.currency_code as enum (
    'XOF', 'XAF', 'GHS', 'NGN', 'KES', 'MAD', 'USD'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'confirmed', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_provider as enum (
    'flutterwave', 'manual', 'free'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helper function: set updated_at to now()
-- ---------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  full_name   text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now(),

  constraint profiles_username_length
    check (char_length(username) between 3 and 30),
  constraint profiles_username_format
    check (username ~ '^[a-z0-9_\-]+$'),
  constraint profiles_bio_length
    check (char_length(bio) <= 500)
);

comment on table public.profiles is
  'Extended user profile data mirroring auth.users.';

-- RLS
alter table public.profiles enable row level security;

create policy "profiles: public read"
  on public.profiles for select
  using (true);

create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. templates  (managed by admins; read-only for everyone else)
-- ---------------------------------------------------------------------------

create table if not exists public.templates (
  id             text primary key,                        -- e.g. 'minimal', 'boutique'
  name           text not null,
  description    text,
  preview_image  text,
  config         jsonb not null default '{}',
  is_active      boolean not null default true
);

comment on table public.templates is
  'Storefront layout templates that shop owners can select.';

alter table public.templates enable row level security;

create policy "templates: public read active"
  on public.templates for select
  using (is_active = true);

-- Seed default templates
insert into public.templates (id, name, description, preview_image, config, is_active)
values
  (
    'minimal',
    'Minimal',
    'Clean, distraction-free layout that puts your products front and center.',
    '/templates/minimal.jpg',
    '{"layout":"grid","hero":{"show":false,"style":"centered"},"font":"Inter","borderRadius":"md","showSocialLinks":true,"showReviews":false}',
    true
  ),
  (
    'boutique',
    'Boutique',
    'Elegant fashion-forward design with a bold hero banner and masonry grid.',
    '/templates/boutique.jpg',
    '{"layout":"masonry","hero":{"show":true,"style":"banner"},"font":"Playfair Display","borderRadius":"sm","showSocialLinks":true,"showReviews":true}',
    true
  ),
  (
    'market',
    'Market',
    'High-density list view perfect for sellers with large catalogues.',
    '/templates/market.jpg',
    '{"layout":"list","hero":{"show":true,"style":"split"},"font":"Inter","borderRadius":"none","showSocialLinks":false,"showReviews":true}',
    true
  ),
  (
    'artisan',
    'Artisan',
    'Warm, handcrafted aesthetic for makers and artisans.',
    '/templates/artisan.jpg',
    '{"layout":"grid","hero":{"show":true,"style":"centered"},"font":"Lora","borderRadius":"lg","showSocialLinks":true,"showReviews":true}',
    true
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. shops
-- ---------------------------------------------------------------------------

create table if not exists public.shops (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  description     text,
  logo_url        text,
  banner_url      text,
  template_id     text references public.templates (id) on delete set null,
  is_published    boolean not null default false,
  theme_color     text not null default '#6366F1',
  currency        public.currency_code not null default 'XOF',
  contact_email   text,
  contact_phone   text,
  social_links    jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint shops_name_length    check (char_length(name) between 2 and 80),
  constraint shops_slug_length    check (char_length(slug) between 3 and 50),
  constraint shops_slug_format    check (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$'),
  constraint shops_theme_color    check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint shops_description_length check (char_length(description) <= 500)
);

comment on table public.shops is
  'Storefronts owned by creators. Each shop has a unique slug used for the subdomain.';
comment on column public.shops.slug is
  'Unique URL-safe identifier used as subdomain: {slug}.linkboutik.com';

create index if not exists shops_owner_id_idx on public.shops (owner_id);
create index if not exists shops_slug_idx     on public.shops (slug);
create index if not exists shops_published_idx on public.shops (is_published) where is_published = true;

-- updated_at trigger
create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.shops enable row level security;

create policy "shops: public read published"
  on public.shops for select
  using (is_published = true or owner_id = auth.uid());

create policy "shops: owner insert"
  on public.shops for insert
  with check (owner_id = auth.uid());

create policy "shops: owner update"
  on public.shops for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "shops: owner delete"
  on public.shops for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  shop_id   uuid not null references public.shops (id) on delete cascade,
  name      text not null,
  slug      text not null,
  position  integer not null default 0,

  constraint categories_unique_slug_per_shop unique (shop_id, slug),
  constraint categories_name_length check (char_length(name) between 1 and 80),
  constraint categories_slug_format check (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$')
);

comment on table public.categories is
  'Product categories scoped to a shop, ordered by position.';

create index if not exists categories_shop_id_idx on public.categories (shop_id);

alter table public.categories enable row level security;

create policy "categories: public read"
  on public.categories for select
  using (
    exists (
      select 1 from public.shops
      where shops.id = categories.shop_id
        and (shops.is_published = true or shops.owner_id = auth.uid())
    )
  );

create policy "categories: owner insert"
  on public.categories for insert
  with check (
    exists (
      select 1 from public.shops
      where shops.id = categories.shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "categories: owner update"
  on public.categories for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = categories.shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "categories: owner delete"
  on public.categories for delete
  using (
    exists (
      select 1 from public.shops
      where shops.id = categories.shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. products
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  name            text not null,
  slug            text not null,
  description     text,
  price           numeric(14, 2) not null default 0,
  compare_price   numeric(14, 2),
  currency        public.currency_code not null default 'XOF',
  images          jsonb not null default '[]',
  category_id     uuid references public.categories (id) on delete set null,
  is_published    boolean not null default false,
  is_digital      boolean not null default false,
  stock_quantity  integer,
  has_variants    boolean not null default false,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint products_unique_slug_per_shop unique (shop_id, slug),
  constraint products_name_length      check (char_length(name) between 2 and 200),
  constraint products_price_positive   check (price >= 0),
  constraint products_compare_gt_price check (compare_price is null or compare_price > price),
  constraint products_stock_positive   check (stock_quantity is null or stock_quantity >= 0)
);

comment on table public.products is
  'Products listed in a shop. Supports physical and digital goods with optional variants.';

create index if not exists products_shop_id_idx     on public.products (shop_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_published_idx   on public.products (shop_id, is_published) where is_published = true;
create index if not exists products_slug_idx        on public.products (shop_id, slug);

-- Full-text search: name + description, with trigram fallback
create index if not exists products_fts_idx on public.products
  using gin (
    to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, ''))
  );

create index if not exists products_name_trgm_idx on public.products
  using gin (name gin_trgm_ops);

-- updated_at trigger
create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.products enable row level security;

create policy "products: public read published"
  on public.products for select
  using (
    is_published = true
    or exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "products: owner insert"
  on public.products for insert
  with check (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "products: owner update"
  on public.products for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = auth.uid()
    )
  );

create policy "products: owner delete"
  on public.products for delete
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. product_variants
-- ---------------------------------------------------------------------------

create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  name            text not null,
  options         jsonb not null default '[]',
  price           numeric(14, 2),
  stock_quantity  integer,
  sku             text,

  constraint product_variants_price_positive   check (price is null or price >= 0),
  constraint product_variants_stock_positive   check (stock_quantity is null or stock_quantity >= 0),
  constraint product_variants_name_length      check (char_length(name) between 1 and 200),
  constraint product_variants_sku_length       check (sku is null or char_length(sku) <= 100)
);

comment on table public.product_variants is
  'Specific combinations of options (e.g. Red / XL) for a product with variants.';

create index if not exists product_variants_product_id_idx on public.product_variants (product_id);

alter table public.product_variants enable row level security;

create policy "product_variants: public read via published product"
  on public.product_variants for select
  using (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and (p.is_published = true or s.owner_id = auth.uid())
    )
  );

create policy "product_variants: owner insert"
  on public.product_variants for insert
  with check (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and s.owner_id = auth.uid()
    )
  );

create policy "product_variants: owner update"
  on public.product_variants for update
  using (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and s.owner_id = auth.uid()
    )
  );

create policy "product_variants: owner delete"
  on public.product_variants for delete
  using (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. orders
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete restrict,
  buyer_email       text not null,
  buyer_name        text not null,
  buyer_phone       text,
  status            public.order_status not null default 'pending',
  payment_status    public.payment_status not null default 'pending',
  payment_provider  public.payment_provider,
  payment_ref       text,                              -- provider transaction ID
  total_amount      numeric(14, 2) not null,
  currency          public.currency_code not null,
  items             jsonb not null default '[]',       -- denormalised snapshot
  shipping_address  jsonb,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint orders_total_positive    check (total_amount >= 0),
  constraint orders_buyer_email_valid check (buyer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint orders_notes_length      check (char_length(notes) <= 500)
);

comment on table public.orders is
  'Customer orders placed through a shop. Buyers are anonymous (no auth required).';

create index if not exists orders_shop_id_idx        on public.orders (shop_id);
create index if not exists orders_buyer_email_idx    on public.orders (buyer_email);
create index if not exists orders_status_idx         on public.orders (shop_id, status);
create index if not exists orders_payment_ref_idx    on public.orders (payment_ref) where payment_ref is not null;
create index if not exists orders_created_at_idx     on public.orders (created_at desc);

-- updated_at trigger
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.orders enable row level security;

-- Shop owners can read all orders for their shops
create policy "orders: owner read"
  on public.orders for select
  using (
    exists (
      select 1 from public.shops
      where shops.id = orders.shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- Anyone can insert an order (buyers are unauthenticated)
create policy "orders: public insert"
  on public.orders for insert
  with check (true);

-- Only the shop owner can update order status
create policy "orders: owner update"
  on public.orders for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = orders.shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- Orders are never deleted (archived instead via status)
-- (no delete policy — soft-delete via status = 'cancelled')

-- ---------------------------------------------------------------------------
-- 8. order_items
-- ---------------------------------------------------------------------------

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  variant_id        uuid references public.product_variants (id) on delete set null,
  quantity          integer not null,
  unit_price        numeric(14, 2) not null,
  subtotal          numeric(14, 2) not null,
  product_snapshot  jsonb not null,                    -- immutable record at purchase time

  constraint order_items_quantity_positive  check (quantity > 0),
  constraint order_items_price_positive     check (unit_price >= 0),
  constraint order_items_subtotal_positive  check (subtotal >= 0)
);

comment on table public.order_items is
  'Individual line items within an order. Includes a snapshot of the product at purchase time.';

create index if not exists order_items_order_id_idx   on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

alter table public.order_items enable row level security;

create policy "order_items: owner read"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id
        and s.owner_id = auth.uid()
    )
  );

create policy "order_items: public insert"
  on public.order_items for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- 9. Auto-create profile on new auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. Useful views
-- ---------------------------------------------------------------------------

-- Aggregated shop stats (revenue, order count, product count)
create or replace view public.shop_stats as
select
  s.id                                                   as shop_id,
  s.owner_id,
  count(distinct o.id) filter (where o.payment_status = 'paid')   as paid_order_count,
  coalesce(
    sum(o.total_amount) filter (where o.payment_status = 'paid'),
    0
  )                                                      as total_revenue,
  count(distinct p.id) filter (where p.is_published)     as published_product_count,
  count(distinct p.id)                                   as total_product_count
from public.shops s
left join public.orders o  on o.shop_id = s.id
left join public.products p on p.shop_id = s.id
group by s.id, s.owner_id;

comment on view public.shop_stats is
  'Pre-aggregated statistics per shop. Filtered by the owner via RLS on underlying tables.';

-- =============================================================================
-- End of migration 001_initial_schema.sql
-- =============================================================================
