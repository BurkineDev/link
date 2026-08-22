import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BLOCK_TYPES,
  blockStyleSchema,
  parseBlockConfig,
  type BlockType,
} from "@/lib/blocks/types";

/**
 * Blocs d'une BioPage — création et réordonnancement.
 *
 * Toutes les écritures passent par le client utilisateur, jamais par le client
 * admin : la RLS de `page_blocks` (propriétaire de la boutique uniquement) est
 * la barrière d'autorisation. La vérification d'appartenance ci-dessous est
 * une défense en profondeur qui produit un 404 explicite plutôt qu'un échec
 * RLS silencieux.
 */

const createSchema = z.object({
  shop_id: z.string().uuid(),
  type: z.enum(BLOCK_TYPES),
  title: z.string().trim().max(120).nullish(),
  config: z.unknown().default({}),
  style: z.unknown().default({}),
  visible: z.boolean().default(true),
});

const reorderSchema = z.object({
  shop_id: z.string().uuid(),
  block_ids: z.array(z.string().uuid()).min(1).max(200),
});

/** Le vendeur ne peut écrire que sur sa propre boutique. */
async function assertShopOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();
  return !!data;
}

// GET /api/blocks?shopId=… — liste complète, blocs masqués inclus (éditeur).
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId || !z.string().uuid().safeParse(shopId).success) {
    return NextResponse.json({ error: "shopId invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!(await assertShopOwnership(supabase, shopId, user.id))) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("page_blocks")
    .select("*")
    .eq("shop_id", shopId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[api/blocks GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ blocks: data });
}

// POST /api/blocks — ajoute un bloc à la fin de la page.
export async function POST(request: NextRequest) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { shop_id, type, title, config, style, visible } = parsed.data;

  if (!(await assertShopOwnership(supabase, shop_id, user.id))) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  // La config est validée contre le schéma du type : c'est ici qu'une URL
  // javascript: ou un champ manquant est rejeté, avant d'atteindre la base.
  const parsedConfig = parseBlockConfig(type as BlockType, config);
  if (parsedConfig === null) {
    return NextResponse.json(
      { error: "Configuration de bloc invalide pour ce type." },
      { status: 422 },
    );
  }

  const parsedStyle = blockStyleSchema.safeParse(style ?? {});
  if (!parsedStyle.success) {
    return NextResponse.json({ error: "Style invalide" }, { status: 422 });
  }

  // Nouveau bloc en fin de page : c'est ce que le vendeur attend après avoir
  // cliqué « Ajouter », et ça évite de renuméroter les blocs existants.
  const { data: last } = await supabase
    .from("page_blocks")
    .select("position")
    .eq("shop_id", shop_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("page_blocks")
    .insert({
      shop_id,
      type,
      title: title ?? null,
      config: parsedConfig as never,
      style: parsedStyle.data as never,
      visible,
      position: (last?.position ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/blocks POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ block: data }, { status: 201 });
}

// PATCH /api/blocks — réordonne toute la page en une transaction.
export async function PATCH(request: NextRequest) {
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

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }

  if (!(await assertShopOwnership(supabase, parsed.data.shop_id, user.id))) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  const { error } = await supabase.rpc("reorder_page_blocks", {
    p_shop_id: parsed.data.shop_id,
    p_block_ids: parsed.data.block_ids,
  });

  if (error) {
    console.error("[api/blocks PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
