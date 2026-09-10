import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackShopPageView } from "@/lib/db/tracking";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/shop-views/{shopId} — counts one view of a public bio page.
 *
 * Same contract as the link-click endpoint: called via `sendBeacon` from the
 * visitor's browser, backed by `trackShopPageView` (published shops only,
 * unknown ids are a no-op), per-IP rate-limited,
 * and always 204 — rendering the page must never depend on analytics.
 */

const VIEWS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

const noContent = () => new NextResponse(null, { status: 204 });

type Ctx = { params: Promise<{ shopId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { shopId } = await ctx.params;

  if (!z.string().uuid().safeParse(shopId).success) return noContent();

  const { success } = rateLimit(`shop-view:${getClientIp(request)}`, {
    limit: VIEWS_PER_MINUTE,
    windowMs: WINDOW_MS,
  });
  if (!success) return noContent();

  try {
    await trackShopPageView(shopId);
  } catch (error) {
    console.error("[api/shop-views] unexpected error", error);
  }

  return noContent();
}
