// `VERCEL_ENV` est lu AVANT les fichiers d'environnement : un `.env.local`
// tiré du scope production (`vercel env pull`) contient cette variable et ne
// doit pas faire croire au garde-fou qu'on est sur Vercel Production.
const vercelEnvFromProcess = process.env.VERCEL_ENV;

// `.env.local` d'abord (secrets locaux, ignoré par Git), `.env` en repli.
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "prisma/config";
import { assertDatabaseTarget } from "./src/lib/db/database-guard";

// Neon exposes a pooled URL for the runtime and a direct URL for schema
// changes. Prisma CLI must use the direct connection when available.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

// Hors Vercel Production, le CLI (migrate, db push, studio, generate…) ne
// doit jamais toucher la base de production ; sur Vercel Production, il ne
// doit viser qu'elle (le build échoue sinon) : voir src/lib/db/database-guard.ts.
assertDatabaseTarget(
  [
    { name: "DIRECT_URL", url: process.env.DIRECT_URL },
    { name: "DATABASE_URL", url: process.env.DATABASE_URL },
  ],
  "Le CLI Prisma",
  { env: { ...process.env, VERCEL_ENV: vercelEnvFromProcess } },
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
