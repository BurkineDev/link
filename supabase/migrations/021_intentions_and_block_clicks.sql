-- ---------------------------------------------------------------------------
-- Migration 021 : intentions d'onboarding + clics par bloc
-- ---------------------------------------------------------------------------
-- Deux besoins nés de la phase 2 (Page Builder + onboarding par intention) :
--
--  1. `shops.intentions` — ce que le vendeur a répondu à « Que veux-tu faire
--     avec Bio-Lien ? ». On le garde après l'onboarding parce que ce n'est pas
--     une donnée jetable : c'est ce qui permet au tableau de bord de répondre
--     « qu'est-ce que je dois faire maintenant ? » (mission §7) sans redemander
--     au vendeur, et au Page Builder de proposer les blocs qui manquent encore.
--
--  2. `page_blocks.click_count` — le compteur de clics vivait sur `shop_links`.
--     Dès qu'une boutique adopte ses blocs, ses boutons sont des blocs : sans
--     ce compteur, adopter la composition ferait silencieusement disparaître
--     les statistiques de liens que le vendeur avait. Même contrat que
--     `shop_links.click_count`, même forme de RPC.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. shops.intentions
-- ---------------------------------------------------------------------------

alter table public.shops
  add column if not exists intentions text[] not null default '{}';

alter table public.shops
  drop constraint if exists shops_intentions_enum;

-- La liste fait autorité côté application (src/lib/onboarding/intentions.ts).
-- La contrainte est là pour qu'une valeur inventée ne s'installe jamais en
-- base : elle serait ignorée au rendu et invisible en debug.
alter table public.shops
  add constraint shops_intentions_enum
    check (
      array_length(intentions, 1) is null
      or (
        array_length(intentions, 1) <= 8
        and intentions <@ array['sell', 'whatsapp', 'socials', 'promote']::text[]
      )
    );

comment on column public.shops.intentions is
  'Objectifs déclarés par le vendeur à l''onboarding. Sert à composer sa première page et à prioriser les suggestions du tableau de bord.';

-- ---------------------------------------------------------------------------
-- 2. page_blocks.click_count
-- ---------------------------------------------------------------------------

alter table public.page_blocks
  add column if not exists click_count integer not null default 0;

alter table public.page_blocks
  drop constraint if exists page_blocks_click_count_positive;

alter table public.page_blocks
  add constraint page_blocks_click_count_positive
    check (click_count >= 0);

comment on column public.page_blocks.click_count is
  'Nombre de taps sur ce bloc. Incrémenté via track_page_block_click().';

-- ---------------------------------------------------------------------------
-- 3. track_page_block_click(uuid)
-- ---------------------------------------------------------------------------
-- Mêmes garde-fous que track_shop_link_click : SECURITY DEFINER pour qu'un
-- visiteur anonyme puisse compter son tap sans qu'aucune politique UPDATE
-- publique n'existe sur page_blocks (elle laisserait réécrire les URL d'un
-- vendeur), search_path épinglé, et un id inconnu est un no-op silencieux —
-- l'endpoint ne peut donc pas servir à énumérer les blocs.

create or replace function public.track_page_block_click(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.page_blocks b
     set click_count = b.click_count + 1
   where b.id = p_block_id
     and b.visible = true
     and exists (
       select 1
         from public.shops s
        where s.id = b.shop_id
          and s.is_published = true
     );
end;
$$;

comment on function public.track_page_block_click(uuid) is
  'Incrémente click_count d''un bloc visible d''une boutique publiée. Appelable anonymement ; un id inconnu est un no-op.';

revoke all on function public.track_page_block_click(uuid) from public;
grant execute on function public.track_page_block_click(uuid) to anon, authenticated;
