import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingGeniusPayOrders } from "@/lib/orders/reconcile";
import { expireStaleManualOrders } from "@/lib/orders/expire-manual";
import { remindStalePayouts } from "@/lib/payouts/notifications";
import { recordOpsEvent } from "@/lib/ops/events";
import { sendDailyDigest } from "@/lib/ops/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Jusqu'à 50 appels Genius Pay séquentiels, puis les envois : la durée par
// défaut de la plateforme ne suffit pas à coup sûr.
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// GET /api/cron/reconcile-orders
//
// Filet de sécurité : rattrape les commandes Mobile Money qu'aucun webhook n'a
// fait aboutir, toutes boutiques confondues. Les deux autres déclencheurs (la
// page de retour de l'acheteur et le tableau de bord du vendeur) couvrent le
// cas courant ; celui-ci existe pour les commandes que plus personne ne
// regarde, et notamment pour libérer le stock des paniers abandonnés.
//
// Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. Sans ce secret en
// variable d'environnement, la route refuse tout le monde : un endpoint qui
// écrit sur les commandes ne peut pas rester ouvert.
// ---------------------------------------------------------------------------

const BATCH_LIMIT = 50;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron] CRON_SECRET manquant — réconciliation désactivée");
    await recordOpsEvent({
      kind: "cron.not_configured",
      severity: "critical",
      title: "Cron quotidien désactivé : CRON_SECRET absent",
      detail: "Sans CRON_SECRET sur Vercel, la réconciliation Mobile Money, l'expiration des commandes hors ligne et la relance des reversements ne tournent plus.",
      dedupeKey: "cron.not_configured",
    });
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // Secret tourné sur Vercel sans redéploiement, ou simple curiosité :
    // une trace (sans e-mail), visible au rapport du matin.
    await recordOpsEvent({
      kind: "cron.unauthorized",
      severity: "warning",
      title: "Appel du cron refusé (secret différent)",
      detail: "Si Vercel Cron lui-même est refusé, le secret a été changé sans redéploiement : le passage quotidien ne tourne plus.",
      dedupeKey: "cron.unauthorized",
    });
    return new NextResponse(null, { status: 401 });
  }

  const startedAt = new Date();
  const result = await reconcilePendingGeniusPayOrders({ limit: BATCH_LIMIT });
  console.info("[cron] réconciliation:", result);

  // Même passage quotidien : relance des reversements que l'équipe n'a pas
  // encore traités (le plan Vercel n'autorise qu'un cron par jour).
  const payouts = await remindStalePayouts().catch((error) => {
    console.error("[cron] relance des reversements:", error);
    return { stale: -1, reminded: 0 };
  });
  console.info("[cron] reversements en attente:", payouts);

  // Et les commandes hors ligne (WhatsApp, livraison) que personne n'a
  // confirmées en sept jours.
  const expired = await expireStaleManualOrders().catch((error) => {
    console.error("[cron] expiration des commandes hors ligne:", error);
    return { expired: -1, errors: 1 };
  });
  console.info("[cron] commandes hors ligne expirées:", expired);

  // Une étape qui a levé n'est pas un passage réussi : le JSON portait une
  // sentinelle -1 que personne ne lisait, et Vercel affichait « succès ».
  const stepFailures = [
    payouts.stale === -1 ? "relance des reversements" : null,
    expired.expired === -1 ? "expiration des commandes hors ligne" : null,
  ].filter(Boolean) as string[];
  if (stepFailures.length > 0) {
    await recordOpsEvent({
      kind: "cron.step_failed",
      severity: "critical",
      title: `Cron quotidien : ${stepFailures.join(" et ")} en échec`,
      detail: "L'étape a levé une exception (voir les journaux Vercel). Le reste du passage a continué.",
      context: { steps: stepFailures, reconcile: result, payouts, manual_orders: expired },
      dedupeKey: "cron.step_failed",
    });
  }

  // Battement de cœur : la ligne que /api/health et l'écran Santé lisent.
  const summary = { reconcile: result, payouts, manualOrders: expired };
  await recordOpsEvent({
    kind: "cron.run",
    severity: "info",
    title: `Passage quotidien du ${startedAt.toISOString().slice(0, 10)}`,
    context: { ...summary, durationMs: Date.now() - startedAt.getTime() },
    dedupeKey: `cron.run:${startedAt.toISOString()}`,
  });

  // Le rapport du matin, dernier acte du passage.
  const digest = await sendDailyDigest({ cron: summary });
  console.info("[cron] rapport quotidien:", digest);

  return NextResponse.json(
    { ...result, payouts, manual_orders: expired, digest, ok: stepFailures.length === 0 },
    { status: stepFailures.length === 0 ? 200 : 500 },
  );
}
