import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../prisma/generated/client/client";

const globalForDatabase = globalThis as unknown as {
  bioLienPrisma?: PrismaClient;
  bioLienPool?: Pool;
};

const pool =
  globalForDatabase.bioLienPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

export const prisma =
  globalForDatabase.bioLienPrisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.bioLienPool = pool;
  globalForDatabase.bioLienPrisma = prisma;
}
