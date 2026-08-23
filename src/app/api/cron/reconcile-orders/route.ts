import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingGeniusPayOrders } from "@/lib/orders/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await reconcilePendingGeniusPayOrders({ limit: BATCH_LIMIT });

  console.info("[cron] réconciliation:", result);
  return NextResponse.json(result);
}
