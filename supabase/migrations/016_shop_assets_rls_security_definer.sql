-- =============================================================================
-- LinkBoutik — shop-assets RLS: ownership via SECURITY DEFINER (no nested RLS)
-- Migration: 016_shop_assets_rls_security_definer.sql
-- =============================================================================
-- Migration 015 fixed the `name` -> shops.name column-ambiguity in the
-- shop-assets owner policies, but browser uploads to "<shopId>/<file>" STILL
-- failed. Root cause #2: the ownership check runs as a sub-select on public.shops
-- *inside* the storage.objects INSERT policy, and public.shops itself has RLS.
-- Evaluating `s.owner_id = auth.uid()` two RLS layers deep (storage policy ->
-- shops sub-select -> shops SELECT policy, which also calls auth.uid()) returns
-- false even though every part is individually true — a PostgreSQL nested-RLS
-- evaluation quirk. Proven on production: identical checks pass at one level and
-- fail when nested.
--
-- Fix: move the ownership lookup into a SECURITY DEFINER function. It runs as the
-- function owner, so the read of public.shops does NOT re-enter shops' RLS, and
-- the folder segment is computed at the policy's top level (where `name` is
-- unambiguously the storage object path) and passed in as a plain argument. This
-- removes BOTH the ambiguity and the nesting.
--
-- Path conventions (unchanged):
--   • api/upload (admin client, bypasses RLS):   {userId}/...
--   • image-uploader / settings (browser):       {shopId}/...
-- Reads remain public via the CDN (no SELECT policy needed). Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ownership helper — true when the caller owns the shop whose id is `folder`.
-- SECURITY DEFINER so the shops read bypasses shops' own RLS (avoids the nested
-- RLS quirk). Locked search_path; only authenticated may execute it.
-- ---------------------------------------------------------------------------

create or replace function public.user_owns_shop_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.shops s
    where s.id::text = folder
      and s.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.user_owns_shop_folder(text) from public;
grant execute on function public.user_owns_shop_folder(text) to authenticated;

comment on function public.user_owns_shop_folder(text) is
  'RLS helper for the shop-assets bucket: true when the current user owns the shop whose id equals the first storage path segment. SECURITY DEFINER to avoid nested RLS on public.shops.';

-- ---------------------------------------------------------------------------
-- Rewrite the owner policies to use the helper. A write is allowed when the
-- first path segment is the caller's own user id OR a shop they own.
-- ---------------------------------------------------------------------------

drop policy if exists "shop-assets: owner insert"  on storage.objects;
drop policy if exists "shop-assets: owner update"  on storage.objects;
drop policy if exists "shop-assets: owner delete"  on storage.objects;

create policy "shop-assets: owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

create policy "shop-assets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.user_owns_shop_folder((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

create policy "shop-assets: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

-- =============================================================================
-- End of migration 016_shop_assets_rls_security_definer.sql
-- =============================================================================
