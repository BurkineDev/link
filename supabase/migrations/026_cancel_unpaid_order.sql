-- ---------------------------------------------------------------------------
-- Migration 026: annulation atomique d'une commande non payée
-- ---------------------------------------------------------------------------
-- Les callbacks navigateur et les webhooks peuvent signaler presque en même
-- temps qu'un paiement a expiré. Une annulation en trois requêtes pouvait donc
-- restituer deux fois le stock et deux fois le code promo. Le verrou de ligne
-- rend maintenant l'opération idempotente.

create or replace function public.cancel_unpaid_order(
  p_order_id uuid,
  p_payment_ref text default null,
  p_payment_provider text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('cancelled', false, 'reason', 'not_found');
  end if;

  if v_order.payment_status <> 'pending' then
    return jsonb_build_object('cancelled', false, 'reason', 'already_settled');
  end if;

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_quantity := greatest(coalesce((v_item->>'quantity')::integer, 0), 0);

    if v_quantity = 0 then
      continue;
    end if;

    if v_variant_id is not null then
      update public.product_variants
         set stock_quantity = stock_quantity + v_quantity
       where id = v_variant_id
         and product_id = v_product_id
         and stock_quantity is not null;
    else
      update public.products
         set stock_quantity = stock_quantity + v_quantity
       where id = v_product_id
         and stock_quantity is not null;
    end if;
  end loop;

  if v_order.promo_code is not null then
    update public.promo_codes
       set uses_count = greatest(uses_count - 1, 0)
     where shop_id = v_order.shop_id
       and code = v_order.promo_code
       and uses_count > 0;
  end if;

  update public.orders
     set status = 'cancelled',
         payment_status = 'failed',
         payment_ref = coalesce(p_payment_ref, payment_ref),
         payment_provider = coalesce(
           p_payment_provider::public.payment_provider,
           payment_provider
         )
   where id = v_order.id;

  return jsonb_build_object('cancelled', true);
end;
$$;

comment on function public.cancel_unpaid_order(uuid, text, text) is
  'Annule une commande pending et restitue stock + promo une seule fois.';

revoke all on function public.cancel_unpaid_order(uuid, text, text) from public;
revoke execute on function public.cancel_unpaid_order(uuid, text, text)
  from anon, authenticated;
