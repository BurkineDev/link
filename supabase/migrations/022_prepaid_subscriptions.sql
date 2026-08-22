-- ---------------------------------------------------------------------------
-- Migration 022 : abonnements payés d'avance (Mobile Money / Genius Pay)
-- ---------------------------------------------------------------------------
-- Jusqu'ici un abonnement était forcément un abonnement Stripe : une carte, un
-- mandat, un renouvellement automatique et un webhook qui prévient quand il
-- s'arrête. En Afrique de l'Ouest, la carte est rare et le Mobile Money ne
-- connaît pas le prélèvement récurrent : le vendeur paie une période, elle
-- court, elle s'arrête.
--
-- Deux conséquences structurantes :
--
--  1. Rien d'extérieur ne vient éteindre un abonnement expiré. C'est
--     `current_period_end` qui fait foi, et l'application doit le comparer à
--     l'heure courante (voir getEffectivePlan). D'où `provider`, qui dit
--     lequel des deux régimes s'applique — sans lui, un abonné Stripe dont le
--     webhook de renouvellement a quelques secondes de retard perdrait son
--     plan alors qu'il est à jour.
--
--  2. Il faut une trace de chaque encaissement. Un vendeur qui a payé et ne
--     voit pas son plan ne se contentera pas de « regardez, votre date est
--     là » : il faut pouvoir montrer quel paiement, quel montant, quelle
--     période. `subscription_payments` est ce registre.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. creator_subscriptions.provider
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_provider') then
    create type public.subscription_provider as enum ('stripe', 'geniuspay');
  end if;
end
$$;

alter table public.creator_subscriptions
  add column if not exists provider public.subscription_provider
    not null default 'stripe';

comment on column public.creator_subscriptions.provider is
  'Qui encaisse. ''stripe'' = renouvellement automatique, le statut fait foi. ''geniuspay'' = période payée d''avance, current_period_end fait foi.';

-- ---------------------------------------------------------------------------
-- 2. subscription_payments — le registre
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  plan          public.subscription_plan not null,
  months        integer not null,
  amount        numeric(12, 2) not null,
  currency      text not null default 'XOF',
  provider      public.subscription_provider not null default 'geniuspay',
  -- La référence du prestataire (MTX-…). Unique : c'est elle qui rend le
  -- webhook idempotent — Genius Pay peut livrer deux fois le même événement,
  -- une période ne peut être créditée qu'une fois.
  reference     text not null unique,
  status        public.payment_status not null default 'pending',
  -- Renseignées au moment où le paiement est confirmé, pas avant : tant que
  -- rien n'est encaissé, il n'y a pas de période.
  period_start  timestamptz,
  period_end    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint subscription_payments_months_valid check (months in (1, 3, 12)),
  constraint subscription_payments_amount_positive check (amount > 0),
  constraint subscription_payments_plan_paid check (plan <> 'free')
);

comment on table public.subscription_payments is
  'Un encaissement d''abonnement = une période achetée. Sert de preuve au support et d''idempotence au webhook.';

create index if not exists subscription_payments_user_idx
  on public.subscription_payments (user_id, created_at desc);

create trigger subscription_payments_updated_at
  before update on public.subscription_payments
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : le vendeur lit ses propres paiements, personne n'écrit depuis le
-- navigateur. Les écritures passent par le serveur (clé service) : un client
-- qui pourrait insérer ici s'offrirait un abonnement.
-- ---------------------------------------------------------------------------

alter table public.subscription_payments enable row level security;

drop policy if exists "subscription_payments: owner read" on public.subscription_payments;
create policy "subscription_payments: owner read"
  on public.subscription_payments for select
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. apply_subscription_payment(text) — créditer une période, une seule fois
-- ---------------------------------------------------------------------------
-- Appelée par le webhook quand Genius Pay confirme l'encaissement. Tout tient
-- en une transaction parce que deux livraisons simultanées du même événement
-- doivent créditer une seule période : le SELECT ... FOR UPDATE verrouille la
-- ligne de paiement, et le premier qui la passe à 'paid' ferme la porte.
--
-- La période s'ajoute à la précédente si elle court encore ET porte le même
-- plan : le vendeur qui achète un mois de plus le 20 alors qu'il lui en reste
-- 10 jours ne doit pas les perdre. Changer de plan repart de maintenant —
-- créditer du Pro sur un reliquat de Starter serait un cadeau silencieux.

create or replace function public.apply_subscription_payment(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment  public.subscription_payments%rowtype;
  v_current  public.creator_subscriptions%rowtype;
  v_start    timestamptz;
  v_end      timestamptz;
begin
  select * into v_payment
    from public.subscription_payments
   where reference = p_reference
     for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'unknown_reference');
  end if;

  if v_payment.status = 'paid' then
    return jsonb_build_object('applied', false, 'reason', 'already_applied');
  end if;

  select * into v_current
    from public.creator_subscriptions
   where user_id = v_payment.user_id;

  v_start := now();
  if v_current.user_id is not null
     and v_current.provider = 'geniuspay'
     and v_current.plan = v_payment.plan
     and v_current.current_period_end is not null
     and v_current.current_period_end > now()
  then
    v_start := v_current.current_period_end;
  end if;

  v_end := v_start + make_interval(months => v_payment.months);

  update public.subscription_payments
     set status = 'paid', period_start = v_start, period_end = v_end
   where id = v_payment.id;

  insert into public.creator_subscriptions as cs
    (user_id, plan, status, provider, current_period_end, cancel_at_period_end)
  values
    (v_payment.user_id, v_payment.plan, 'active', 'geniuspay', v_end, false)
  on conflict (user_id) do update
     set plan                 = excluded.plan,
         status               = excluded.status,
         provider             = excluded.provider,
         current_period_end   = excluded.current_period_end,
         cancel_at_period_end = false;

  return jsonb_build_object(
    'applied', true,
    'plan', v_payment.plan,
    'months', v_payment.months,
    'period_end', v_end
  );
end;
$$;

comment on function public.apply_subscription_payment(text) is
  'Crédite la période d''un paiement d''abonnement confirmé. Idempotent : un même reference ne crédite qu''une fois.';

-- Personne d'autre que le serveur (clé service, qui contourne les grants) n'a
-- de raison d'appeler ceci : l'exposer à `authenticated` reviendrait à offrir
-- un abonnement à qui devine une référence.
revoke all on function public.apply_subscription_payment(text) from public;
