// `.env.local` d'abord (secrets locaux, ignoré par Git), `.env` en repli.
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Neon exposes a pooled URL for the runtime and a direct URL for schema
    // changes. Prisma CLI must use the direct connection when available.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
