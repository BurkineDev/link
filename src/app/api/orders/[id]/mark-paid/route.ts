import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settlePaidOrder } from "@/lib/db/orders";
import { serializeOrder } from "@/lib/db/serialize";

/**
 * POST /api/orders/[id]/mark-paid — le vendeur a reçu l'argent hors
 * plateforme (commande WhatsApp payée en espèces ou par Mobile Money direct).
 * Même règlement que les webhooks — stock prélevé, fiche client si e-mail,
 * fichiers numériques — sans aucune ligne au registre : Bio-Lien n'a rien
 * encaissé, il n'y a rien à reverser.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, paymentProvider: true, paymentStatus: true, shop: { select: { ownerId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  if (order.shop.ownerId !== user.id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  if (order.paymentProvider !== "manual") {
    return NextResponse.json(
      { error: "Cette commande est réglée en ligne : son paiement est confirmé automatiquement." },
      { status: 409 },
    );
  }
  // Une commande annulée (par le vendeur, ou expirée) ne ressuscite pas :
  // si l'acheteur paie quand même, il repasse commande.
  if (order.status === "cancelled") {
    return NextResponse.json(
      { error: "Cette commande est annulée : elle ne peut plus être marquée payée." },
      { status: 409 },
    );
  }
  if (order.paymentStatus !== "pending") {
    return NextResponse.json({ error: "Cette commande est déjà réglée." }, { status: 409 });
  }

  const result = await settlePaidOrder(id, `manual:${user.id}:${Date.now()}`, "manual");
  if (!result.settled) {
    return NextResponse.json({ error: "Cette commande est déjà réglée." }, { status: 409 });
  }

  const updated = await prisma.order.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ order: serializeOrder(updated), stock_shortfall: result.stockShortfall });
}
