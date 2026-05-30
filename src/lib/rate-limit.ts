import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for the public, unauthenticated AI tools under /api/outils/*.
 *
 * Three layers, cheapest first:
 *   1. In-memory per-IP burst — instant, per-instance, absorbs bursts for free.
 *   2. Upstash (distributed) per-IP — shared across all serverless instances:
 *      a burst window and a daily cap so no single IP eats the budget.
 *   3. Upstash global daily cap — a shared ceiling on TOTAL generations/day.
 *      This is the real budget guard: even a distributed attack from many IPs
 *      cannot push spend past the ceiling.
 *
 * If Upstash env vars are absent (e.g. local dev), layers 2-3 are skipped and
 * only the in-memory layer applies. Production MUST set:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

// ---------------------------------------------------------------------------
// Tunable limits
// ---------------------------------------------------------------------------

const IP_BURST = { limit: 10, window: "60 s" as const }; // per IP, short window
const IP_DAILY = { limit: 30, window: "1 d" as const }; // per IP, per day
const GLOBAL_DAILY = 300; // total AI generations/day across all IPs & tools

// ---------------------------------------------------------------------------
// In-memory limiter (layer 1 / dev fallback)
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Upstash limiters (layers 2-3) — lazily initialised, shared module state
// ---------------------------------------------------------------------------

interface Limiters {
  ipBurst: Ratelimit;
  ipDaily: Ratelimit;
  globalDaily: Ratelimit;
}

let cached: Limiters | null | undefined;
let warned = false;

function getLimiters(): Limiters | null {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warned) {
      console.warn(
        "[rate-limit] Upstash not configured — using in-memory limiting only. " +
          "Set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in production.",
      );
      warned = true;
    }
    cached = null;
    return null;
  }

  const redis = new Redis({ url, token });
  cached = {
    ipBurst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_BURST.limit, IP_BURST.window),
      prefix: "rl:ai:ipburst",
    }),
    ipDaily: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(IP_DAILY.limit, IP_DAILY.window),
      prefix: "rl:ai:ipday",
    }),
    globalDaily: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(GLOBAL_DAILY, "1 d"),
      prefix: "rl:ai:global",
    }),
  };
  return cached;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** 429 with Retry-After (too many requests from this client). */
export function tooManyRequests(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Trop de requêtes. Patientez un instant avant de réessayer." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** 503 when the global daily AI budget ceiling is reached. */
function budgetExhausted(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error:
        "Nos outils IA gratuits ont atteint leur quota du jour. Réessayez demain.",
    },
    { status: 503, headers: { "Retry-After": String(retryAfter) } },
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Enforce all rate-limit layers for an AI tool request.
 * Returns a ready-to-send error response when blocked, or null when allowed.
 */
export async function enforceAiLimits(
  request: NextRequest,
  tool: string,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);

  // Layer 1 — in-memory burst (per instance, instant, free).
  const mem = rateLimit(`ai:${tool}:${ip}`, {
    limit: IP_BURST.limit,
    windowMs: 60_000,
  });
  if (!mem.success) return tooManyRequests(mem.resetAt);

  const limiters = getLimiters();
  if (!limiters) return null; // Upstash absent (dev) — in-memory only.

  // Layer 2 — distributed per-IP (burst, then daily).
  const burst = await limiters.ipBurst.limit(`${tool}:${ip}`);
  if (!burst.success) return tooManyRequests(burst.reset);

  const daily = await limiters.ipDaily.limit(ip);
  if (!daily.success) return tooManyRequests(daily.reset);

  // Layer 3 — global daily budget ceiling (shared across all IPs & tools).
  // Checked last so requests already blocked above don't consume the budget.
  const global = await limiters.globalDaily.limit("global");
  if (!global.success) return budgetExhausted(global.reset);

  return null;
}
