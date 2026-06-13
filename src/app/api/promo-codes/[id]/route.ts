import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  min_order_amount: z.number().nonnegative().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirms the promo code exists and belongs to a shop owned by `userId`.
 * Returns the matching shop id, or null if not found / not owned. RLS would
 * also block cross-tenant writes, but checking here keeps the API a second
 * line of defence instead of trusting RLS alone.
 */
async function assertPromoOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  promoId: string,
  userId: string,
): Promise<boolean> {
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("shop_id")
    .eq("id", promoId)
    .maybeSingle();
  if (!promo) return false;

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", promo.shop_id)
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
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 422 });

  if (!(await assertPromoOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[api/promo-codes PATCH] update error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
  return NextResponse.json({ code: data });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!(await assertPromoOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) {
    console.error("[api/promo-codes DELETE] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
