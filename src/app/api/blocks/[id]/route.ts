import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  blockStyleSchema,
  isBlockType,
  parseBlockConfig,
  type BlockType,
} from "@/lib/blocks/types";
import type { PageBlockUpdate } from "@/lib/types/database";

/**
 * Un bloc : modification, duplication, suppression.
 *
 * Comme la route collection, tout passe par le client utilisateur — la RLS de
 * `page_blocks` est l'autorisation, la lecture préalable ci-dessous sert à
 * répondre 404 proprement et à connaître le type réel du bloc avant de valider
 * sa config (le type n'est pas modifiable après création : changer le type
 * d'un bloc reviendrait à en créer un autre, avec une config incompatible).
 */

const updateSchema = z.object({
  title: z.string().trim().max(120).nullish(),
  config: z.unknown().optional(),
  style: z.unknown().optional(),
  visible: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function loadOwnedBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockId: string,
  userId: string,
) {
  const { data: block } = await supabase
    .from("page_blocks")
    .select("id, shop_id, type, position, config, style, title, visible")
    .eq("id", blockId)
    .maybeSingle();
  if (!block) return null;

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", block.shop_id)
    .eq("owner_id", userId)
    .maybeSingle();

  return shop ? block : null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }

  const block = await loadOwnedBlock(supabase, id, user.id);
  if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });
  if (!isBlockType(block.type)) {
    return NextResponse.json({ error: "Type de bloc inconnu" }, { status: 422 });
  }

  const patch: PageBlockUpdate = {};

  if (parsed.data.config !== undefined) {
    const config = parseBlockConfig(block.type as BlockType, parsed.data.config);
    if (config === null) {
      return NextResponse.json(
        { error: "Configuration de bloc invalide pour ce type." },
        { status: 422 },
      );
    }
    patch.config = config as never;
  }

  if (parsed.data.style !== undefined) {
    const style = blockStyleSchema.safeParse(parsed.data.style ?? {});
    if (!style.success) {
      return NextResponse.json({ error: "Style invalide" }, { status: 422 });
    }
    patch.style = style.data as never;
  }

  if (parsed.data.title !== undefined) patch.title = parsed.data.title ?? null;
  if (parsed.data.visible !== undefined) patch.visible = parsed.data.visible;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("page_blocks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[api/blocks PATCH id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ block: data });
}

// POST /api/blocks/{id} — duplique le bloc juste après l'original.
export async function POST(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const block = await loadOwnedBlock(supabase, id, user.id);
  if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });

  // Le doublon se pose en fin de page : insérer « juste après » imposerait de
  // décaler toutes les positions suivantes, et le vendeur peut le déplacer
  // d'un geste. Simple et sans état intermédiaire incohérent.
  const { data: last } = await supabase
    .from("page_blocks")
    .select("position")
    .eq("shop_id", block.shop_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("page_blocks")
    .insert({
      shop_id: block.shop_id,
      type: block.type,
      title: block.title,
      config: block.config,
      style: block.style,
      visible: block.visible,
      position: (last?.position ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/blocks POST duplicate]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ block: data }, { status: 201 });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const block = await loadOwnedBlock(supabase, id, user.id);
  if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });

  const { error } = await supabase.from("page_blocks").delete().eq("id", id);
  if (error) {
    console.error("[api/blocks DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
