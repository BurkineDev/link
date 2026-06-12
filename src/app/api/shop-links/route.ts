import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const linkSchema = z.object({
  shop_id: z.string().uuid(),
  label: z.string().trim().min(1).max(60),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (v) =>
        v.startsWith("http://") ||
        v.startsWith("https://") ||
        v.startsWith("mailto:") ||
        v.startsWith("tel:"),
      "URL invalide (http(s)://, mailto: ou tel:)",
    ),
  icon: z.string().trim().min(1).max(30).default("custom"),
  position: z.number().int().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

// GET /api/shop-links?shopId=xxx — list links for a shop (owner only).
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

  const { data: links, error } = await supabase
    .from("shop_links")
    .select("*")
    .eq("shop_id", shopId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/shop-links GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ links });
}

// POST /api/shop-links — create a link.
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
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("shop_links")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    console.error("[api/shop-links POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ link: data }, { status: 201 });
}
