-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stock_reserved_at" TIMESTAMP(3),
ADD COLUMN     "stock_shortfall" JSONB;

-- Les commandes créées avant cette migration ont réservé leur stock au
-- passage en caisse : on le note pour qu'une annulation le rende encore.
UPDATE "orders" SET "stock_reserved_at" = "created_at"
 WHERE "stock_reserved_at" IS NULL AND "payment_status" IN ('pending', 'paid', 'partially_refunded', 'refunded');
