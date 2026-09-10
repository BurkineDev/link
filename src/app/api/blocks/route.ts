import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePageBlock } from "@/lib/db/serialize";
import { reorderPageBlocks } from "@/lib/db/tracking";
import {
  BLOCK_TYPES,
  blockStyleSchema,
  parseBlockConfig,
  type BlockType,
} from "@/lib/blocks/types";
import type { Prisma } from "../../../../prisma/generated/client/client";

/**
 * Blocs d'une BioPage — création et réordonnancement.
 *
 * Sans RLS, la vérification d'appartenance ci-dessous n'est plus une défense
 * en profondeur : c'est l'autorisation. Elle précède chaque écriture.
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
async function ownsShop(shopId: string, userId: string): Promise<boolean> {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ownerId: userId },
    select: { id: true },
  });
  return shop !== null;
}

/** Nouveau bloc en fin de page : évite de renuméroter les blocs existants. */
async function nextPosition(shopId: string): Promise<number> {
  const last = await prisma.pageBlock.findFirst({
    where: { shopId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

// GET /api/blocks?shopId=… — liste complète, blocs masqués inclus (éditeur).
export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId");
  if (!shopId || !z.string().uuid().safeParse(shopId).success) {
    return NextResponse.json({ error: "shopId invalide" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    if (!(await ownsShop(shopId, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const blocks = await prisma.pageBlock.findMany({
      where: { shopId },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ blocks: blocks.map(serializePageBlock) });
  } catch (error) {
    console.error("[api/blocks GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/blocks — ajoute un bloc à la fin de la page.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
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

  try {
    if (!(await ownsShop(shop_id, user.id))) {
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

    const block = await prisma.pageBlock.create({
      data: {
        shopId: shop_id,
        type,
        title: title ?? null,
        config: parsedConfig as Prisma.InputJsonValue,
        style: parsedStyle.data as Prisma.InputJsonValue,
        visible,
        position: await nextPosition(shop_id),
      },
    });

    return NextResponse.json({ block: serializePageBlock(block) }, { status: 201 });
  } catch (error) {
    console.error("[api/blocks POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/blocks — réordonne toute la page en une transaction.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
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

  try {
    if (!(await ownsShop(parsed.data.shop_id, user.id))) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    await reorderPageBlocks(parsed.data.shop_id, parsed.data.block_ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/blocks PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
