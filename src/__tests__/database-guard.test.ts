/**
 * Garde-fou base de production (src/lib/db/database-guard.ts).
 *
 * Le développement local a écrit dans la base de production pendant la
 * migration : ces tests fixent la règle « hors Vercel Production, jamais ».
 */

import {
  DEFAULT_PRODUCTION_ENDPOINTS,
  assertDatabaseTarget,
  assertNotProductionDatabase,
  databaseHostname,
  endpointId,
  isProductionDatabaseUrl,
  isVercelProduction,
  productionEndpointIds,
} from "@/lib/db/database-guard";

const PROD = DEFAULT_PRODUCTION_ENDPOINTS[0]!;
const REGION = "c-6.eu-central-1.aws.neon.tech";
const prodDirect = `postgresql://neondb_owner:npg_s3cr3t@${PROD}.${REGION}/neondb?sslmode=require`;
const prodPooled = `postgresql://neondb_owner:npg_s3cr3t@${PROD}-pooler.${REGION}/neondb?sslmode=require`;
const devPooled = `postgresql://neondb_owner:npg_s3cr3t@ep-orange-snow-b2pptfmo-pooler.${REGION}/neondb?sslmode=require`;

const noEnvFile = () => false;
const withEnvFile = () => true;

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("lecture des hôtes", () => {
  test("databaseHostname lit l'hôte d'une URL Postgres, port, schéma court et majuscules compris", () => {
    expect(databaseHostname(prodDirect)).toBe(`${PROD}.${REGION}`);
    expect(databaseHostname(`postgres://u:p@${PROD.toUpperCase()}.${REGION}:5432/db`)).toBe(`${PROD}.${REGION}`);
    expect(databaseHostname(`"${prodPooled}"`)).toBe(`${PROD}-pooler.${REGION}`);
  });

  test("databaseHostname tolère un mot de passe non encodé", () => {
    expect(databaseHostname("postgresql://u:p#ss@host.example/db")).toBe("host.example");
    expect(databaseHostname("postgresql://u:p@ss@host.example/db")).toBe("host.example");
  });

  test("databaseHostname renvoie null sans URL", () => {
    expect(databaseHostname(undefined)).toBeNull();
    expect(databaseHostname("")).toBeNull();
    expect(databaseHostname("   ")).toBeNull();
  });

  test("endpointId retire la région et le suffixe -pooler", () => {
    expect(endpointId(`${PROD}.${REGION}`)).toBe(PROD);
    expect(endpointId(`${PROD}-pooler.${REGION}`)).toBe(PROD);
    expect(endpointId(PROD)).toBe(PROD);
    expect(endpointId(null)).toBeNull();
  });
});

describe("productionEndpointIds", () => {
  test("connaît la production d'office, sans configuration", () => {
    expect(productionEndpointIds({})).toEqual([PROD]);
  });

  test("PRODUCTION_DATABASE_HOST ajoute des identifiants sous toutes les formes courantes", () => {
    const ids = productionEndpointIds({
      PRODUCTION_DATABASE_HOST: ` ep-a-1 , "ep-b-2.${REGION}", ep-c-3-pooler.${REGION}, postgresql://u:p@ep-d-4-pooler.${REGION}/db ,, `,
    });
    expect(ids).toEqual([PROD, "ep-a-1", "ep-b-2", "ep-c-3", "ep-d-4"]);
  });
});

describe("isProductionDatabaseUrl", () => {
  test("reconnaît l'hôte direct et l'hôte pooler de la production", () => {
    expect(isProductionDatabaseUrl(prodDirect)).toBe(true);
    expect(isProductionDatabaseUrl(prodPooled)).toBe(true);
    expect(isProductionDatabaseUrl(`postgres://u:p@${PROD}.${REGION}:5432/neondb`)).toBe(true);
  });

  test("ne confond pas la branche de développement", () => {
    expect(isProductionDatabaseUrl(devPooled)).toBe(false);
  });

  test("un identifiant qui n'est qu'un préfixe ne suffit pas", () => {
    expect(isProductionDatabaseUrl(`postgresql://u:p@${PROD}zz.${REGION}/neondb`)).toBe(false);
  });

  test("un endpoint ajouté par configuration est reconnu, même déclaré en hôte pooler", () => {
    const env = { PRODUCTION_DATABASE_HOST: `ep-new-9-pooler.${REGION}` };
    expect(isProductionDatabaseUrl(`postgresql://u:p@ep-new-9.${REGION}/db`, env)).toBe(true);
    expect(isProductionDatabaseUrl(`postgresql://u:p@ep-new-9-pooler.${REGION}/db`, env)).toBe(true);
  });
});

describe("isVercelProduction", () => {
  test("vrai seulement avec VERCEL_ENV=production et sans fichier d'environnement local", () => {
    expect(isVercelProduction({ VERCEL_ENV: "production" }, noEnvFile)).toBe(true);
    expect(isVercelProduction({ VERCEL_ENV: "production" }, withEnvFile)).toBe(false);
    expect(isVercelProduction({ VERCEL_ENV: "preview" }, noEnvFile)).toBe(false);
    expect(isVercelProduction({ VERCEL_ENV: "development" }, noEnvFile)).toBe(false);
    expect(isVercelProduction({}, noEnvFile)).toBe(false);
  });
});

describe("assertDatabaseTarget — hors Vercel Production", () => {
  const sources = (url: string, name = "DATABASE_URL") => [{ name, url }];

  test("refuse la production hors Vercel, en nommant la variable et en disant quoi faire", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodPooled), "Le serveur applicatif", {
        env: {},
        hasLocalEnvFile: withEnvFile,
      }),
    ).toThrow(/PRODUCTION \(DATABASE_URL = ep-dawn[\s\S]*development[\s\S]*ALLOW_PRODUCTION_DATABASE=1/);
  });

  test("vérifie chaque variable : DIRECT_URL seule sur la production suffit à refuser", () => {
    expect(() =>
      assertNotProductionDatabase(
        [
          { name: "DATABASE_URL", url: devPooled },
          { name: "DIRECT_URL", url: prodDirect },
        ],
        "Le CLI Prisma",
        { env: {}, hasLocalEnvFile: withEnvFile },
      ),
    ).toThrow(/DIRECT_URL = /);
  });

  test("refuse aussi depuis une preview Vercel", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodDirect), "Le CLI Prisma", {
        env: { VERCEL_ENV: "preview" },
        hasLocalEnvFile: noEnvFile,
      }),
    ).toThrow(/PRODUCTION/);
  });

  test("refuse même sans aucune configuration : la production est connue d'office", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodDirect), "Le CLI Prisma", {
        env: {},
        hasLocalEnvFile: noEnvFile,
      }),
    ).toThrow(/PRODUCTION/);
  });

  test("VERCEL_ENV=production venu d'un fichier local ne désarme pas le garde-fou", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodPooled), "Le serveur applicatif", {
        env: { VERCEL_ENV: "production" },
        hasLocalEnvFile: withEnvFile,
      }),
    ).toThrow(/PRODUCTION/);
  });

  test("laisse passer un vrai déploiement Vercel Production", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodPooled), "Le serveur applicatif", {
        env: { VERCEL_ENV: "production" },
        hasLocalEnvFile: noEnvFile,
      }),
    ).not.toThrow();
  });

  test("laisse passer la branche de développement, sans avertissement", () => {
    expect(() =>
      assertNotProductionDatabase(
        [
          { name: "DATABASE_URL", url: devPooled },
          { name: "DIRECT_URL", url: undefined },
        ],
        "Le serveur applicatif",
        { env: {}, hasLocalEnvFile: withEnvFile },
      ),
    ).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("dérogation explicite : passe, mais prévient ; « true » ne suffit pas", () => {
    expect(() =>
      assertNotProductionDatabase(sources(prodDirect), "Le CLI Prisma", {
        env: { ALLOW_PRODUCTION_DATABASE: "1" },
        hasLocalEnvFile: withEnvFile,
      }),
    ).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/ALLOW_PRODUCTION_DATABASE=1/));

    expect(() =>
      assertNotProductionDatabase(sources(prodDirect), "Le CLI Prisma", {
        env: { ALLOW_PRODUCTION_DATABASE: "true" },
        hasLocalEnvFile: withEnvFile,
      }),
    ).toThrow(/PRODUCTION/);
  });
});

describe("assertDatabaseTarget — sur Vercel Production (sens inverse)", () => {
  const prodEnv = { VERCEL_ENV: "production" };

  test("refuse une URL de la branche de développement, en nommant la variable, sans dérogation possible", () => {
    expect(() =>
      assertDatabaseTarget(
        [
          { name: "DATABASE_URL", url: prodPooled },
          { name: "DIRECT_URL", url: devPooled },
        ],
        "Le CLI Prisma",
        { env: { ...prodEnv, ALLOW_PRODUCTION_DATABASE: "1" }, hasLocalEnvFile: noEnvFile },
      ),
    ).toThrow(/Vercel Production mais DIRECT_URL vise une autre base \(ep-orange-snow[\s\S]*PRODUCTION_DATABASE_HOST/);
  });

  test("laisse passer les deux endpoints de production (direct et pooler)", () => {
    expect(() =>
      assertDatabaseTarget(
        [
          { name: "DATABASE_URL", url: prodPooled },
          { name: "DIRECT_URL", url: prodDirect },
        ],
        "Le serveur applicatif",
        { env: prodEnv, hasLocalEnvFile: noEnvFile },
      ),
    ).not.toThrow();
  });

  test("une variable absente ou vide n'est pas jugée (c'est le pool qui échouera)", () => {
    expect(() =>
      assertDatabaseTarget(
        [
          { name: "DATABASE_URL", url: prodPooled },
          { name: "DIRECT_URL", url: undefined },
          { name: "AUTRE", url: "" },
        ],
        "Le serveur applicatif",
        { env: prodEnv, hasLocalEnvFile: noEnvFile },
      ),
    ).not.toThrow();
  });

  test("un nouvel endpoint de production déclaré via PRODUCTION_DATABASE_HOST est accepté", () => {
    expect(() =>
      assertDatabaseTarget([{ name: "DATABASE_URL", url: devPooled }], "Le serveur applicatif", {
        env: { ...prodEnv, PRODUCTION_DATABASE_HOST: "ep-orange-snow-b2pptfmo" },
        hasLocalEnvFile: noEnvFile,
      }),
    ).not.toThrow();
  });

  test("VERCEL_ENV=production tiré d'un fichier local n'active pas le sens inverse (la règle locale s'applique)", () => {
    expect(() =>
      assertDatabaseTarget([{ name: "DATABASE_URL", url: devPooled }], "Le serveur applicatif", {
        env: prodEnv,
        hasLocalEnvFile: withEnvFile,
      }),
    ).not.toThrow();
  });

  test("l'ancien nom reste disponible", () => {
    expect(assertNotProductionDatabase).toBe(assertDatabaseTarget);
  });
});
