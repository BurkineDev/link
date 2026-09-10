import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShop } from "@/lib/db/serialize";
import { createShopSchema } from "@/lib/validations/shop";
import { Prisma } from "../../../../prisma/generated/client/client";

// GET /api/shops — get authenticated user's shop(s)
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const rows = await prisma.shop.findMany({
      where: { ownerId: user.id },
      include: { template: true },
      orderBy: { createdAt: "desc" },
    });

    // `templates(*)` côté PostgREST : le gabarit joint sous cette clé.
    const shops = rows.map(({ template, ...shop }) => ({
      ...serializeShop(shop),
      templates: template,
    }));

    return NextResponse.json({ shops });
  } catch (error) {
    console.error("[api/shops GET] db error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/shops — create a new shop
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

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

  try {
    const shop = await prisma.shop.create({
      data: {
        ownerId: user.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        currency: parsed.data.currency,
        templateId: parsed.data.template_id ?? null,
        isPublished: false,
        themeColor: "#FF6B35",
      },
    });

    return NextResponse.json({ shop: serializeShop(shop) }, { status: 201 });
  } catch (error) {
    // P2002 = contrainte unique (slug), l'équivalent du 23505 de PostgREST.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409 });
    }
    console.error("[api/shops POST] insert error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
