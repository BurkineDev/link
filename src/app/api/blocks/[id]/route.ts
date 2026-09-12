import { revalidateShop } from "@/lib/shops/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePageBlock } from "@/lib/db/serialize";
import {
  blockStyleSchema,
  isBlockType,
  parseBlockConfig,
  type BlockType,
} from "@/lib/blocks/types";
import type { Prisma } from "../../../../../prisma/generated/client/client";

/**
 * Un bloc : modification, duplication, suppression.
 *
 * La lecture préalable répond 404 proprement et donne le type réel du bloc
 * avant de valider sa config (le type n'est pas modifiable après création :
 * changer le type d'un bloc reviendrait à en créer un autre, avec une config
 * incompatible). Sans RLS, le `where` sur le propriétaire est l'autorisation.
 */

const updateSchema = z.object({
  title: z.string().trim().max(120).nullish(),
  config: z.unknown().optional(),
  style: z.unknown().optional(),
  visible: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function loadOwnedBlock(blockId: string, userId: string) {
  return prisma.pageBlock.findFirst({
    where: { id: blockId, shop: { ownerId: userId } },
    select: {
      id: true,
      shopId: true,
      type: true,
      position: true,
      config: true,
      style: true,
      title: true,
      visible: true,
    },
  });
}

async function nextPosition(shopId: string): Promise<number> {
  const last = await prisma.pageBlock.findFirst({
    where: { shopId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
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

  try {
    const block = await loadOwnedBlock(id, user.id);
    if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });
    if (!isBlockType(block.type)) {
      return NextResponse.json({ error: "Type de bloc inconnu" }, { status: 422 });
    }

    const patch: Prisma.PageBlockUpdateInput = {};

    if (parsed.data.config !== undefined) {
      const config = parseBlockConfig(block.type as BlockType, parsed.data.config);
      if (config === null) {
        return NextResponse.json(
          { error: "Configuration de bloc invalide pour ce type." },
          { status: 422 },
        );
      }
      patch.config = config as Prisma.InputJsonValue;
    }

    if (parsed.data.style !== undefined) {
      const style = blockStyleSchema.safeParse(parsed.data.style ?? {});
      if (!style.success) {
        return NextResponse.json({ error: "Style invalide" }, { status: 422 });
      }
      patch.style = style.data as Prisma.InputJsonValue;
    }

    if (parsed.data.title !== undefined) patch.title = parsed.data.title ?? null;
    if (parsed.data.visible !== undefined) patch.visible = parsed.data.visible;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.pageBlock.update({ where: { id }, data: patch });
    await revalidateShop(block.shopId);
    return NextResponse.json({ block: serializePageBlock(updated) });
  } catch (error) {
    console.error("[api/blocks PATCH id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/blocks/{id} — duplique le bloc en fin de page.
export async function POST(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const block = await loadOwnedBlock(id, user.id);
    if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });

    // Le doublon se pose en fin de page : insérer « juste après » imposerait
    // de décaler toutes les positions suivantes, et le vendeur peut le
    // déplacer d'un geste. Simple et sans état intermédiaire incohérent.
    const copy = await prisma.pageBlock.create({
      data: {
        shopId: block.shopId,
        type: block.type,
        title: block.title,
        config: block.config as Prisma.InputJsonValue,
        style: block.style as Prisma.InputJsonValue,
        visible: block.visible,
        position: await nextPosition(block.shopId),
      },
    });

    await revalidateShop(block.shopId);
    return NextResponse.json({ block: serializePageBlock(copy) }, { status: 201 });
  } catch (error) {
    console.error("[api/blocks POST duplicate]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const block = await loadOwnedBlock(id, user.id);
    if (!block) return NextResponse.json({ error: "Bloc introuvable" }, { status: 404 });

    await prisma.pageBlock.delete({ where: { id } });
    await revalidateShop(block.shopId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/blocks DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
