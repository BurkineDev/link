import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { trackPageBlockClick, trackShopLinkClick } from "@/lib/db/tracking";
import { scheduleAfterResponse } from "@/lib/after-response";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import { decideGo, isCrawler, normalizeTargetUrl, renderIosBridge } from "@/lib/links/go";

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

type Target = { url: string; shopSlug: string; track: () => Promise<void> };

async function resolveTarget(id: string): Promise<Target | null> {
  const link = await prisma.shopLink.findFirst({
    where: { id, isActive: true, shop: { isPublished: true } },
    select: { url: true, shop: { select: { slug: true } } },
  });
  if (link) return { url: link.url, shopSlug: link.shop.slug, track: () => trackShopLinkClick(id) };

  const block = await prisma.pageBlock.findFirst({
    where: { id, type: "LINK", visible: true, shop: { isPublished: true } },
    select: { config: true, shop: { select: { slug: true } } },
  });
  const url = (block?.config as { url?: unknown } | null)?.url;
  if (block && typeof url === "string" && url.length > 0) {
    return { url, shopSlug: block.shop.slug, track: () => trackPageBlockClick(id) };
  }
  return null;
}

/**
 * Un clic ne se compte que pour une vraie navigation d'un vrai visiteur :
 * ni robot, ni aperçu de lien, ni requête HEAD, ni préchargement.
 */
function isCountableNavigation(request: NextRequest, userAgent: string): boolean {
  if (request.method !== "GET" || isCrawler(userAgent)) return false;
  const mode = request.headers.get("sec-fetch-mode");
  if (mode && mode !== "navigate") return false;
  const purpose = request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  return !/prefetch|preview/i.test(purpose);
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
  // revérifie ici pour ne jamais rediriger vers javascript: ou data:, et
  // l'URL est normalisée pour tenir dans un en-tête.
  const url = normalizeTargetUrl(target.url);
  if (!url) {
    return new NextResponse("Lien introuvable", { status: 404, headers: NO_STORE });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const decision = decideGo(url, userAgent, `/${target.shopSlug}`);

  let response: NextResponse;
  if (decision.kind === "ios-bridge") {
    const nonce = randomUUID().replace(/-/g, "");
    response = new NextResponse(renderIosBridge(decision, nonce), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'`,
      },
    });
  } else {
    response = new NextResponse(null, {
      status: 302,
      headers: { ...NO_STORE, Location: decision.location },
    });
  }

  // Compté seulement une fois la réponse construite : une URL qui ne tient
  // pas dans un en-tête ne compte pas, un robot non plus.
  if (isCountableNavigation(request, userAgent)) {
    const { success } = rateLimit(`go:${getClientIp(request)}`, {
      limit: CLICKS_PER_MINUTE,
      windowMs: 60_000,
    });
    if (success) {
      scheduleAfterResponse(target.track, (error) =>
        console.error("[go] click tracking failed", error),
      );
    }
  }

  return response;
}
