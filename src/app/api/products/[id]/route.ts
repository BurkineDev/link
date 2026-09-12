import { revalidateShop } from "@/lib/shops/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/db/serialize";
import { updateProductSchema } from "@/lib/validations/product";
import { Prisma } from "../../../../../prisma/generated/client/client";

/**
 * /api/products/[id] — modification et suppression d'un produit du vendeur.
 *
 * Le tableau de bord modifiait et supprimait les produits directement depuis
 * le navigateur avec le client Supabase, la RLS faisant office de contrôle
 * d'accès. Sans RLS, ces écritures passent par ici, et c'est le `where` sur
 * le propriétaire de la boutique qui tient lieu de barrière.
 *
 * PATCH accepte le même corps que la création (tous les champs optionnels).
 * Les variantes fournies avec un `id` sont mises à jour, les autres créées ;
 * comme avant, aucune n'est supprimée — c'est la sémantique du formulaire.
 */

/** Le produit s'il appartient à une boutique de l'utilisateur, sinon null. */
async function findOwnedProduct(productId: string, userId: string) {
  return prisma.product.findFirst({
    where: { id: productId, shop: { ownerId: userId } },
    select: { id: true, shopId: true },
  });
}

// PATCH /api/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { variants, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0 && !variants) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  }

  try {
    const owned = await findOwnedProduct(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(fields.name !== undefined ? { name: fields.name } : {}),
          ...(fields.slug !== undefined ? { slug: fields.slug } : {}),
          ...(fields.description !== undefined
            ? { description: fields.description ?? null }
            : {}),
          ...(fields.price !== undefined ? { price: fields.price } : {}),
          ...(fields.compare_price !== undefined
            ? { comparePrice: fields.compare_price ?? null }
            : {}),
          ...(fields.currency !== undefined ? { currency: fields.currency } : {}),
          ...(fields.images !== undefined
            ? { images: fields.images as Prisma.InputJsonValue }
            : {}),
          ...(fields.category_id !== undefined
            ? { categoryId: fields.category_id ?? null }
            : {}),
          ...(fields.is_published !== undefined
            ? { isPublished: fields.is_published }
            : {}),
          ...(fields.is_digital !== undefined ? { isDigital: fields.is_digital } : {}),
          ...(fields.stock_quantity !== undefined
            ? { stockQuantity: fields.stock_quantity }
            : {}),
          ...(fields.has_variants !== undefined
            ? { hasVariants: fields.has_variants }
            : {}),
          ...(fields.metadata !== undefined
            ? {
                metadata:
                  fields.metadata === null || fields.metadata === undefined
                    ? Prisma.DbNull
                    : (fields.metadata as Prisma.InputJsonValue),
              }
            : {}),
        },
      });

      for (const variant of variants ?? []) {
        const data = {
          name: variant.name,
          options: variant.options as Prisma.InputJsonValue,
          price: variant.price,
          stockQuantity: variant.stock_quantity ?? null,
          sku: variant.sku ?? null,
        };
        if (variant.id) {
          // `updateMany` avec le produit dans le `where` : une variante d'un
          // autre produit ne peut pas être écrasée en devinant son id.
          await tx.productVariant.updateMany({
            where: { id: variant.id, productId: id },
            data,
          });
        } else {
          await tx.productVariant.create({
            data: { ...data, productId: id, comparePrice: null },
          });
        }
      }

      return updated;
    });

    await revalidateShop(owned.shopId);
    return NextResponse.json({ product: serializeProduct(product) });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Un produit avec ce slug existe déjà" },
        { status: 409 },
      );
    }
    console.error("[api/products/[id] PATCH] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const owned = await findOwnedProduct(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    // Les variantes partent en cascade (schéma) ; les lignes de commande qui
    // référencent ce produit gardent leur instantané et passent à NULL.
    await prisma.product.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[api/products/[id] DELETE] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
