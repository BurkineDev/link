-- =============================================================================
-- Bio-Lien — Backfill: revert WhatsApp-mode shops without a number to online
-- Migration: 014_backfill_checkout_mode.sql
-- =============================================================================
-- Migration 012 defaulted shops.checkout_mode to 'whatsapp'. Shops that
-- predate the feature never had a whatsapp_number, so they ended up in
-- WhatsApp mode with no way for buyers to order (no number = no wa.me CTA,
-- and the cart is hidden in WhatsApp mode). Revert those to 'online' so they
-- keep the cart checkout they had before.
--
-- New shops created through onboarding always set a valid number when they
-- choose WhatsApp mode, so they are unaffected. The public storefront also
-- now falls back to the cart whenever a WhatsApp-mode shop lacks a usable
-- number, so this is belt-and-suspenders. Idempotent.
-- =============================================================================

update public.shops
set checkout_mode = 'online', updated_at = now()
where checkout_mode = 'whatsapp'
  and (whatsapp_number is null
       or length(regexp_replace(whatsapp_number, '\D', '', 'g')) < 8);

-- =============================================================================
-- End of migration 014_backfill_checkout_mode.sql
-- =============================================================================
