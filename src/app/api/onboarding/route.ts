import { isValidE164 } from "@/lib/phone/dial-codes";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS } from "@/lib/constants";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
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
 *
 * Caisse masquée (voir src/lib/payments/online-checkout.ts) : toute boutique
 * prend ses commandes sur WhatsApp. Le mode « online » est refusé et le
 * numéro WhatsApp est obligatoire — c'est là que les commandes arrivent.
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
    checkoutMode: z.enum(["whatsapp", "online"]),
    whatsappNumber: z
      .string()
      .max(20)
      .nullable()
      .optional()
      .refine((v) => !v || isValidE164(v), {
        message: "Numéro WhatsApp incomplet : indicatif du pays requis.",
      }),
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

  // Lu à chaque requête, jamais figé à l'import.
  if (!isOnlineCheckoutEnabled()) {
    if (shop.checkoutMode === "online") {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas disponible.", code: "ONLINE_CHECKOUT_DISABLED" },
        { status: 422 },
      );
    }
    if (!shop.whatsappNumber) {
      return NextResponse.json(
        { error: "Ton numéro WhatsApp est obligatoire : c'est là que les commandes arrivent.", code: "WHATSAPP_NUMBER_REQUIRED" },
        { status: 422 },
      );
    }
  }

  if ((RESERVED_SLUGS as readonly string[]).includes(shop.slug)) {
    return NextResponse.json(
      { error: "Cette adresse de boutique est réservée." },
      { status: 409 },
    );
  }

  // Un onboarding ne se termine qu'une fois : rejoué (double envoi, page
  // rechargée sur l'écran final), il créerait une seconde boutique. Une
  // boutique existante sans le drapeau (comptes de l'ancien flux en quatre
  // écritures) est réparée au passage : sinon le vendeur tournait entre
  // l'onboarding et le tableau de bord.
  const existing = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true, slug: true },
  });
  if (existing) {
    await prisma.profile.updateMany({
      where: { id: user.id, onboardingCompleted: false },
      data: { onboardingCompleted: true },
    });
    return NextResponse.json(
      { error: "Ta boutique existe déjà.", code: "ALREADY_ONBOARDED", shopId: existing.id, slug: existing.slug },
      { status: 409 },
    );
  }

  try {
    const shopId = await prisma.$transaction(async (tx) => {
      // Garde atomique : deux envois simultanés (tap répété, rechargement
      // pendant un démarrage à froid) se sérialisent sur la ligne du profil,
      // et le second voit le drapeau déjà posé.
      const claimed = await tx.profile.updateMany({
        where: { id: user.id, onboardingCompleted: false },
        data: { fullName, username, onboardingCompleted: true },
      });
      if (claimed.count === 0) throw new AlreadyOnboardedError();

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

      return created.id;
    });

    return NextResponse.json({ shopId }, { status: 201 });
  } catch (error) {
    if (error instanceof AlreadyOnboardedError) {
      const shop = await prisma.shop.findFirst({
        where: { ownerId: user.id },
        select: { id: true, slug: true },
      });
      return NextResponse.json(
        { error: "Ta boutique existe déjà.", code: "ALREADY_ONBOARDED", shopId: shop?.id ?? null, slug: shop?.slug ?? null },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Quel champ ? La page doit ramener le vendeur au bon écran — il n'a
      // peut-être jamais vu celui du pseudo.
      const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
      const usernameTaken = /username/i.test(target);
      return NextResponse.json(
        {
          error: usernameTaken
            ? "Ce pseudo est déjà pris."
            : "Cette adresse de boutique est déjà prise.",
          code: usernameTaken ? "USERNAME_TAKEN" : "SLUG_TAKEN",
        },
        { status: 409 },
      );
    }
    console.error("[api/onboarding] error", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

class AlreadyOnboardedError extends Error {
  constructor() {
    super("already onboarded");
  }
}
