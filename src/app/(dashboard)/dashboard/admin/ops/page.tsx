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

  const OPEN_LIMIT = 100;
  // La santé se calcule même quand la base ne répond pas ; les listes,
  // elles, sont vides dans ce cas — la page doit le dire, pas tomber en 500.
  const health = await getHealth({ fresh: true });
  let open: Awaited<ReturnType<typeof prisma.opsEvent.findMany>> = [];
  let openTotal = 0;
  let recent: typeof open = [];
  let traces: typeof open = [];
  let lastRun: (typeof open)[number] | null = null;
  let journalError: string | null = null;
  try {
    [open, openTotal, recent, traces, lastRun] = await Promise.all([
      prisma.opsEvent.findMany({
        where: { acknowledgedAt: null, severity: { in: ["critical", "warning"] } },
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
        take: OPEN_LIMIT,
      }),
      prisma.opsEvent.count({ where: { acknowledgedAt: null, severity: { in: ["critical", "warning"] } } }),
      prisma.opsEvent.findMany({
        where: { acknowledgedAt: { not: null } },
        orderBy: { acknowledgedAt: "desc" },
        take: 30,
      }),
      prisma.opsEvent.findMany({
        where: { severity: "info", kind: { not: "cron.run" } },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      }),
      prisma.opsEvent.findFirst({ where: { kind: "cron.run" }, orderBy: { createdAt: "desc" } }),
    ]);
  } catch (error) {
    journalError = error instanceof Error ? error.message.split("\n").find((l) => l.trim())?.slice(0, 160) ?? "erreur" : String(error);
  }

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
      openTotal={openTotal}
      recent={recent.map(view)}
      traces={traces.map(view)}
      journalError={journalError}
      lastRun={
        lastRun
          ? { at: lastRun.createdAt.toISOString(), context: (lastRun.context as Record<string, unknown> | null) ?? null }
          : null
      }
    />
  );
}
