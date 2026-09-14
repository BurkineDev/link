import "server-only";

import { prisma } from "@/lib/prisma";
import { CRON_STALE_MS, summarizeError } from "./alert";
import { recordOpsEvent } from "./events";

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
  /** `dead` : Resend a refusé un envoi récemment (voir l'alerte `email.dead` ouverte). */
  email: { configured: boolean; dead: boolean };
}

/** Le journal existe depuis cette migration : sert de date d'installation au cron. */
const JOURNAL_MIGRATION = "20260914020000_ops_events";

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

/**
 * Message d'erreur publiable : première ligne utile, sans hôte ni port
 * (« Can't reach database server at ep-…neon.tech:5432 » devient
 * « Can't reach database server at … »). Le détail reste dans les journaux.
 */
function errorMessage(error: unknown): string {
  return summarizeError(error, 200)
    .replace(/`?\b[\w.-]+\.(neon\.tech|aws\.neon\.tech|amazonaws\.com|vercel\.app|supabase\.co)(:\d+)?`?/gi, "…")
    .replace(/\bat\s+`?[\w.-]+:\d+`?/g, "at …");
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

/**
 * Sans nouvelle du cron depuis plus de 26 h. Un cron qui n'a JAMAIS tourné
 * compte aussi, à partir de 26 h après l'installation du journal — sinon
 * un cron jamais déclenché laisserait la santé verte pour toujours.
 */
export function isCronStale(lastRunAt: Date | null, now: Date, installedAt: Date | null = null): boolean {
  const reference = lastRunAt ?? installedAt;
  if (!reference) return false;
  return now.getTime() - reference.getTime() > CRON_STALE_MS;
}

/** Une réponse par instance toutes les 20 s : un moniteur ou un robot ne multiplie pas les requêtes Neon. */
const HEALTH_CACHE_MS = 20_000;
let cached: { at: number; snapshot: HealthSnapshot } | null = null;

export async function getHealth(options: { now?: Date; fresh?: boolean } = {}): Promise<HealthSnapshot> {
  const now = options.now ?? new Date();
  if (!options.fresh && cached && now.getTime() - cached.at < HEALTH_CACHE_MS && cached.at <= now.getTime()) {
    return cached.snapshot;
  }
  const snapshot = await computeHealth(now);
  cached = { at: now.getTime(), snapshot };
  return snapshot;
}

async function computeHealth(now: Date): Promise<HealthSnapshot> {
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
    // La base est le seul composant dont la panne ne peut pas s'écrire dans
    // le journal : c'est le repli sans base (e-mail à clé horaire, mémoire
    // d'instance) qui prévient le fondateur. Production seulement : un
    // poste de développement sans base n'a pas à sonner.
    if (enforceCron) {
      await recordOpsEvent(
        {
          kind: "health.db_unreachable",
          severity: "critical",
          title: "Base de données injoignable",
          detail: `${database.error} — pages, webhooks et cron tombent ensemble tant que ça dure. Vérifie Neon (calcul suspendu, quota, incident) et DATABASE_URL sur Vercel.`,
          context: { version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
          dedupeKey: "health.db_unreachable",
        },
        { now },
      );
    }
  }

  // 2. Migrations
  const embedded = embeddedMigrations();
  let migrations: HealthSnapshot["migrations"] = {
    ok: true,
    pending: [],
    latest: embedded?.length ? embedded[embedded.length - 1]! : null,
    embedded: embedded ? embedded.length : null,
  };
  let installedAt: Date | null = null;
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
      installedAt = rows.find((r) => r.migration_name === JOURNAL_MIGRATION)?.finished_at ?? null;
      if (pending.length > 0) {
        // L'incident du 13/09 : le code attend une colonne que la base n'a
        // pas. Écrit dans le journal (dédoublonné, e-mail au plus toutes
        // les six heures) — si la table du journal manque elle aussi, le
        // repli sans base envoie quand même l'e-mail.
        await recordOpsEvent(
          {
            kind: "health.migration_drift",
            severity: "critical",
            title: `Migration en retard en base : ${pending.join(", ")}`,
            detail: "Le code déployé attend une migration que la base n'a pas : les pages et webhooks qui touchent ces colonnes répondent 500. Lance `npm run db:deploy` sur la base de production.",
            context: { pending, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
            dedupeKey: "health.migration_drift",
          },
          { now },
        );
      }
    } catch (error) {
      migrations = { ...migrations, ok: false, pending: [`(lecture impossible : ${errorMessage(error)})`] };
    }
  } else if (!database.ok) {
    migrations = { ...migrations, ok: false };
  }

  // 3. Cron et 4. alertes — seulement si la base répond.
  let cron: HealthSnapshot["cron"] = { lastRunAt: null, stale: false, enforced: enforceCron };
  let alerts: HealthSnapshot["alerts"] = { openCritical: 0, openWarning: 0 };
  let emailDead = false;
  if (database.ok) {
    try {
      const [lastRun, critical, warning, dead] = await withTimeout(
        Promise.all([
          prisma.opsEvent.findFirst({
            where: { kind: "cron.run" },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
          prisma.opsEvent.count({ where: { severity: "critical", acknowledgedAt: null } }),
          prisma.opsEvent.count({ where: { severity: "warning", acknowledgedAt: null } }),
          prisma.opsEvent.count({
            where: { kind: "email.dead", acknowledgedAt: null, lastSeenAt: { gte: new Date(now.getTime() - CRON_STALE_MS) } },
          }),
        ]),
        DB_TIMEOUT_MS,
        "alertes",
      );
      const lastRunAt = lastRun?.createdAt ?? null;
      cron = {
        lastRunAt: lastRunAt?.toISOString() ?? null,
        stale: isCronStale(lastRunAt, now, installedAt),
        enforced: enforceCron,
      };
      alerts = { openCritical: critical, openWarning: warning };
      emailDead = dead > 0;
    } catch (error) {
      // La table n'existe pas encore (migration en retard) : déjà signalé par `migrations`.
      console.warn("[health] lecture des événements impossible", errorMessage(error));
    }
  }

  // Un canal e-mail mort ne peut se signaler que par… l'e-mail : c'est
  // donc ici, et par le moniteur externe, qu'il devient visible.
  const ok = database.ok && migrations.ok && !(enforceCron && cron.stale) && !emailDead;

  return {
    ok,
    checkedAt: now.toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment,
    database,
    migrations,
    cron,
    alerts,
    email: { configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), dead: emailDead },
  };
}
