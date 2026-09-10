-- ---------------------------------------------------------------------------
-- Migration 025: restituer une utilisation promo quand le paiement échoue
-- ---------------------------------------------------------------------------
-- `redeem_promo_code` réserve une utilisation avant le stock et la création
-- de la session de paiement. Si l'une de ces étapes échoue (ou si la session
-- expire), l'utilisation doit être rendue. La fonction reste réservée au
-- serveur : exposée au navigateur, elle permettrait de contourner max_uses.

create or replace function public.release_promo_redemption(
  p_shop_id uuid,
  p_code text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.promo_codes
     set uses_count = greatest(uses_count - 1, 0)
   where shop_id = p_shop_id
     and code = upper(trim(p_code))
     and uses_count > 0;
$$;

comment on function public.release_promo_redemption(uuid, text) is
  'Rend une utilisation réservée quand une commande échoue avant paiement.';

revoke all on function public.release_promo_redemption(uuid, text) from public;
revoke execute on function public.release_promo_redemption(uuid, text)
  from anon, authenticated;
