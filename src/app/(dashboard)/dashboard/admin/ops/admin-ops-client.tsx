"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, CheckCircle2, Clock, Database, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { SEVERITY_LABELS, type OpsSeverity } from "@/lib/ops/alert";
import type { HealthSnapshot } from "@/lib/ops/health";
import { describeTikTokLinkProbe, readTikTokStatus, type TikTokLinkProbe } from "@/lib/ops/tiktok-link";
import { cn } from "@/lib/utils";

export interface OpsEventView {
  id: string;
  kind: string;
  severity: OpsSeverity;
  title: string;
  detail: string | null;
  context: Record<string, unknown> | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  notified_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

const SEVERITY_CLASS: Record<OpsSeverity, string> = {
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-0",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-0",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function HealthLine({
  ok,
  icon: Icon,
  label,
  value,
}: {
  ok: boolean | null;
  icon: typeof Database;
  label: string;
  value: string;
}) {
  const Mark = ok === null ? Clock : ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground break-words">{value}</p>
      </div>
      <Mark
        className={cn(
          "size-5 shrink-0",
          ok === null ? "text-muted-foreground" : ok ? "text-emerald-600" : "text-rose-600",
        )}
        aria-label={ok === null ? "inconnu" : ok ? "ok" : "problème"}
      />
    </div>
  );
}

function ContextTable({ context }: { context: Record<string, unknown> | null }) {
  if (!context) return null;
  const rows = Object.entries(context).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="break-all font-mono">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminOpsClient({
  health,
  open,
  openTotal,
  recent,
  traces,
  journalError,
  lastRun,
}: {
  health: HealthSnapshot;
  open: OpsEventView[];
  /** Total des alertes ouvertes (la liste est bornée). */
  openTotal: number;
  recent: OpsEventView[];
  /** Traces (info) récentes : reversements demandés, etc. */
  traces: OpsEventView[];
  /** La base n'a pas répondu : les listes sont vides pour cette raison. */
  journalError: string | null;
  lastRun: { at: string; context: Record<string, unknown> | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function acknowledge(event: OpsEventView) {
    setBusy(event.id);
    try {
      const res = await fetch(`/api/admin/ops/${event.id}/ack`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Impossible de marquer l'alerte traitée.");
        return;
      }
      toast.success("Alerte marquée traitée.");
      router.refresh();
    } catch {
      toast.error("Connexion perdue. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  const critical = open.filter((e) => e.severity === "critical");
  const others = open.filter((e) => e.severity !== "critical");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Santé de la plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui a cassé en silence, et l&apos;état du service. Les alertes critiques t&apos;arrivent
          aussi par e-mail ; le rapport quotidien part à la fin du cron de 3 h.
        </p>
      </div>

      {/* Santé */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            État du service
            <Badge className={health.ok ? SEVERITY_CLASS.info : SEVERITY_CLASS.critical}>
              {health.ok ? "OK" : "Problème"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Vérifié le {formatDateTime(health.checkedAt)}
            {health.version ? ` · version ${health.version}` : ""}. La même réponse est servie par{" "}
            <code>/api/health</code> (200 ou 503) pour un moniteur externe.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <HealthLine
            ok={health.database.ok}
            icon={Database}
            label="Base de données"
            value={health.database.ok ? `Répond en ${health.database.latencyMs} ms` : health.database.error ?? "Injoignable"}
          />
          <HealthLine
            ok={health.migrations.embedded === null ? null : health.migrations.ok}
            icon={Database}
            label="Migrations"
            value={
              health.migrations.embedded === null
                ? "Liste non embarquée dans ce build"
                : health.migrations.ok
                  ? `À jour (${health.migrations.embedded}, dernière : ${health.migrations.latest})`
                  : `En retard : ${health.migrations.pending.join(", ")}`
            }
          />
          <HealthLine
            ok={health.cron.stale ? false : health.cron.lastRunAt === null ? null : true}
            icon={Clock}
            label="Cron quotidien"
            value={
              health.cron.lastRunAt
                ? `Dernier passage le ${formatDateTime(health.cron.lastRunAt)}${health.cron.stale ? " — en retard (plus de 26 h)" : ""}`
                : health.cron.stale
                  ? "Jamais exécuté, et le journal existe depuis plus de 26 h : vérifie le cron sur Vercel"
                  : "Jamais exécuté depuis l'installation du journal (premier passage attendu à 3 h UTC)"
            }
          />
          <HealthLine
            ok={health.email.configured && !health.email.dead}
            icon={Mail}
            label="E-mail (Resend)"
            value={
              !health.email.configured
                ? "RESEND_API_KEY ou EMAIL_FROM manquant"
                : health.email.dead
                  ? "Resend a refusé un envoi dans les dernières 26 h (voir l'alerte)"
                  : "Configuré"
            }
          />
        </CardContent>
      </Card>

      {journalError && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          Le journal n&apos;a pas pu être lu ({journalError}) : les listes ci-dessous sont vides pour
          cette raison, pas parce que tout va bien.
        </p>
      )}

      {/* Alertes ouvertes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Alertes à traiter{" "}
            <span className="text-muted-foreground">
              ({openTotal}{openTotal > open.length ? `, ${open.length} affichées` : ""})
            </span>
          </CardTitle>
          <CardDescription>
            Une alerte marquée traitée ne revient que si le problème se reproduit. Même problème
            répété : la ligne compte les occurrences au lieu de se dupliquer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Rien à traiter.
            </p>
          )}
          {[...critical, ...others].map((event) => (
            <article key={event.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={SEVERITY_CLASS[event.severity]}>{SEVERITY_LABELS[event.severity]}</Badge>
                    <code className="text-xs text-muted-foreground">{event.kind}</code>
                    {event.occurrences > 1 && (
                      <Badge variant="secondary">×{event.occurrences}</Badge>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{event.title}</p>
                  {event.detail && <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vu la première fois le {formatDateTime(event.first_seen_at)}
                    {event.occurrences > 1 ? `, la dernière le ${formatDateTime(event.last_seen_at)}` : ""}
                    {event.notified_at ? ` · e-mail envoyé le ${formatDateTime(event.notified_at)}` : ""}
                  </p>
                  <ContextTable context={event.context} />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === event.id}
                  onClick={() => void acknowledge(event)}
                >
                  {busy === event.id ? "…" : "Marquer traitée"}
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      {/* Dernier passage du cron */}
      <Card>
        <CardHeader>
          <CardTitle>Dernier passage du cron</CardTitle>
          <CardDescription>
            Expiration des commandes WhatsApp, réconciliation Mobile Money, relance des reversements,
            sonde du lien TikTok, puis rapport quotidien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lastRun ? (
            <>
              <p className="text-sm">Le {formatDateTime(lastRun.at)}</p>
              {/* La sonde TikTok en clair : le statut brut reste dans le tableau. */}
              {readTikTokStatus(lastRun.context) ? (
                <p className="mt-1 text-sm">
                  {describeTikTokLinkProbe(lastRun.context?.tiktok as TikTokLinkProbe)}
                </p>
              ) : null}
              <ContextTable context={lastRun.context} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun passage enregistré pour l&apos;instant.</p>
          )}
        </CardContent>
      </Card>

      {/* Traces */}
      {traces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Traces récentes</CardTitle>
            <CardDescription>Informations sans action attendue (reversements demandés, etc.).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {traces.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2 py-2">
                  <code className="text-xs text-muted-foreground">{event.kind}</code>
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(event.last_seen_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Historique */}
      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Traitées récemment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {recent.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge className={SEVERITY_CLASS[event.severity]}>{SEVERITY_LABELS[event.severity]}</Badge>
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {event.acknowledged_at ? formatDate(event.acknowledged_at) : ""}
                    {event.acknowledged_by ? ` · ${event.acknowledged_by}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
