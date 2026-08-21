import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/shop-links/{id}/click — counts a tap on a bio-page link button.
 *
 * Public and unauthenticated by design: it is called from the visitor's
 * browser via `sendBeacon` as they leave the page. Three things keep it
 * harmless:
 *   • the SQL side is a SECURITY DEFINER RPC whose only capability is +1 on
 *     the counter of an active link belonging to a published shop;
 *   • unknown ids are a silent no-op, so the endpoint can't enumerate links;
 *   • a per-IP in-memory limit stops a single client inflating a counter.
 *
 * It always answers 204 — the visitor's navigation must never depend on it.
 */

const CLICKS_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

/** Fresh instance per call — a Response body may only be consumed once. */
const noContent = () => new NextResponse(null, { status: 204 });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!z.string().uuid().safeParse(id).success) return noContent();

  const { success } = rateLimit(`link-click:${getClientIp(request)}`, {
    limit: CLICKS_PER_MINUTE,
    windowMs: WINDOW_MS,
  });
  if (!success) return noContent();

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("track_shop_link_click", {
      p_link_id: id,
    });
    if (error) console.error("[api/shop-links click] rpc error", error);
  } catch (error) {
    console.error("[api/shop-links click] unexpected error", error);
  }

  return noContent();
}
