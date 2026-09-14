-- Journal d'exploitation (alertes fondateur) : additive, sans effet sur l'existant.
CREATE TYPE "ops_severity" AS ENUM ('info', 'warning', 'critical');

CREATE TABLE "ops_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "severity" "ops_severity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "context" JSONB,
    "dedupe_key" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_events_dedupe_key_acknowledged_at_idx" ON "ops_events"("dedupe_key", "acknowledged_at");
CREATE INDEX "ops_events_severity_acknowledged_at_last_seen_at_idx" ON "ops_events"("severity", "acknowledged_at", "last_seen_at");
CREATE INDEX "ops_events_kind_created_at_idx" ON "ops_events"("kind", "created_at");
