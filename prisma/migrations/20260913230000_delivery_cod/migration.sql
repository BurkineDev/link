-- Paiement à la livraison : un prestataire de plus (le vendeur lui-même, à
-- la remise du colis) et l'accord de la boutique pour le proposer.
ALTER TYPE "payment_provider" ADD VALUE IF NOT EXISTS 'cash_on_delivery';

ALTER TABLE "shops" ADD COLUMN "cash_on_delivery" BOOLEAN NOT NULL DEFAULT false;
