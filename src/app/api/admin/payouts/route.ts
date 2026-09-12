import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { OPEN_PAYOUT_STATUSES } from "@/lib/payouts/config";
import { serializePayout } from "@/lib/payouts/serialize";

/** GET /api/admin/payouts?status=open|all — les demandes à traiter, toutes boutiques. */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Réservé à l'équipe" }, { status: 403 });

  const scope = new URL(request.url).searchParams.get("status") ?? "open";
  const payouts = await prisma.payout.findMany({
    where: scope === "all" ? {} : { status: { in: [...OPEN_PAYOUT_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      shop: {
        select: {
          name: true,
          slug: true,
          contactEmail: true,
          owner: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  return NextResponse.json({
    payouts: payouts.map((payout) => ({
      ...serializePayout(payout),
      shop: {
        name: payout.shop.name,
        slug: payout.shop.slug,
        email: payout.shop.contactEmail || payout.shop.owner.user.email,
      },
    })),
  });
}
