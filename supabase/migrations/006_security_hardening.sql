-- =============================================================================
-- LinkBoutik — Security hardening (advisor follow-up)
-- Migration: 006_security_hardening.sql
-- =============================================================================
-- Fixes flagged by the Supabase advisor:
--   • shop_stats view: switch to SECURITY INVOKER so RLS of the caller applies.
--   • RPC functions: revoke EXECUTE from anon + authenticated. They are only
--     ever called from server routes using the service-role admin client.
--   • Trigger functions: revoke EXECUTE so they can't be invoked via /rpc.
-- =============================================================================

drop view if exists public.shop_stats;
create view public.shop_stats
  with (security_invoker = on)
as
select
  s.id as shop_id,
  s.owner_id,
  count(distinct o.id) filter (where o.payment_status = 'paid'::payment_status) as paid_order_count,
  coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'::payment_status), 0) as total_revenue,
  count(distinct p.id) filter (where p.is_published) as published_product_count,
  count(distinct p.id) as total_product_count
from shops s
  left join orders o on o.shop_id = s.id
  left join products p on p.shop_id = s.id
group by s.id, s.owner_id;

comment on view public.shop_stats is
  'Pre-aggregated statistics per shop. Filtered by the owner via RLS on underlying tables.';

revoke execute on function public.handle_new_user()                   from anon, authenticated, public;
revoke execute on function public.handle_updated_at()                 from anon, authenticated, public;
revoke execute on function public.handle_new_profile_subscription()   from anon, authenticated, public;

revoke execute on function public.reserve_stock(jsonb)                       from anon, authenticated, public;
revoke execute on function public.release_stock(jsonb)                       from anon, authenticated, public;
revoke execute on function public.redeem_promo_code(uuid, text, numeric)     from anon, authenticated, public;

grant  execute on function public.reserve_stock(jsonb)                       to service_role;
grant  execute on function public.release_stock(jsonb)                       to service_role;
grant  execute on function public.redeem_promo_code(uuid, text, numeric)     to service_role;
