import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { RESERVED_SLUGS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug || slug.length < 3) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }

  if (!/^[a-z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ available: false, reason: "invalid_chars" });
  }

  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  try {
    // L'adresse d'une page vaut aussi comme identifiant de profil (voir
    // src/lib/onboarding/simple.ts) : un pseudo déjà pris par quelqu'un
    // d'autre rendrait la création impossible au dernier moment.
    const user = await getCurrentUser();
    const [shop, profile] = await Promise.all([
      prisma.shop.findUnique({ where: { slug }, select: { id: true } }),
      prisma.profile.findUnique({ where: { username: slug }, select: { id: true } }),
    ]);
    const takenByOther = profile !== null && profile.id !== user?.id;
    return NextResponse.json({ available: shop === null && !takenByOther });
  } catch (error) {
    console.error("[api/shops/check-slug] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
