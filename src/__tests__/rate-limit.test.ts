/**
 * Limitation de débit des points d'entrée publics (`enforceLimits`).
 *
 * Trois cas : la couche mémoire seule (pas d'Upstash), Upstash qui bloque,
 * et Upstash en panne — qui ne doit jamais empêcher un achat.
 */

let _upstashMode: "allow" | "block" | "throw" = "allow";
const mockLimit = jest.fn<Promise<{ success: boolean; remaining: number; reset: number }>, [string]>(async () => {
  if (_upstashMode === "throw") throw new Error("ECONNRESET");
  return {
    success: _upstashMode === "allow",
    remaining: _upstashMode === "allow" ? 1 : 0,
    reset: Date.now() + 30_000,
  };
});

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = jest.fn(() => "sliding");
    static fixedWindow = jest.fn(() => "fixed");
    limit = (key: string) => mockLimit(key);
  }
  return { Ratelimit };
});

import { enforceLimits, _resetRateLimitState } from "@/lib/rate-limit";

const rule = (key = "203.0.113.7") => ({
  name: "test:ip",
  key,
  limit: 3,
  windowSeconds: 60,
});

beforeEach(() => {
  _resetRateLimitState();
  _upstashMode = "allow";
  mockLimit.mockClear();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("enforceLimits — couche mémoire seule", () => {
  test("laisse passer jusqu'à la limite puis renvoie 429 avec Retry-After", async () => {
    expect(await enforceLimits([rule()])).toBeNull();
    expect(await enforceLimits([rule()])).toBeNull();
    expect(await enforceLimits([rule()])).toBeNull();

    const blocked = await enforceLimits([rule()]);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(Number(blocked!.headers.get("Retry-After"))).toBeGreaterThan(0);
    const json = await blocked!.json();
    expect(json.error).toMatch(/Trop de requêtes/);
  });

  test("deux sujets différents ne partagent pas leur compteur", async () => {
    for (let i = 0; i < 3; i += 1) await enforceLimits([rule("10.0.0.1")]);
    expect(await enforceLimits([rule("10.0.0.1")])).not.toBeNull();
    expect(await enforceLimits([rule("10.0.0.2")])).toBeNull();
  });

  test("deux règles de nom différent ne partagent pas leur compteur", async () => {
    for (let i = 0; i < 3; i += 1) await enforceLimits([rule()]);
    expect(await enforceLimits([{ ...rule(), name: "other:ip" }])).toBeNull();
  });

  test("sans Upstash configuré, aucun appel réseau", async () => {
    await enforceLimits([rule()]);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe("enforceLimits — avec Upstash", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  });

  test("interroge Upstash avec la clé du sujet et laisse passer", async () => {
    expect(await enforceLimits([rule()])).toBeNull();
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith("203.0.113.7");
  });

  test("bloque dès qu'Upstash refuse, même si la mémoire locale laissait passer", async () => {
    _upstashMode = "block";
    const blocked = await enforceLimits([rule()]);
    expect(blocked?.status).toBe(429);
  });

  test("une panne Upstash ne bloque pas la requête", async () => {
    _upstashMode = "throw";
    expect(await enforceLimits([rule()])).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  test("la couche mémoire bloque avant d'appeler Upstash", async () => {
    for (let i = 0; i < 3; i += 1) await enforceLimits([rule()]);
    mockLimit.mockClear();
    const blocked = await enforceLimits([rule()]);
    expect(blocked?.status).toBe(429);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});
