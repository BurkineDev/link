/**
 * Garde-fou : la base de production n'est joignable que depuis Vercel
 * Production.
 *
 * Deux sens, tous deux refusés au démarrage du serveur comme au lancement
 * du CLI Prisma :
 *
 *   - dev / preview → production. Le serveur de développement local a
 *     longtemps été branché sur la base de production : un `migrate reset`,
 *     un `db push` ou un essai d'inscription sur localhost écrivait chez
 *     les vrais vendeurs. Depuis la branche Neon `development`, tout ce qui
 *     n'est pas Vercel Production doit viser cette branche.
 *   - production → autre chose. Le 2026-09-12, les URL de la branche
 *     `development` ont été collées dans Vercel Production : au déploiement
 *     suivant, www.bio-lien.com a servi une base vide pendant six minutes.
 *     Sur Vercel Production, `DATABASE_URL` et `DIRECT_URL` doivent viser
 *     l'endpoint de production, sinon le build échoue et l'ancien
 *     déploiement reste en ligne.
 *
 * Identification de la production : l'identifiant d'endpoint Neon de la
 * branche `production` (`ep-…`), connu d'office ci-dessous (ce n'est pas un
 * secret : sans mot de passe il ne donne rien), complété si besoin par
 * `PRODUCTION_DATABASE_HOST` (identifiants, hôtes complets ou URL, séparés
 * par des virgules). L'hôte direct et l'hôte « -pooler » d'un même endpoint
 * sont reconnus tous les deux.
 *
 * Identification de Vercel Production : `VERCEL_ENV=production`, mais jamais
 * quand un fichier d'environnement local (`.env.local`, `.env`…) existe :
 * `vercel env pull --environment=production` écrit justement cette variable
 * à côté de la vraie URL de production, et un déploiement Vercel n'a jamais
 * ces fichiers (ignorés par Git).
 *
 * Dérogation assumée (script de maintenance, sauvegarde) :
 * `ALLOW_PRODUCTION_DATABASE=1`.
 *
 * Ce fichier est importé par `prisma.config.ts`, chargé par le CLI Prisma
 * hors de Next : pas d'alias `@/`, pas de `server-only`.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

/** Endpoints Neon de la branche `production` du projet `biolien-production`. */
export const DEFAULT_PRODUCTION_ENDPOINTS: readonly string[] = ["ep-dawn-tree-b2sxokvu"];

/** Fichiers d'environnement locaux que Next et dotenv chargent (voir `defaultHasLocalEnvFile`). */
export const LOCAL_ENV_FILES: readonly string[] = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
];

export interface DatabaseGuardEnv {
  VERCEL_ENV?: string;
  PRODUCTION_DATABASE_HOST?: string;
  ALLOW_PRODUCTION_DATABASE?: string;
}

export interface DatabaseGuardOptions {
  env?: DatabaseGuardEnv;
  /** Vrai si un fichier d'environnement local existe (injectable pour les tests). */
  hasLocalEnvFile?: () => boolean;
}

export interface DatabaseUrlSource {
  /** Nom de la variable, pour le message d'erreur. */
  name: string;
  url: string | undefined;
}

/** Nom d'hôte d'une URL Postgres, ou null si illisible. */
export function databaseHostname(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  try {
    const { hostname } = new URL(trimmed);
    if (hostname) return hostname.toLowerCase();
  } catch {
    // URL non conforme (mot de passe avec caractères réservés…) : repli.
  }
  const match = /@([^/?:@\s]+)/.exec(trimmed);
  return match ? match[1]!.toLowerCase() : null;
}

/**
 * Identifiant d'endpoint Neon d'un hôte : premier label DNS, sans le suffixe
 * `-pooler`. `ep-a-1-pooler.c-6.eu-central-1.aws.neon.tech` → `ep-a-1`.
 */
export function endpointId(hostname: string | null): string | null {
  if (!hostname) return null;
  const label = hostname.split(".")[0]!.toLowerCase();
  const id = label.replace(/-pooler$/, "");
  return id.length > 0 ? id : null;
}

/**
 * Identifiants d'endpoint de production : la liste connue d'office, plus ce
 * que `PRODUCTION_DATABASE_HOST` ajoute (identifiant, hôte complet, hôte
 * pooler ou URL entière, avec ou sans guillemets).
 */
export function productionEndpointIds(env: DatabaseGuardEnv): string[] {
  const configured = (env.PRODUCTION_DATABASE_HOST ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter((value) => value.length > 0)
    .map((value) => endpointId(value.includes("@") ? databaseHostname(value) : value))
    .filter((value): value is string => value !== null);
  return [...new Set([...DEFAULT_PRODUCTION_ENDPOINTS, ...configured])];
}

/** Vrai si l'URL vise un endpoint de production, direct ou poolé. */
export function isProductionDatabaseUrl(
  url: string | undefined,
  env: DatabaseGuardEnv = {},
): boolean {
  const id = endpointId(databaseHostname(url));
  return id !== null && productionEndpointIds(env).includes(id);
}

/**
 * Chemins écrits en littéraux, un par fichier : le traceur de fichiers de
 * Next (output tracing) ne sait pas résoudre un chemin construit dans une
 * boucle et embarquerait alors tout le projet dans la fonction Vercel.
 */
function defaultHasLocalEnvFile(): boolean {
  const cwd = process.cwd();
  return (
    existsSync(join(cwd, ".env")) ||
    existsSync(join(cwd, ".env.local")) ||
    existsSync(join(cwd, ".env.development")) ||
    existsSync(join(cwd, ".env.development.local")) ||
    existsSync(join(cwd, ".env.production")) ||
    existsSync(join(cwd, ".env.production.local"))
  );
}

/**
 * Vrai seulement sur un vrai déploiement Vercel Production : la variable
 * `VERCEL_ENV` n'est pas crue quand un fichier d'environnement local existe.
 */
export function isVercelProduction(
  env: DatabaseGuardEnv,
  hasLocalEnvFile: () => boolean = defaultHasLocalEnvFile,
): boolean {
  return env.VERCEL_ENV === "production" && !hasLocalEnvFile();
}

/**
 * Vérifie que la base visée correspond à l'environnement. `context` nomme
 * l'appelant dans le message (« Le serveur applicatif », « Le CLI Prisma »).
 *
 *   - Vercel Production : chaque URL renseignée doit être un endpoint de
 *     production, sans dérogation possible (pour changer de base de
 *     production, ajouter le nouvel endpoint à `PRODUCTION_DATABASE_HOST`).
 *   - Ailleurs : aucune URL ne doit viser la production, sauf
 *     `ALLOW_PRODUCTION_DATABASE=1`.
 */
export function assertDatabaseTarget(
  sources: DatabaseUrlSource[],
  context: string,
  options: DatabaseGuardOptions = {},
): void {
  const env = options.env ?? (process.env as DatabaseGuardEnv);

  if (isVercelProduction(env, options.hasLocalEnvFile)) {
    const stray = sources.find(
      (source) => databaseHostname(source.url) !== null && !isProductionDatabaseUrl(source.url, env),
    );
    if (!stray) return;
    throw new Error(
      `[garde-fou] ${context} tourne sur Vercel Production mais ${stray.name} vise une autre base ` +
        `(${databaseHostname(stray.url)}) : la production servirait une base vide ou de test.\n` +
        "Sur Vercel Production, DATABASE_URL et DIRECT_URL doivent viser l'endpoint de la branche " +
        `Neon « production » (${productionEndpointIds(env).join(", ")}).\n` +
        "Pour changer de base de production, ajouter le nouvel endpoint à PRODUCTION_DATABASE_HOST.",
    );
  }

  const offending = sources.find((source) => isProductionDatabaseUrl(source.url, env));
  if (!offending) return;

  const hostname = databaseHostname(offending.url);
  if (env.ALLOW_PRODUCTION_DATABASE === "1") {
    console.warn(
      `[garde-fou] ${context} vise la base de PRODUCTION (${offending.name} = ${hostname}) ` +
        "avec ALLOW_PRODUCTION_DATABASE=1 : chaque écriture touche les vrais vendeurs.",
    );
    return;
  }

  throw new Error(
    `[garde-fou] ${context} vise la base de PRODUCTION (${offending.name} = ${hostname}) ` +
      "hors de Vercel Production.\n" +
      "DATABASE_URL et DIRECT_URL doivent pointer sur la branche Neon « development » : " +
      "npx neonctl connection-string development --project-id <projet> [--pooled] " +
      "(voir .env.example).\n" +
      "Pour une opération de maintenance assumée : ALLOW_PRODUCTION_DATABASE=1.",
  );
}

/** Ancien nom, conservé pour les appels existants. */
export const assertNotProductionDatabase = assertDatabaseTarget;
