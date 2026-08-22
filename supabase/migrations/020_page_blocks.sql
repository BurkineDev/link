-- ---------------------------------------------------------------------------
-- Migration 020: page_blocks — la BioPage devient une composition de blocs
-- ---------------------------------------------------------------------------
-- Jusqu'ici la page publique était câblée en dur : une liste de liens, puis
-- une grille de produits. Le vendeur ne pouvait ni réordonner, ni intercaler,
-- ni ajouter un bloc d'un autre type.
--
-- `page_blocks` rend la page composable. Le contenu spécifique à chaque type
-- vit dans `config` (JSONB validé côté application par un schéma Zod typé) :
-- c'est ce qui permet d'ajouter un type de bloc sans migration ni réécriture
-- du Page Builder.
--
-- Rattachement : `shop_id`. Une boutique = un Business = une BioPage
-- aujourd'hui (voir docs/social-commerce-os.md, décision 1 et 2). La colonne
-- deviendra `page_id` le jour où un Business portera plusieurs pages.
--
-- Rétrocompatibilité : aucune donnée n'est déplacée ici. Tant qu'une boutique
-- n'a aucun bloc, la page publique en synthétise depuis shop_links et
-- products. La matérialisation se fera au premier passage dans le Page
-- Builder, sous contrôle du vendeur.
-- ---------------------------------------------------------------------------

create table if not exists public.page_blocks (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  type        text not null,
  position    integer not null default 0,
  title       text,
  config      jsonb not null default '{}'::jsonb,
  style       jsonb not null default '{}'::jsonb,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint page_blocks_type_enum check (type in (
    'LINK', 'PRODUCT', 'PRODUCT_COLLECTION', 'WHATSAPP', 'SOCIAL',
    'VIDEO', 'IMAGE', 'GALLERY', 'TEXT', 'SERVICE', 'BOOKING',
    'PAYMENT', 'FORM', 'REVIEWS', 'LOCATION', 'PROMOTION'
  )),
  constraint page_blocks_title_length check (
    title is null or char_length(title) <= 120
  ),
  constraint page_blocks_position_positive check (position >= 0),
  -- Garde-fou de volume : une BioPage lisible n'a pas 500 blocs, et cette
  -- borne protège le rendu public d'un abus.
  constraint page_blocks_config_size check (pg_column_size(config) <= 16384)
);

comment on table public.page_blocks is
  'Blocs composant la BioPage publique d''une boutique. Le contenu propre à chaque type vit dans config (JSONB validé côté application).';
comment on column public.page_blocks.type is
  'Type de bloc. Ajouter une valeur ici suffit à ouvrir un nouveau type — voir src/lib/blocks/.';
comment on column public.page_blocks.config is
  'Contenu typé du bloc, validé par le schéma Zod correspondant à son type.';
comment on column public.page_blocks.visible is
  'Faux = le bloc reste dans l''éditeur mais disparaît de la page publique.';

create index if not exists page_blocks_shop_position_idx
  on public.page_blocks (shop_id, position);

create trigger page_blocks_updated_at
  before update on public.page_blocks
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : lecture publique des blocs visibles d'une boutique publiée,
--       écriture réservée au propriétaire.
-- ---------------------------------------------------------------------------

alter table public.page_blocks enable row level security;

drop policy if exists "page_blocks: public read visible" on public.page_blocks;
create policy "page_blocks: public read visible"
  on public.page_blocks for select
  using (
    (
      visible = true
      and exists (
        select 1 from public.shops s
        where s.id = page_blocks.shop_id and s.is_published = true
      )
    )
    or exists (
      select 1 from public.shops s
      where s.id = page_blocks.shop_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "page_blocks: owner insert" on public.page_blocks;
create policy "page_blocks: owner insert"
  on public.page_blocks for insert
  with check (
    exists (
      select 1 from public.shops s
      where s.id = page_blocks.shop_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "page_blocks: owner update" on public.page_blocks;
create policy "page_blocks: owner update"
  on public.page_blocks for update
  using (
    exists (
      select 1 from public.shops s
      where s.id = page_blocks.shop_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "page_blocks: owner delete" on public.page_blocks;
create policy "page_blocks: owner delete"
  on public.page_blocks for delete
  using (
    exists (
      select 1 from public.shops s
      where s.id = page_blocks.shop_id and s.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- reorder_page_blocks(uuid, uuid[]) — réordonnancement atomique
-- ---------------------------------------------------------------------------
-- Le Page Builder déplace un bloc et renvoie l'ordre complet. Le faire en une
-- transaction évite l'état intermédiaire où deux blocs partagent une position
-- (ce qui rendrait le rendu public non déterministe le temps des requêtes).
-- Les blocs absents de la liste gardent leur position, à la fin.

create or replace function public.reorder_page_blocks(
  p_shop_id uuid,
  p_block_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.page_blocks b
     set position = idx.ord - 1
    from unnest(p_block_ids) with ordinality as idx(block_id, ord)
   where b.id = idx.block_id
     and b.shop_id = p_shop_id;
end;
$$;

comment on function public.reorder_page_blocks(uuid, uuid[]) is
  'Réordonne les blocs d''une page en une seule transaction. SECURITY INVOKER : la RLS du propriétaire s''applique.';

grant execute on function public.reorder_page_blocks(uuid, uuid[]) to authenticated;
