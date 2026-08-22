import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/blocks/{id}/click — compte un tap sur un bloc de BioPage.
 *
 * Jumeau public de /api/shop-links/{id}/click, pour les pages dont la
 * composition est passée aux blocs : même contrat, mêmes garde-fous.
 *   • la RPC est SECURITY DEFINER et ne sait faire qu'une chose, +1 sur le
 *     compteur d'un bloc visible d'une boutique publiée ;
 *   • un id inconnu est un no-op silencieux — impossible d'énumérer les blocs ;
 *   • une limite par IP empêche un seul client de gonfler un compteur.
 *
 * Répond toujours 204 : la navigation du visiteur ne doit jamais en dépendre.
 */

const CLICKS_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

const noContent = () => new NextResponse(null, { status: 204 });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!z.string().uuid().safeParse(id).success) return noContent();

  const { success } = rateLimit(`block-click:${getClientIp(request)}`, {
    limit: CLICKS_PER_MINUTE,
    windowMs: WINDOW_MS,
  });
  if (!success) return noContent();

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("track_page_block_click", {
      p_block_id: id,
    });
    if (error) console.error("[api/blocks click] rpc error", error);
  } catch (error) {
    console.error("[api/blocks click] unexpected error", error);
  }

  return noContent();
}
