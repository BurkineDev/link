-- D'où vient une inscription : les UTM du premier contact, gardés à la
-- création du compte (voir src/lib/acquisition.ts). Colonne nullable,
-- additive : rien ne change pour les comptes existants.
ALTER TABLE "user" ADD COLUMN "acquisition" JSONB;
