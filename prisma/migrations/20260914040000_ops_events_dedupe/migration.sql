-- Une seule ligne OUVERTE par clé de dédoublonnage : deux webhooks
-- simultanés ne peuvent plus créer deux alertes (et deux e-mails).
-- Index partiel : les lignes traitées (acknowledged_at posé) restent libres.
CREATE UNIQUE INDEX "ops_events_open_dedupe_key_key"
  ON "ops_events" ("dedupe_key")
  WHERE "acknowledged_at" IS NULL;
