import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  url: z.string().trim().min(1).max(500).optional(),
  icon: z.string().trim().min(1).max(30).optional(),
  position: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirms the link exists and belongs to a shop owned by `userId`.
 * Defence-in-depth alongside the RLS owner policies on shop_links.
 */
async function assertLinkOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  linkId: string,
  userId: string,
): Promise<boolean> {
  const { data: link } = await supabase
    .from("shop_links")
    .select("shop_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) return false;

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", link.shop_id)
    .eq("owner_id", userId)
    .maybeSingle();
  return !!shop;
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

  if (!(await assertLinkOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("shop_links")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[api/shop-links PATCH] update error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  return NextResponse.json({ link: data });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!(await assertLinkOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("shop_links").delete().eq("id", id);
  if (error) {
    console.error("[api/shop-links DELETE] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
