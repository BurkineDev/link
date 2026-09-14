import "server-only";

import { prisma } from "@/lib/prisma";
import { CRON_STALE_MS } from "./alert";

/**
 * L'état de santé que `/api/health` publie et que l'écran Santé affiche.
 *
 * Quatre questions, chacune avec sa réponse honnête :
 * - la base répond-elle ?
 * - le code déployé a-t-il toutes ses migrations en base ?
 * - le cron quotidien a-t-il tourné depuis moins de 26 h ?
 * - reste-t-il des alertes critiques que personne n'a traitées ?
 *
 * `ok` est faux dès que l'une des trois premières est mauvaise : c'est ce
 * qu'un moniteur externe (UptimeRobot, Better Stack, un cron ailleurs)
 * surveille en appelant `/api/health` toutes les cinq minutes.
 */

export interface HealthSnapshot {
  ok: boolean;
  checkedAt: string;
  version: string | null;
  environment: string | null;
  database: { ok: boolean; latencyMs: number | null; error: string | null };
  migrations: {
    ok: boolean;
    /** Migrations présentes dans le build mais absentes (ou non terminées) en base. */
    pending: string[];
    /** Dernière migration connue du build. */
    latest: string | null;
    /** `null` quand le build n'a pas embarqué la liste (tests, environnement local sans build). */
    embedded: number | null;
  };
  cron: { lastRunAt: string | null; stale: boolean; enforced: boolean };
  alerts: { openCritical: number; openWarning: number };
  email: { configured: boolean };
}

const DB_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${ms} ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.split("\n")[0]?.slice(0, 200) ?? "erreur";
  return String(error).slice(0, 200);
}

/**
 * Posé par next.config.ts au build. Lu par son nom complet, pas via un
 * objet : Next remplace `process.env.PRISMA_MIGRATIONS` mot pour mot dans
 * le bundle, un accès dynamique resterait vide.
 */
const BUILD_MIGRATIONS = process.env.PRISMA_MIGRATIONS;

/** Les migrations que ce build attend, dans l'ordre. */
export function embeddedMigrations(raw: string | undefined = BUILD_MIGRATIONS): string[] | null {
  if (raw === undefined) return null;
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Ce qui manque en base par rapport au build : une migration jamais
 * appliquée, ou commencée sans être terminée, ou annulée.
 */
export function pendingMigrations(
  embedded: string[],
  applied: Array<{ name: string; finished: boolean; rolledBack: boolean }>,
): string[] {
  const done = new Set(applied.filter((m) => m.finished && !m.rolledBack).map((m) => m.name));
  return embedded.filter((name) => !done.has(name));
}

export function isCronStale(lastRunAt: Date | null, now: Date): boolean {
  if (!lastRunAt) return false;
  return now.getTime() - lastRunAt.getTime() > CRON_STALE_MS;
}

export async function getHealth(options: { now?: Date } = {}): Promise<HealthSnapshot> {
  const now = options.now ?? new Date();
  const environment = process.env.VERCEL_ENV ?? null;
  const enforceCron = environment === "production";

  // 1. Base
  let database: HealthSnapshot["database"] = { ok: false, latencyMs: null, error: null };
  const started = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`select 1`, DB_TIMEOUT_MS, "base");
    database = { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (error) {
    database = { ok: false, latencyMs: null, error: errorMessage(error) };
  }

  // 2. Migrations
  const embedded = embeddedMigrations();
  let migrations: HealthSnapshot["migrations"] = {
    ok: true,
    pending: [],
    latest: embedded?.length ? embedded[embedded.length - 1]! : null,
    embedded: embedded ? embedded.length : null,
  };
  if (database.ok && embedded && embedded.length > 0) {
    try {
      const rows = await withTimeout(
        prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
          select migration_name, finished_at, rolled_back_at from "_prisma_migrations"
        `,
        DB_TIMEOUT_MS,
        "migrations",
      );
      const pending = pendingMigrations(
        embedded,
        rows.map((r) => ({ name: r.migration_name, finished: r.finished_at !== null, rolledBack: r.rolled_back_at !== null })),
      );
      migrations = { ...migrations, ok: pending.length === 0, pending };
    } catch (error) {
      migrations = { ...migrations, ok: false, pending: [`(lecture impossible : ${errorMessage(error)})`] };
    }
  } else if (!database.ok) {
    migrations = { ...migrations, ok: false };
  }

  // 3. Cron et 4. alertes — seulement si la base répond.
  let cron: HealthSnapshot["cron"] = { lastRunAt: null, stale: false, enforced: enforceCron };
  let alerts: HealthSnapshot["alerts"] = { openCritical: 0, openWarning: 0 };
  if (database.ok) {
    try {
      const [lastRun, critical, warning] = await withTimeout(
        Promise.all([
          prisma.opsEvent.findFirst({
            where: { kind: "cron.run" },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
          prisma.opsEvent.count({ where: { severity: "critical", acknowledgedAt: null } }),
          prisma.opsEvent.count({ where: { severity: "warning", acknowledgedAt: null } }),
        ]),
        DB_TIMEOUT_MS,
        "alertes",
      );
      const lastRunAt = lastRun?.createdAt ?? null;
      cron = { lastRunAt: lastRunAt?.toISOString() ?? null, stale: isCronStale(lastRunAt, now), enforced: enforceCron };
      alerts = { openCritical: critical, openWarning: warning };
    } catch (error) {
      // La table n'existe pas encore (migration en retard) : déjà signalé par `migrations`.
      console.warn("[health] lecture des événements impossible", errorMessage(error));
    }
  }

  const ok = database.ok && migrations.ok && !(enforceCron && cron.stale);

  return {
    ok,
    checkedAt: now.toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment,
    database,
    migrations,
    cron,
    alerts,
    email: { configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) },
  };
}
