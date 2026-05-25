-- =============================================================================
-- LinkBoutik — Add Genius Pay as payment provider
-- Migration: 005_add_geniuspay_provider.sql
-- =============================================================================

alter type public.payment_provider add value if not exists 'geniuspay';
