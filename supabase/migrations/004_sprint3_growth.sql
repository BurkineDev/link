-- =============================================================================
-- LinkBoutik — Sprint #3 growth features
-- Migration: 004_sprint3_growth.sql
-- =============================================================================
-- Adds:
--   • shop_links     — Linktree-style CTA links rendered above the product grid
--   • promo_codes    — discount codes (percent / fixed) per shop
--   • shops.tiktok_pixel_id, shops.meta_pixel_id  — retargeting pixels
--   • shops.whatsapp_number — seller WhatsApp number used for order alerts
--   • redeem_promo_code() RPC — atomic validate-and-increment uses_count
-- =============================================================================

-- ---------------------------------------------------------------------------
-- shop_links
-- ---------------------------------------------------------------------------

create table if not exists public.shop_links (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  label       text not null,
  url         text not null,
  icon        text not null default 'custom',
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint shop_links_label_length check (char_length(label) between 1 and 60),
  constraint shop_links_url_length   check (char_length(url) between 1 and 500),
  constraint shop_links_icon_length  check (char_length(icon) between 1 and 30)
);

comment on table public.shop_links is
  'Linktree-style call-to-action links displayed above the product grid on a shop page.';

create index if not exists shop_links_shop_id_idx on public.shop_links (shop_id, position);

create trigger shop_links_updated_at
  before update on public.shop_links
  for each row execute function public.handle_updated_at();

alter table public.shop_links enable row level security;

create policy "shop_links: public read active"
  on public.shop_links for select
  using (
    is_active = true
    and exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.is_published = true
    )
    or exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "shop_links: owner insert"
  on public.shop_links for insert
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "shop_links: owner update"
  on public.shop_links for update
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "shop_links: owner delete"
  on public.shop_links for delete
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_links.shop_id and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- promo_codes
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.promo_discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null;
end $$;

create table if not exists public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  code              text not null,
  discount_type     public.promo_discount_type not null,
  discount_value    numeric(14, 2) not null,
  min_order_amount  numeric(14, 2),
  max_uses          integer,
  uses_count        integer not null default 0,
  expires_at        timestamptz,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint promo_codes_unique_per_shop unique (shop_id, code),
  constraint promo_codes_code_length     check (char_length(code) between 2 and 30),
  constraint promo_codes_code_format     check (code ~ '^[A-Z0-9_-]+$'),
  constraint promo_codes_value_positive  check (discount_value > 0),
  constraint promo_codes_percent_range   check (
    discount_type <> 'percent' or (discount_value > 0 and discount_value <= 100)
  ),
  constraint promo_codes_uses_positive   check (uses_count >= 0)
);

comment on table public.promo_codes is
  'Per-shop discount codes that can be applied at checkout.';

create index if not exists promo_codes_shop_idx on public.promo_codes (shop_id);

create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.handle_updated_at();

alter table public.promo_codes enable row level security;

-- Owners manage promo codes through authenticated dashboard requests.
create policy "promo_codes: owner select"
  on public.promo_codes for select
  using (
    exists (
      select 1 from public.shops s
      where s.id = promo_codes.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "promo_codes: owner insert"
  on public.promo_codes for insert
  with check (
    exists (
      select 1 from public.shops s
      where s.id = promo_codes.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "promo_codes: owner update"
  on public.promo_codes for update
  using (
    exists (
      select 1 from public.shops s
      where s.id = promo_codes.shop_id and s.owner_id = auth.uid()
    )
  );

create policy "promo_codes: owner delete"
  on public.promo_codes for delete
  using (
    exists (
      select 1 from public.shops s
      where s.id = promo_codes.shop_id and s.owner_id = auth.uid()
    )
  );

-- Buyers redeem codes via the admin client (service role) inside the
-- checkout flow, which bypasses RLS — so no public policy is needed.

-- ---------------------------------------------------------------------------
-- redeem_promo_code RPC — atomic validate + increment
-- ---------------------------------------------------------------------------
-- Locks the promo_codes row FOR UPDATE, validates expiry / max_uses /
-- min_order_amount, computes the discount, and increments uses_count in
-- the same transaction. Returns either:
--   { ok: true, discount, code_id, discount_type, discount_value }
-- or { ok: false, reason }
-- ---------------------------------------------------------------------------

create or replace function public.redeem_promo_code(
  p_shop_id     uuid,
  p_code        text,
  p_order_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.promo_codes%rowtype;
  v_discount numeric;
begin
  if p_shop_id is null or p_code is null or p_order_total is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select * into v_row
  from public.promo_codes
  where shop_id = p_shop_id
    and code    = upper(p_code)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not v_row.is_active then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_row.max_uses is not null and v_row.uses_count >= v_row.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'max_uses_reached');
  end if;

  if v_row.min_order_amount is not null and p_order_total < v_row.min_order_amount then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_order_not_met',
      'min_order_amount', v_row.min_order_amount
    );
  end if;

  -- Compute discount, clamp to order total so we never refund negative.
  if v_row.discount_type = 'percent' then
    v_discount := round(p_order_total * v_row.discount_value / 100.0, 2);
  else
    v_discount := v_row.discount_value;
  end if;

  if v_discount > p_order_total then
    v_discount := p_order_total;
  end if;

  update public.promo_codes
  set uses_count = uses_count + 1
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'code_id', v_row.id,
    'discount_type', v_row.discount_type,
    'discount_value', v_row.discount_value,
    'discount', v_discount
  );
end;
$$;

comment on function public.redeem_promo_code is
  'Atomically validates a promo code for a given shop + order total and increments uses_count.';

-- ---------------------------------------------------------------------------
-- Shop growth fields: pixels + WhatsApp + promo bookkeeping on orders
-- ---------------------------------------------------------------------------

alter table public.shops
  add column if not exists tiktok_pixel_id text,
  add column if not exists meta_pixel_id   text,
  add column if not exists whatsapp_number text,
  add constraint shops_tiktok_pixel_format
    check (tiktok_pixel_id is null or tiktok_pixel_id ~ '^[A-Za-z0-9]{8,40}$'),
  add constraint shops_meta_pixel_format
    check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{10,20}$'),
  add constraint shops_whatsapp_format
    check (whatsapp_number is null or whatsapp_number ~ '^\+?[0-9]{6,18}$');

alter table public.orders
  add column if not exists promo_code      text,
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add constraint orders_discount_nonneg check (discount_amount >= 0);

-- =============================================================================
-- End of migration 004
-- =============================================================================
