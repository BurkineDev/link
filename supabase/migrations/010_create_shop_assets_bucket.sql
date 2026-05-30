-- =============================================================================
-- LinkBoutik — Storage bucket for shop assets
-- Migration: 010_create_shop_assets_bucket.sql
-- =============================================================================
-- The app uploads shop logos, banners, product images and dashboard assets to a
-- "shop-assets" bucket (src/app/api/upload, settings-client, image-uploader),
-- but no migration ever created it — every upload failed in production.
--
-- Path conventions used by the code:
--   • api/upload (admin client, bypasses RLS):   {userId}/...
--   • settings-client / image-uploader (browser): {shopId}/...
--
-- Writes are therefore allowed when the first path segment is the uploader's
-- own user id OR a shop they own. Reads are public (the bucket is public and
-- images are served via the CDN). Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880, -- 5 MB, matches the api/upload limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS policies on storage.objects (scoped to this bucket)
-- ---------------------------------------------------------------------------

drop policy if exists "shop-assets: public read"   on storage.objects;
drop policy if exists "shop-assets: owner insert"  on storage.objects;
drop policy if exists "shop-assets: owner update"  on storage.objects;
drop policy if exists "shop-assets: owner delete"  on storage.objects;

create policy "shop-assets: public read"
  on storage.objects for select
  using (bucket_id = 'shop-assets');

create policy "shop-assets: owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "shop-assets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and s.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "shop-assets: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and s.owner_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- End of migration 010_create_shop_assets_bucket.sql
-- =============================================================================
