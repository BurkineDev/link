-- =============================================================================
-- LinkBoutik — Fix shop-assets RLS: column-ambiguity in the ownership check
-- Migration: 015_fix_shop_assets_rls_name_ambiguity.sql
-- =============================================================================
-- The owner insert/update/delete policies on storage.objects (migration 010)
-- authorise a write when the first path segment is either the uploader's own
-- user id OR a shop they own:
--
--     exists (select 1 from public.shops s
--             where s.id::text = (storage.foldername(name))[1]
--               and s.owner_id = auth.uid())
--
-- Inside that sub-select, `name` is AMBIGUOUS: both storage.objects (the table
-- the policy is on) and public.shops have a `name` column. PostgreSQL resolves
-- the unqualified `name` to the INNER table — shops.name — so the check compares
-- the shop id against folder segments of the shop's *display name* instead of
-- the uploaded file's path. That branch is therefore always false.
--
-- Product images (components/dashboard/image-uploader) and the shop logo/banner
-- (dashboard/settings) both upload straight from the browser to paths prefixed
-- with the shop id ("<shopId>/<file>"), so this is the ONLY branch that could
-- authorise them. Net effect in production: every browser upload is rejected by
-- RLS (HTTP 400) and nothing is saved — adding product photos and saving shop
-- branding silently do nothing.
--
-- Fix: fully-qualify the outer column as `storage.objects.name` everywhere so it
-- can never bind to shops.name. Behaviour is otherwise identical to 010.
-- Idempotent.
-- =============================================================================

drop policy if exists "shop-assets: owner insert"  on storage.objects;
drop policy if exists "shop-assets: owner update"  on storage.objects;
drop policy if exists "shop-assets: owner delete"  on storage.objects;

create policy "shop-assets: owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(storage.objects.name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "shop-assets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(storage.objects.name))[1]
          and s.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(storage.objects.name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "shop-assets: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(storage.objects.name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- End of migration 015_fix_shop_assets_rls_name_ambiguity.sql
-- =============================================================================
