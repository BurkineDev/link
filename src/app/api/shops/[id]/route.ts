import { isValidE164 } from "@/lib/phone/dial-codes";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeShop } from "@/lib/db/serialize";
import { RESERVED_SLUGS } from "@/lib/constants";
import { Prisma } from "../../../../../prisma/generated/client/client";

/**
 * /api/shops/[id] — modifications et suppression d'une boutique.
 *
 * Le tableau de bord écrivait dans `shops` directement depuis le navigateur,
 * la RLS garantissant qu'un vendeur ne touchait qu'à la sienne. Sans RLS,
 * tout passe par ici : le corps est en snake_case (ce que les composants
 * envoient déjà), la liste des champs est fermée, et le `where` sur le
 * propriétaire est la barrière.
 */

const CURRENCIES = ["XOF", "XAF", "GHS", "NGN", "KES", "MAD", "USD"] as const;
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9_-]+$/).optional(),
    description: nullableText(500),
    logo_url: nullableText(2048),
    banner_url: nullableText(2048),
    template_id: nullableText(100),
    is_published: z.boolean().optional(),
    theme_color: z.string().trim().max(20).optional(),
    accent_color: z.string().trim().max(20).optional(),
    font_family: z.string().trim().max(50).optional(),
    border_radius: z.string().trim().max(20).optional(),
    card_style: z.string().trim().max(20).optional(),
    cta_shape: z.string().trim().max(20).optional(),
    cta_style: z.string().trim().max(20).optional(),
    bio_theme: z.string().trim().max(50).optional(),
    currency: z.enum(CURRENCIES).optional(),
    contact_email: nullableText(254),
    contact_phone: nullableText(30),
    social_links: z.unknown().optional(),
    tiktok_pixel_id: nullableText(100),
    meta_pixel_id: nullableText(100),
    whatsapp_number: nullableText(30).refine((v) => !v || isValidE164(v), {
      message: "Numéro WhatsApp incomplet : indicatif du pays requis.",
    }),
    checkout_mode: z.string().trim().max(30).optional(),
    intentions: z.array(z.string().max(50)).max(20).optional(),
    show_biolien_badge: z.boolean().optional(),
    shipping_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Aucun champ à modifier",
  });

type PatchBody = z.infer<typeof patchSchema>;

/** snake_case (API) → camelCase (Prisma), champ par champ, sans surprise. */
function toPrismaData(body: PatchBody): Prisma.ShopUpdateInput {
  const data: Prisma.ShopUpdateInput = {};
  const set = <K extends keyof Prisma.ShopUpdateInput>(
    key: K,
    value: Prisma.ShopUpdateInput[K] | undefined,
  ) => {
    if (value !== undefined) data[key] = value;
  };
  set("name", body.name);
  set("slug", body.slug);
  set("description", body.description);
  set("logoUrl", body.logo_url);
  set("bannerUrl", body.banner_url);
  set("isPublished", body.is_published);
  set("themeColor", body.theme_color);
  set("accentColor", body.accent_color);
  set("fontFamily", body.font_family);
  set("borderRadius", body.border_radius);
  set("cardStyle", body.card_style);
  set("ctaShape", body.cta_shape);
  set("ctaStyle", body.cta_style);
  set("bioTheme", body.bio_theme);
  set("currency", body.currency);
  set("contactEmail", body.contact_email);
  set("contactPhone", body.contact_phone);
  set("tiktokPixelId", body.tiktok_pixel_id);
  set("metaPixelId", body.meta_pixel_id);
  set("whatsappNumber", body.whatsapp_number);
  set("checkoutMode", body.checkout_mode);
  set("intentions", body.intentions);
  set("showBioLienBadge", body.show_biolien_badge);
  set("shippingEnabled", body.shipping_enabled);
  if (body.template_id !== undefined) {
    data.template = body.template_id
      ? { connect: { id: body.template_id } }
      : { disconnect: true };
  }
  if (body.social_links !== undefined) {
    data.socialLinks =
      body.social_links === null
        ? Prisma.DbNull
        : (body.social_links as Prisma.InputJsonValue);
  }
  return data;
}

async function findOwnedShop(shopId: string, userId: string) {
  return prisma.shop.findFirst({
    where: { id: shopId, ownerId: userId },
    select: { id: true, slug: true },
  });
}

// PATCH /api/shops/[id]
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (parsed.data.slug && (RESERVED_SLUGS as readonly string[]).includes(parsed.data.slug)) {
    return NextResponse.json({ error: "Cette adresse est réservée." }, { status: 409 });
  }

  try {
    const owned = await findOwnedShop(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const shop = await prisma.shop.update({
      where: { id },
      data: toPrismaData(parsed.data),
    });

    // Ancien ET nouveau slug : en cas de renommage, l'ancienne adresse doit
    // cesser de servir la page en cache.
    revalidateShopSlug(owned.slug, shop.slug);
    return NextResponse.json({ shop: serializeShop(shop) });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409 });
    }
    console.error("[api/shops/[id] PATCH] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/shops/[id]
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
    const owned = await findOwnedShop(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    // `orders` est en `onDelete: Restrict` : une boutique qui a vendu ne se
    // supprime pas — les commandes (et la comptabilité) doivent survivre.
    await prisma.shop.delete({ where: { id } });
    revalidateShopSlug(owned.slug);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Cette boutique a des commandes : elle ne peut pas être supprimée." },
        { status: 409 },
      );
    }
    console.error("[api/shops/[id] DELETE] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
