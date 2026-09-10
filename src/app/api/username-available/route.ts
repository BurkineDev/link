import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/username-available?username=xxx → { available: boolean }
 *
 * Port de la fonction Postgres `username_available`. Public par construction :
 * une page d'inscription n'a besoin que d'un oui ou d'un non, et ne doit
 * surtout pas pouvoir lister les inscrits. Même règle qu'en SQL —
 * comparaison insensible à la casse, espaces parasites ignorés.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username") ?? "";
  const username = raw.trim();

  if (username.length === 0 || username.length > 64) {
    return NextResponse.json({ error: "username requis" }, { status: 400 });
  }

  try {
    const taken = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    return NextResponse.json({ available: taken === null });
  } catch (error) {
    console.error("[api/username-available] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
