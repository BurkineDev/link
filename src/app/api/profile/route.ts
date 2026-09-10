import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../prisma/generated/client/client";

/**
 * PATCH /api/profile — met à jour le profil de l'utilisateur connecté.
 * Corps en snake_case (forme historique du composant), champs fermés.
 */
const patchSchema = z
  .object({
    full_name: z.string().trim().max(100).nullable().optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_-]+$/)
      .nullable()
      .optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    avatar_url: z.string().trim().max(2048).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Aucun champ à modifier",
  });

export async function PATCH(request: NextRequest) {
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

  const { full_name, username, bio, avatar_url } = parsed.data;

  try {
    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        ...(full_name !== undefined ? { fullName: full_name } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar_url !== undefined ? { avatarUrl: avatar_url } : {}),
      },
    });

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
        bio: profile.bio,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce nom d'utilisateur est déjà pris." },
        { status: 409 },
      );
    }
    console.error("[api/profile PATCH] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
