import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS } from "@/lib/constants";
import { Prisma } from "../../../../prisma/generated/client/client";

/**
 * POST /api/onboarding — termine l'onboarding d'un vendeur.
 *
 * La page d'onboarding écrivait quatre fois de suite depuis le navigateur :
 * le profil, la boutique, les blocs de la première page, puis le drapeau
 * `onboarding_completed`. Une coupure entre deux écritures laissait un
 * vendeur avec une boutique mais sans onboarding terminé — donc renvoyé
 * dessus en boucle. Ici tout passe en une transaction : soit tout existe,
 * soit rien.
 */

const CURRENCIES = ["XOF", "XAF", "GHS", "NGN", "KES", "MAD", "USD"] as const;

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/),
  shop: z.object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9_-]+$/),
    description: z.string().trim().max(500).nullable().optional(),
    currency: z.enum(CURRENCIES),
    checkoutMode: z.string().min(1).max(30),
    whatsappNumber: z.string().max(20).nullable().optional(),
    bioTheme: z.string().min(1).max(50),
    intentions: z.array(z.string().max(50)).max(20).default([]),
  }),
  blocks: z
    .array(
      z.object({
        type: z.string().min(1).max(50),
        position: z.number().int().min(0),
        title: z.string().max(200).nullable().optional(),
        config: z.unknown().optional(),
      }),
    )
    .max(50)
    .default([]),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { fullName, username, shop, blocks } = parsed.data;

  if ((RESERVED_SLUGS as readonly string[]).includes(shop.slug)) {
    return NextResponse.json(
      { error: "Cette adresse de boutique est réservée." },
      { status: 409 },
    );
  }

  try {
    const shopId = await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: user.id },
        data: { fullName, username },
      });

      const created = await tx.shop.create({
        data: {
          ownerId: user.id,
          name: shop.name,
          slug: shop.slug,
          description: shop.description ?? null,
          currency: shop.currency,
          bioTheme: shop.bioTheme,
          checkoutMode: shop.checkoutMode,
          whatsappNumber: shop.whatsappNumber ?? null,
          intentions: shop.intentions,
          isPublished: false,
        },
        select: { id: true },
      });

      if (blocks.length > 0) {
        await tx.pageBlock.createMany({
          data: blocks.map((block) => ({
            shopId: created.id,
            type: block.type,
            position: block.position,
            title: block.title ?? null,
            config: (block.config ?? {}) as Prisma.InputJsonValue,
          })),
        });
      }

      await tx.profile.update({
        where: { id: user.id },
        data: { onboardingCompleted: true },
      });

      return created.id;
    });

    return NextResponse.json({ shopId }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce pseudo ou cette adresse de boutique est déjà pris(e)." },
        { status: 409 },
      );
    }
    console.error("[api/onboarding] error", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
