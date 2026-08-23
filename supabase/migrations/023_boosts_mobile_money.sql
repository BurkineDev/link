-- ---------------------------------------------------------------------------
-- Migration 023 : boosts payés en Mobile Money
-- ---------------------------------------------------------------------------
-- Les boosts ponctuels suivaient le même chemin que les abonnements d'avant :
-- Stripe, en dollars canadiens. « 1,99 $CA » ne veut rien dire pour un vendeur
-- à Ouagadougou, et la carte qu'il faudrait pour payer, il ne l'a pas.
--
-- On reprend exactement le mécanisme éprouvé pour les abonnements (022) :
-- une référence de prestataire unique porte l'idempotence, et une fonction
-- fait l'activation en une transaction. La différence tient en un point : un
-- boost déjà actif se *prolonge* au lieu d'être écrasé — un vendeur qui
-- rachète alors qu'il lui reste six heures ne doit pas les perdre.
-- ---------------------------------------------------------------------------

alter table public.boost_purchases
  add column if not exists provider public.subscription_provider
    not null default 'stripe';

-- Nullable : les achats Stripe existants n'ont pas de référence Genius Pay,
-- et n'en auront jamais. Unique quand elle est renseignée, ce qui suffit à
-- rendre le webhook idempotent (en Postgres, plusieurs NULL cohabitent).
alter table public.boost_purchases
  add column if not exists reference text;

create unique index if not exists boost_purchases_reference_key
  on public.boost_purchases (reference)
  where reference is not null;

comment on column public.boost_purchases.provider is
  'Qui a encaissé ce boost : stripe (carte) ou geniuspay (Mobile Money).';
comment on column public.boost_purchases.reference is
  'Référence Genius Pay (MTX-…). Porte l''idempotence du webhook.';

-- ---------------------------------------------------------------------------
-- apply_boost_payment(text) — activer un boost, une seule fois
-- ---------------------------------------------------------------------------

create or replace function public.apply_boost_payment(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_boost    public.boost_purchases%rowtype;
  v_hours    integer;
  v_start    timestamptz;
  v_expires  timestamptz;
  v_current  timestamptz;
begin
  select * into v_boost
    from public.boost_purchases
   where reference = p_reference
     for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'unknown_reference');
  end if;

  if v_boost.status = 'paid' then
    return jsonb_build_object('applied', false, 'reason', 'already_applied');
  end if;

  -- La durée vit dans le code (BOOSTS) ; seule celle qui a un effet en base
  -- est connue ici. Les autres boosts débloquent des fonctionnalités et n'ont
  -- pas d'échéance.
  v_hours := case v_boost.type when 'featured_24h' then 24 else null end;

  if v_hours is null then
    update public.boost_purchases
       set status = 'paid', activated_at = now(), expires_at = null
     where id = v_boost.id;
    return jsonb_build_object('applied', true, 'type', v_boost.type);
  end if;

  -- Un boost encore actif se prolonge : les heures restantes sont payées.
  select featured_until into v_current
    from public.shops where id = v_boost.shop_id;

  v_start := now();
  if v_current is not null and v_current > now() then
    v_start := v_current;
  end if;

  v_expires := v_start + make_interval(hours => v_hours);

  update public.boost_purchases
     set status = 'paid', activated_at = now(), expires_at = v_expires
   where id = v_boost.id;

  update public.shops
     set featured_until = v_expires
   where id = v_boost.shop_id;

  return jsonb_build_object(
    'applied', true,
    'type', v_boost.type,
    'expires_at', v_expires
  );
end;
$$;

comment on function public.apply_boost_payment(text) is
  'Active le boost d''un paiement confirmé. Idempotent, et prolonge un boost encore en cours au lieu de l''écraser.';

-- `revoke ... from public` ne suffit pas : Supabase accorde EXECUTE à
-- `anon` et `authenticated` par défaut sur le schéma public, et ces
-- rôles conservent leur droit propre. Sans le revoke explicite ci-dessous,
-- un vendeur pouvait lancer un paiement, ne pas le régler, puis appeler
-- cette fonction avec sa propre référence pour se créditer lui-même.
revoke all on function public.apply_boost_payment(text) from public;
revoke execute on function public.apply_boost_payment(text) from anon, authenticated;
