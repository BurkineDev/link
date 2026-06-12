import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  shop_id: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Format: lettres majuscules, chiffres, _ ou -"),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().positive(),
  min_order_amount: z.number().nonnegative().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
});

// GET /api/promo-codes?shopId=xxx
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId) return NextResponse.json({ error: "shopId requis" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const { data: codes, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/promo-codes GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ codes });
}

// POST /api/promo-codes
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

  if (
    parsed.data.discount_type === "percent" &&
    (parsed.data.discount_value <= 0 || parsed.data.discount_value > 100)
  ) {
    return NextResponse.json(
      { error: "Une remise en pourcentage doit être entre 1 et 100." },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce code existe déjà." }, { status: 409 });
    }
    console.error("[api/promo-codes POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ code: data }, { status: 201 });
}
