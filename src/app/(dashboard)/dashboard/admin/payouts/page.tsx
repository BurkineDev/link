import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { OPEN_PAYOUT_STATUSES } from "@/lib/payouts/config";
import { serializePayout } from "@/lib/payouts/serialize";
import { AdminPayoutsClient } from "./admin-payouts-client";

export const metadata = { title: "Reversements à traiter" };

/**
 * Écran de l'équipe : les demandes de reversement de toutes les boutiques,
 * avec la destination à copier dans Wave / Orange Money / la banque, puis
 * « Marquer versé » avec la référence du transfert.
 */
export default async function AdminPayoutsPage() {
  await requireAdmin();

  const rows = await prisma.payout.findMany({
    where: { status: { in: [...OPEN_PAYOUT_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      shop: {
        select: {
          name: true,
          slug: true,
          contactEmail: true,
          whatsappNumber: true,
          owner: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  const recent = await prisma.payout.findMany({
    where: { status: { in: ["paid", "failed"] } },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { shop: { select: { name: true, slug: true } } },
  });

  return (
    <AdminPayoutsClient
      open={rows.map((payout) => ({
        ...serializePayout(payout),
        shop: {
          name: payout.shop.name,
          slug: payout.shop.slug,
          email: payout.shop.contactEmail || payout.shop.owner.user.email,
          whatsapp: payout.shop.whatsappNumber,
        },
      }))}
      recent={recent.map((payout) => ({
        ...serializePayout(payout),
        shop: { name: payout.shop.name, slug: payout.shop.slug, email: "", whatsapp: null },
      }))}
    />
  );
}
