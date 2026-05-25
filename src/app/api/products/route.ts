import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createProductSchema } from "@/lib/validations/product";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import type { ProductInsert, ProductVariantInsert } from "@/lib/types/database";

// GET /api/products?shopId=xxx — list products for a shop
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!shopId) {
    return NextResponse.json({ error: "shopId requis" }, { status: 400 });
  }

  // Verify ownership
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*), categories(id, name)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products });
}

// POST /api/products — create a product
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { shop_id?: string } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const shopId = body.shop_id;
  if (!shopId || typeof shopId !== "string") {
    return NextResponse.json({ error: "shop_id requis" }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Verify shop ownership
  const { data: shop } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("id", shopId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  // Enforce plan product limit (Free plan: 5 products max).
  const admin = getAdminClient();
  const { data: sub } = await admin
    .from("creator_subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = getEffectivePlan(sub);
  const limits = getPlanLimits(plan);

  if (Number.isFinite(limits.maxProducts)) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId);

    if ((count ?? 0) >= limits.maxProducts) {
      return NextResponse.json(
        {
          error: `Tu as atteint la limite de ${limits.maxProducts} produits du plan Gratuit. Passe en Pro pour des produits illimités.`,
          code: "PLAN_LIMIT_REACHED",
          plan,
          limit: limits.maxProducts,
        },
        { status: 402 },
      );
    }
  }

  const { variants, ...productData } = parsed.data;

  const productInsert: ProductInsert = {
    shop_id: shopId,
    name: productData.name,
    slug: productData.slug,
    description: productData.description ?? null,
    price: productData.price,
    compare_price: productData.compare_price ?? null,
    currency: productData.currency ?? shop.currency,
    images: productData.images ?? [],
    category_id: productData.category_id ?? null,
    is_published: productData.is_published ?? false,
    is_digital: productData.is_digital ?? false,
    stock_quantity: productData.stock_quantity ?? null,
    has_variants: productData.has_variants ?? false,
    metadata: productData.metadata ?? null,
  };

  const { data: product, error } = await supabase
    .from("products")
    .insert(productInsert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Un produit avec ce slug existe déjà" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert variants if any
  if (variants && variants.length > 0) {
    const variantsWithProductId: ProductVariantInsert[] = variants.map((v) => ({
      product_id: product.id,
      name: v.name,
      options: v.options ?? [],
      price: v.price,
      compare_price: null,
      stock_quantity: v.stock_quantity ?? null,
      sku: v.sku ?? null,
    }));

    const { error: variantError } = await supabase
      .from("product_variants")
      .insert(variantsWithProductId);

    if (variantError) {
      // Rollback product
      await supabase.from("products").delete().eq("id", product.id);
      return NextResponse.json({ error: variantError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ product }, { status: 201 });
}
