import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getHealth } from "@/lib/ops/health";
import { AdminOpsClient, type OpsEventView } from "./admin-ops-client";

export const metadata = { title: "Santé de la plateforme" };
export const dynamic = "force-dynamic";

/**
 * Écran de l'équipe : ce qui a cassé en silence, la santé du service, et le
 * dernier passage du cron. Chaque alerte se marque « traitée » d'un clic ;
 * une alerte traitée qui se reproduit rouvre une nouvelle ligne.
 */
export default async function AdminOpsPage() {
  await requireAdmin();

  const [health, open, recent, lastRun] = await Promise.all([
    getHealth(),
    prisma.opsEvent.findMany({
      where: { acknowledgedAt: null, kind: { not: "cron.run" } },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: 100,
    }),
    prisma.opsEvent.findMany({
      where: { acknowledgedAt: { not: null } },
      orderBy: { acknowledgedAt: "desc" },
      take: 30,
    }),
    prisma.opsEvent.findFirst({ where: { kind: "cron.run" }, orderBy: { createdAt: "desc" } }),
  ]);

  const view = (row: (typeof open)[number]): OpsEventView => ({
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    context: (row.context as Record<string, unknown> | null) ?? null,
    occurrences: row.occurrences,
    first_seen_at: row.firstSeenAt.toISOString(),
    last_seen_at: row.lastSeenAt.toISOString(),
    notified_at: row.notifiedAt?.toISOString() ?? null,
    acknowledged_at: row.acknowledgedAt?.toISOString() ?? null,
    acknowledged_by: row.acknowledgedBy,
  });

  return (
    <AdminOpsClient
      health={health}
      open={open.map(view)}
      recent={recent.map(view)}
      lastRun={
        lastRun
          ? { at: lastRun.createdAt.toISOString(), context: (lastRun.context as Record<string, unknown> | null) ?? null }
          : null
      }
    />
  );
}
