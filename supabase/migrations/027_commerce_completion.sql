-- =============================================================================
-- Bio-Lien — socle commerce complet
-- Clients, suivi de commande, analytics événementiel, livraison, téléchargements,
-- grand livre de commissions, versements, formulaires et réservations.
-- =============================================================================

alter table public.templates
  add column if not exists is_premium boolean not null default false;

alter table public.shops
  add column if not exists custom_domain text,
  add column if not exists custom_domain_verified_at timestamptz,
  add column if not exists show_biolien_badge boolean not null default true,
  add column if not exists shipping_enabled boolean not null default false;

create unique index if not exists shops_custom_domain_key
  on public.shops (lower(custom_domain)) where custom_domain is not null;

alter table public.orders
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists tracking_token uuid not null default gen_random_uuid();

create unique index if not exists orders_tracking_token_key
  on public.orders (tracking_token);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  tags text[] not null default '{}',
  notes text,
  marketing_opt_in boolean not null default false,
  first_order_at timestamptz,
  last_order_at timestamptz,
  order_count integer not null default 0,
  total_spent numeric(14,2) not null default 0,
  currency public.currency_code not null default 'XOF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, email),
  constraint customers_order_count_positive check (order_count >= 0),
  constraint customers_total_spent_positive check (total_spent >= 0)
);

create index if not exists customers_shop_last_order_idx
  on public.customers(shop_id, last_order_at desc);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.handle_updated_at();

alter table public.orders add column if not exists customer_id uuid;
do $$ begin
  alter table public.orders add constraint orders_customer_id_fkey
    foreign key (customer_id) references public.customers(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  public_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_events_order_idx
  on public.order_status_events(order_id, created_at);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  block_id uuid references public.page_blocks(id) on delete set null,
  link_id uuid references public.shop_links(id) on delete set null,
  type text not null,
  visitor_id text,
  session_id text,
  source text,
  medium text,
  campaign text,
  referrer text,
  path text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_type check (
    type in ('page_view','link_click','block_click','product_view','add_to_cart','checkout_started','purchase')
  )
);
create index if not exists analytics_events_shop_created_idx
  on public.analytics_events(shop_id, created_at desc);
create index if not exists analytics_events_shop_type_created_idx
  on public.analytics_events(shop_id, type, created_at desc);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  countries text[] not null default '{}',
  rate numeric(14,2) not null,
  free_above numeric(14,2),
  estimated_min integer,
  estimated_max integer,
  is_active boolean not null default true,
  currency public.currency_code not null default 'XOF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_zones_rate_positive check (rate >= 0),
  constraint shipping_zones_free_above_positive check (free_above is null or free_above >= 0),
  constraint shipping_zones_estimates check (
    (estimated_min is null or estimated_min > 0)
    and (estimated_max is null or estimated_max >= estimated_min)
  )
);
create index if not exists shipping_zones_shop_idx on public.shipping_zones(shop_id);
create trigger shipping_zones_updated_at before update on public.shipping_zones
  for each row execute function public.handle_updated_at();

create table if not exists public.digital_downloads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  token uuid not null default gen_random_uuid() unique,
  file_key text not null,
  file_name text,
  download_count integer not null default 0,
  download_limit integer not null default 5,
  expires_at timestamptz,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint digital_downloads_counts check (
    download_count >= 0 and download_limit between 1 and 100
  )
);
create index if not exists digital_downloads_order_idx on public.digital_downloads(order_id);

create table if not exists public.transaction_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('gross','platform_fee','seller_net','refund','payout')),
  amount numeric(14,2) not null,
  currency public.currency_code not null,
  status text not null default 'posted' check (status in ('pending','posted','void')),
  provider text,
  reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists transaction_ledger_shop_idx
  on public.transaction_ledger(shop_id, created_at desc);
create index if not exists transaction_ledger_order_idx
  on public.transaction_ledger(order_id);

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique references public.shops(id) on delete cascade,
  provider text not null,
  account_name text not null,
  account_identifier text not null,
  country text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payout_accounts_updated_at before update on public.payout_accounts
  for each row execute function public.handle_updated_at();

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  provider text not null,
  reference text unique,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payouts_shop_idx on public.payouts(shop_id, created_at desc);
create trigger payouts_updated_at before update on public.payouts
  for each row execute function public.handle_updated_at();

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  block_id uuid references public.page_blocks(id) on delete set null,
  email text,
  name text,
  answers jsonb not null,
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint form_submissions_answers_size check (pg_column_size(answers) <= 32768)
);
create index if not exists form_submissions_shop_idx
  on public.form_submissions(shop_id, created_at desc);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  block_id uuid references public.page_blocks(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_shop_starts_idx on public.bookings(shop_id, starts_at);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.handle_updated_at();

-- Owner-only read/write policies. Public writes use narrow SECURITY DEFINER
-- functions/routes so no visitor receives blanket INSERT privileges.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','order_status_events','analytics_events','shipping_zones',
    'digital_downloads','transaction_ledger','payout_accounts','payouts',
    'form_submissions','bookings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "customers: owner all" on public.customers for all
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "status events: owner read" on public.order_status_events for select
  using (exists (select 1 from public.orders o join public.shops s on s.id=o.shop_id where o.id=order_id and s.owner_id=(select auth.uid())));
create policy "analytics: owner read" on public.analytics_events for select
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "shipping zones: owner all" on public.shipping_zones for all
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "downloads: owner read" on public.digital_downloads for select
  using (exists (select 1 from public.orders o join public.shops s on s.id=o.shop_id where o.id=order_id and s.owner_id=(select auth.uid())));
create policy "ledger: owner read" on public.transaction_ledger for select
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "payout accounts: owner all" on public.payout_accounts for all
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "payouts: owner read" on public.payouts for select
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "submissions: owner read" on public.form_submissions for select
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy "bookings: owner all" on public.bookings for all
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=(select auth.uid())));

-- Confirme le paiement, construit le CRM, le suivi, le grand livre et les
-- accès numériques dans une transaction idempotente.
create or replace function public.settle_paid_order(
  p_order_id uuid,
  p_payment_ref text,
  p_payment_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_plan public.subscription_plan := 'free';
  v_rate numeric := 0.05;
  v_fee numeric;
  v_item jsonb;
  v_product public.products%rowtype;
  v_order_item_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('settled',false,'reason','not_found'); end if;
  if v_order.payment_status='paid' then return jsonb_build_object('settled',false,'reason','already_paid'); end if;
  if v_order.payment_status<>'pending' then return jsonb_build_object('settled',false,'reason','not_pending'); end if;

  update public.orders set payment_status='paid', status='confirmed',
    payment_ref=p_payment_ref,
    payment_provider=p_payment_provider::public.payment_provider
  where id=v_order.id;

  insert into public.customers as c
    (shop_id,email,name,phone,first_order_at,last_order_at,order_count,total_spent,currency)
  values
    (v_order.shop_id,lower(v_order.buyer_email),v_order.buyer_name,v_order.buyer_phone,
     v_order.created_at,v_order.created_at,1,v_order.total_amount,v_order.currency)
  on conflict (shop_id,email) do update set
    name=excluded.name,
    phone=coalesce(excluded.phone,c.phone),
    first_order_at=least(coalesce(c.first_order_at,excluded.first_order_at),excluded.first_order_at),
    last_order_at=greatest(coalesce(c.last_order_at,excluded.last_order_at),excluded.last_order_at),
    order_count=c.order_count+1,
    total_spent=c.total_spent+excluded.total_spent
  returning id into v_customer_id;

  update public.orders set customer_id=v_customer_id where id=v_order.id;
  insert into public.order_status_events(order_id,status,public_message)
    values(v_order.id,'confirmed','Paiement confirmé. La commande est transmise au vendeur.');

  select cs.plan into v_plan
    from public.shops s
    left join public.creator_subscriptions cs on cs.user_id=s.owner_id
      and cs.status in ('active','trialing')
      and (cs.provider='stripe' or (cs.current_period_end is not null and cs.current_period_end>now()))
    where s.id=v_order.shop_id;
  v_plan := coalesce(v_plan,'free');
  v_rate := case v_plan when 'pro' then 0 when 'starter' then 0.03 else 0.05 end;
  v_fee := round(v_order.total_amount*v_rate,2);

  insert into public.transaction_ledger(shop_id,order_id,type,amount,currency,provider,reference)
  values
    (v_order.shop_id,v_order.id,'gross',v_order.total_amount,v_order.currency,p_payment_provider,p_payment_ref),
    (v_order.shop_id,v_order.id,'platform_fee',-v_fee,v_order.currency,p_payment_provider,p_payment_ref),
    (v_order.shop_id,v_order.id,'seller_net',v_order.total_amount-v_fee,v_order.currency,p_payment_provider,p_payment_ref);

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
    if found and v_product.is_digital and coalesce(v_product.metadata->>'download_key',v_product.metadata->>'download_url') is not null then
      select id into v_order_item_id from public.order_items
       where order_id=v_order.id and product_id=v_product.id limit 1;
      insert into public.digital_downloads
        (order_id,order_item_id,product_id,file_key,file_name,download_limit,expires_at)
      values
        (v_order.id,v_order_item_id,v_product.id,
         coalesce(v_product.metadata->>'download_key',v_product.metadata->>'download_url'),
         coalesce(v_product.metadata->>'file_name',v_product.name),
         coalesce((v_product.metadata->>'download_limit')::integer,5),
         now()+interval '30 days');
    end if;
  end loop;

  return jsonb_build_object('settled',true,'customer_id',v_customer_id,'commission',v_fee,'plan',v_plan);
end;
$$;

-- Machine d'états : empêche les sauts incohérents et garde une chronologie.
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_actor uuid,
  p_note text default null,
  p_public_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype; v_allowed boolean := false;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return jsonb_build_object('updated',false,'reason','not_found'); end if;
  if not exists(select 1 from public.shops where id=v_order.shop_id and owner_id=p_actor) then
    return jsonb_build_object('updated',false,'reason','forbidden');
  end if;
  if v_order.status=p_status then return jsonb_build_object('updated',false,'reason','unchanged'); end if;

  v_allowed := case v_order.status
    when 'pending' then p_status in ('confirmed','cancelled')
    when 'confirmed' then p_status in ('processing','cancelled')
    when 'processing' then p_status in ('shipped','delivered','cancelled')
    when 'shipped' then p_status='delivered'
    else false end;
  if not v_allowed then return jsonb_build_object('updated',false,'reason','invalid_transition','from',v_order.status,'to',p_status); end if;
  if p_status='cancelled' and v_order.payment_status='paid' then
    return jsonb_build_object('updated',false,'reason','paid_order_requires_refund');
  end if;

  update public.orders set status=p_status where id=v_order.id;
  insert into public.order_status_events(order_id,status,note,public_message,created_by)
    values(v_order.id,p_status,nullif(trim(p_note),''),nullif(trim(p_public_message),''),p_actor);
  return jsonb_build_object('updated',true,'status',p_status);
end;
$$;

revoke all on function public.settle_paid_order(uuid,text,text) from public;
revoke execute on function public.settle_paid_order(uuid,text,text) from anon, authenticated;
revoke all on function public.transition_order_status(uuid,public.order_status,uuid,text,text) from public;
revoke execute on function public.transition_order_status(uuid,public.order_status,uuid,text,text) from anon, authenticated;

-- Consomme un lien numérique sous verrou afin que deux téléchargements
-- simultanés ne contournent pas la limite.
create or replace function public.consume_digital_download(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_download public.digital_downloads%rowtype; v_paid boolean;
begin
  select * into v_download from public.digital_downloads where token=p_token for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select payment_status='paid' into v_paid from public.orders where id=v_download.order_id;
  if not coalesce(v_paid,false) then return jsonb_build_object('ok',false,'reason','not_paid'); end if;
  if v_download.expires_at is not null and v_download.expires_at<=now() then
    return jsonb_build_object('ok',false,'reason','expired');
  end if;
  if v_download.download_count>=v_download.download_limit then
    return jsonb_build_object('ok',false,'reason','limit_reached');
  end if;
  update public.digital_downloads
     set download_count=download_count+1,last_downloaded_at=now()
   where id=v_download.id;
  return jsonb_build_object('ok',true,'file_key',v_download.file_key,'file_name',v_download.file_name);
end;
$$;
revoke all on function public.consume_digital_download(uuid) from public;
revoke execute on function public.consume_digital_download(uuid) from anon, authenticated;
