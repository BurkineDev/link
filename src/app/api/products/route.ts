import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/db/serialize";
import { createProductSchema } from "@/lib/validations/product";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import { Prisma } from "../../../../prisma/generated/client/client";

// GET /api/products?shopId=xxx — list products for a shop
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!shopId) {
    return NextResponse.json({ error: "shopId requis" }, { status: 400 });
  }

  try {
    // Verify ownership — l'ancienne requête filtrait sur owner_id, la RLS ne
    // faisait que doubler ce contrôle. Ici c'est la seule barrière : elle doit
    // rester dans le `where`, pas après coup.
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, ownerId: user.id },
      select: { id: true },
    });

    if (!shop) {
      return NextResponse.json(
        { error: "Boutique introuvable" },
        { status: 404 },
      );
    }

    const products = await prisma.product.findMany({
      where: { shopId },
      include: {
        variants: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products: products.map(serializeProduct) });
  } catch (error) {
    console.error("[api/products GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/products — create a product
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { shop_id?: string } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 },
    );
  }

  const shopId = body.shop_id;
  if (!shopId || typeof shopId !== "string") {
    return NextResponse.json({ error: "shop_id requis" }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Verify shop ownership
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, ownerId: user.id },
      select: { id: true, currency: true },
    });

    if (!shop) {
      return NextResponse.json(
        { error: "Boutique introuvable" },
        { status: 404 },
      );
    }

    // Enforce plan product limit (Free plan: 5 products max).
    const sub = await prisma.creatorSubscription.findUnique({
      where: { userId: user.id },
      select: {
        plan: true,
        status: true,
        provider: true,
        currentPeriodEnd: true,
      },
    });

    const plan = getEffectivePlan(
      sub
        ? {
            plan: sub.plan,
            status: sub.status,
            provider: sub.provider,
            current_period_end: dateOrNull(sub.currentPeriodEnd),
          }
        : null,
    );
    const limits = getPlanLimits(plan);

    if (Number.isFinite(limits.maxProducts)) {
      const count = await prisma.product.count({ where: { shopId } });

      if (count >= limits.maxProducts) {
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

    // Produit et variantes dans une seule transaction : l'ancienne version
    // insérait le produit puis les variantes, et supprimait le produit à la
    // main si les variantes échouaient. Ce rollback manuel pouvait lui-même
    // échouer et laisser un produit orphelin.
    const product = await prisma.product.create({
      data: {
        shopId,
        name: productData.name,
        slug: productData.slug,
        description: productData.description ?? null,
        price: productData.price,
        comparePrice: productData.compare_price ?? null,
        currency: productData.currency ?? shop.currency,
        images: productData.images ?? [],
        categoryId: productData.category_id ?? null,
        isPublished: productData.is_published ?? false,
        isDigital: productData.is_digital ?? false,
        stockQuantity: productData.stock_quantity ?? null,
        hasVariants: productData.has_variants ?? false,
        metadata: productData.metadata ?? Prisma.DbNull,
        ...(variants && variants.length > 0
          ? {
              variants: {
                create: variants.map((v) => ({
                  name: v.name,
                  options: v.options ?? [],
                  price: v.price,
                  comparePrice: null,
                  stockQuantity: v.stock_quantity ?? null,
                  sku: v.sku ?? null,
                })),
              },
            }
          : {}),
      },
    });

    return NextResponse.json(
      { product: serializeProduct(product) },
      { status: 201 },
    );
  } catch (error) {
    // P2002 = violation de contrainte unique, l'équivalent Prisma du 23505
    // que renvoyait PostgREST sur le couple (shop_id, slug).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Un produit avec ce slug existe déjà" },
        { status: 409 },
      );
    }

    console.error("[api/products POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

function dateOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
