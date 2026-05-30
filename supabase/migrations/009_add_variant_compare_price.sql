-- =============================================================================
-- LinkBoutik — Add product_variants.compare_price (schema-drift fix)
-- Migration: 009_add_variant_compare_price.sql
-- =============================================================================
-- product_variants.compare_price is declared in src/lib/types/database.ts and
-- written by POST /api/products (variant insert), but was never created by any
-- earlier migration. Without it, variant creation fails at runtime with
-- "column compare_price does not exist". Verified absent on the live DB.
--
-- This migration also drops shops.metadata: an earlier draft added it, but the
-- current application code neither writes nor reads it (ShopRow has no such
-- field, the shops route does not insert it). Dropping keeps the repo
-- migrations and the live database in sync. Both statements are idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- product_variants.compare_price (needed)
-- ---------------------------------------------------------------------------

alter table public.product_variants
  add column if not exists compare_price numeric(14, 2);

do $$ begin
  alter table public.product_variants
    add constraint product_variants_compare_positive
      check (compare_price is null or compare_price >= 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.product_variants.compare_price is
  'Optional struck-through reference price for the variant.';

-- ---------------------------------------------------------------------------
-- shops.metadata (unused — remove to keep repo and live DB in sync)
-- ---------------------------------------------------------------------------

alter table public.shops
  drop column if exists metadata;

-- =============================================================================
-- End of migration 009_add_variant_compare_price.sql
-- =============================================================================
