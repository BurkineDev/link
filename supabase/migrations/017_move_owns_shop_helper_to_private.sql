-- =============================================================================
-- LinkBoutik — Move the shop-assets RLS helper into a non-exposed schema
-- Migration: 017_move_owns_shop_helper_to_private.sql
-- =============================================================================
-- Migration 016 introduced public.user_owns_shop_folder() (SECURITY DEFINER) to
-- fix shop-assets uploads. Because it lives in the `public` schema, PostgREST
-- exposes it at /rest/v1/rpc/user_owns_shop_folder, which the security linter
-- flags (0028/0029: "(anon|authenticated) can execute SECURITY DEFINER
-- function"). The function only ever returns whether the *current* caller owns a
-- given shop id (anon always gets false), so it leaks nothing — but the clean
-- remediation is to move it out of the exposed API schema.
--
-- This migration recreates the helper in a dedicated `private` schema (not
-- exposed by PostgREST), repoints the shop-assets policies at it, and drops the
-- public copy. RLS can still call it; it is simply no longer a REST endpoint.
-- Idempotent.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.user_owns_shop_folder(folder text)
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

revoke all on function private.user_owns_shop_folder(text) from public;
grant execute on function private.user_owns_shop_folder(text) to authenticated;

comment on function private.user_owns_shop_folder(text) is
  'RLS helper for the shop-assets bucket: true when the current user owns the shop whose id equals the first storage path segment. SECURITY DEFINER to avoid nested RLS on public.shops. Kept in the private schema so it is not exposed via PostgREST.';

-- Repoint the policies at the private helper.
drop policy if exists "shop-assets: owner insert"  on storage.objects;
drop policy if exists "shop-assets: owner update"  on storage.objects;
drop policy if exists "shop-assets: owner delete"  on storage.objects;

create policy "shop-assets: owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

create policy "shop-assets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.user_owns_shop_folder((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

create policy "shop-assets: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.user_owns_shop_folder((storage.foldername(name))[1])
    )
  );

-- Drop the now-unused public copy.
drop function if exists public.user_owns_shop_folder(text);

-- =============================================================================
-- End of migration 017_move_owns_shop_helper_to_private.sql
-- =============================================================================
