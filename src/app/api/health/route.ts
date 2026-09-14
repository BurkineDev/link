import { NextRequest, NextResponse } from "next/server";
import { getHealth } from "@/lib/ops/health";
import { enforceLimits, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — l'état de la plateforme, sans secret, pour un moniteur
 * externe : 200 si tout va, 503 sinon (base injoignable, migration en
 * retard, cron quotidien muet depuis plus de 26 h). Le corps dit lequel.
 *
 * À brancher sur un service gratuit de surveillance (toutes les cinq
 * minutes) : c'est lui qui appelle le fondateur quand la page répond 503,
 * là où l'incident du 2026-09-13 n'a été vu qu'en lisant les journaux.
 */
export async function GET(request: NextRequest) {
  // Un moniteur appelle toutes les cinq minutes ; au-delà, c'est un robot.
  // (Le résultat est de toute façon mis en cache 20 s par instance.)
  const blocked = await enforceLimits([
    { name: "health", key: getClientIp(request), limit: 30, windowSeconds: 60 },
  ]);
  if (blocked) return blocked;

  const health = await getHealth();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
