-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "destination" JSONB,
ADD COLUMN     "note" TEXT,
ALTER COLUMN "status" SET DEFAULT 'requested';

-- CreateIndex
CREATE INDEX "payouts_status_created_at_idx" ON "payouts"("status", "created_at");
