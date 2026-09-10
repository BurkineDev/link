import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const existing = await prisma.shop.findUnique({
      where: { slug },
      select: { id: true },
    });
    return NextResponse.json({ available: existing === null });
  } catch (error) {
    console.error("[api/shops/check-slug] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
