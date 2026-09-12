import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { trackPageBlockClick, trackShopLinkClick } from "@/lib/db/tracking";
import { scheduleAfterResponse } from "@/lib/after-response";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { decideGo, renderIosBridge } from "@/lib/links/go";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /go/{id} — voir src/lib/links/go.ts.
 *
 * `id` est l'identifiant d'un lien de BioPage (`shop_links`) ou d'un bloc
 * de type LIEN (`page_blocks`) d'une boutique publiée. Un id inconnu ou
 * masqué répond 404 : rien n'est énumérable.
 */

const CLICKS_PER_MINUTE = 60;
const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

type Target = { url: string; track: () => Promise<void> };

async function resolveTarget(id: string): Promise<Target | null> {
  const link = await prisma.shopLink.findFirst({
    where: { id, isActive: true, shop: { isPublished: true } },
    select: { url: true },
  });
  if (link) return { url: link.url, track: () => trackShopLinkClick(id) };

  const block = await prisma.pageBlock.findFirst({
    where: { id, type: "LINK", visible: true, shop: { isPublished: true } },
    select: { config: true },
  });
  const url = (block?.config as { url?: unknown } | null)?.url;
  if (typeof url === "string" && url.length > 0) {
    return { url, track: () => trackPageBlockClick(id) };
  }
  return null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ lien: string }> }) {
  const { lien } = await ctx.params;
  if (!z.string().uuid().safeParse(lien).success) {
    return new NextResponse("Lien introuvable", { status: 404, headers: NO_STORE });
  }

  const target = await resolveTarget(lien);
  if (!target) {
    return new NextResponse("Lien introuvable", { status: 404, headers: NO_STORE });
  }

  // Seuls http(s), mailto: et tel: sont acceptés à l'enregistrement ; on le
  // revérifie ici pour ne jamais rediriger vers javascript: ou data:.
  if (!/^(https?:|mailto:|tel:)/i.test(target.url)) {
    return new NextResponse("Lien introuvable", { status: 404, headers: NO_STORE });
  }

  const { success } = rateLimit(`go:${getClientIp(request)}`, {
    limit: CLICKS_PER_MINUTE,
    windowMs: 60_000,
  });
  if (success) {
    scheduleAfterResponse(target.track, (error) =>
      console.error("[go] click tracking failed", error),
    );
  }

  const decision = decideGo(target.url, request.headers.get("user-agent") ?? "");

  if (decision.kind === "ios-bridge") {
    return new NextResponse(renderIosBridge(decision), {
      status: 200,
      headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(null, {
    status: 302,
    headers: { ...NO_STORE, Location: decision.location },
  });
}
