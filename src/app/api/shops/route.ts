import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShopSchema } from "@/lib/validations/shop";
import type { ShopInsert } from "@/lib/types/database";

// GET /api/shops — get authenticated user's shop(s)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: shops, error } = await supabase
    .from("shops")
    .select("*, templates(*)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/shops GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ shops });
}

// POST /api/shops — create a new shop
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = createShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const shopData: ShopInsert = {
    owner_id: user.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    currency: parsed.data.currency,
    template_id: parsed.data.template_id ?? null,
    is_published: false,
    theme_color: "#FF6B35",
    logo_url: null,
    banner_url: null,
    contact_email: null,
    contact_phone: null,
    social_links: null,
  };

  const { data: shop, error } = await supabase
    .from("shops")
    .insert(shopData)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409 });
    }
    console.error("[api/shops POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ shop }, { status: 201 });
}
