import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transitionOrderStatus } from "@/lib/db/orders";
import { serializeOrder } from "@/lib/db/serialize";
import { notifyBuyerOfCashOnDeliveryOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]),
  note: z.string().trim().max(500).nullable().optional(),
  public_message: z.string().trim().max(500).nullable().optional(),
});

const DEFAULT_PUBLIC_MESSAGES: Partial<Record<z.infer<typeof updateStatusSchema>["status"], string>> = {
  confirmed: "Paiement confirmé. La commande est transmise au vendeur.",
  processing: "La commande est en cours de préparation.",
  shipped: "La commande a été expédiée.",
  delivered: "La commande a été livrée.",
  cancelled: "La commande a été annulée.",
};

// PATCH /api/orders/[id]/status — update order status (shop owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 422 });
  }

  try {
    // Même séquence de réponses que l'ancienne route : 404 si la commande
    // n'existe pas, 403 si elle appartient à une autre boutique. La transition
    // elle-même revérifie la propriété sous verrou.
    const order = await prisma.order.findUnique({
      where: { id },
      select: { paymentProvider: true, shop: { select: { ownerId: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }
    if (order.shop.ownerId !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Une commande à régler à la livraison n'a rien payé : « confirmée »
    // veut dire que le vendeur la prend en charge, pas qu'un paiement est
    // arrivé.
    const defaultMessage =
      parsed.data.status === "confirmed" && order.paymentProvider === "cash_on_delivery"
        ? "Commande confirmée par le vendeur : il prépare ton colis, tu règles à la livraison."
        : DEFAULT_PUBLIC_MESSAGES[parsed.data.status] ?? null;

    const result = await transitionOrderStatus({
      orderId: id,
      status: parsed.data.status,
      actorId: user.id,
      note: parsed.data.note ?? null,
      publicMessage: parsed.data.public_message ?? defaultMessage,
    });

    if (!result.updated) {
      const message =
        result.reason === "invalid_transition"
          ? "Ce changement de statut n'est pas autorisé."
          : result.reason === "paid_order_requires_refund"
            ? "Une commande payée doit être remboursée auprès du prestataire avant d'être annulée."
            : result.reason === "manual_order_requires_payment"
              ? "Cette commande WhatsApp n'est pas encore payée : marque-la payée quand tu as reçu l'argent, ou annule-la."
              : result.reason === "forbidden"
              ? "Accès refusé"
              : result.reason === "unchanged"
                ? "La commande a déjà ce statut."
                : "Commande introuvable";
      return NextResponse.json(
        { error: message, reason: result.reason },
        { status: result.reason === "forbidden" ? 403 : result.reason === "not_found" ? 404 : 409 },
      );
    }

    // La confirmation d'une commande à la livraison est le moment où
    // l'acheteur apprend que son colis part (voir order-notifications).
    if (result.codConfirmed) {
      scheduleAfterResponse(
        () => notifyBuyerOfCashOnDeliveryOrder(id),
        (error) => console.warn("[api/orders status PATCH] cod buyer notification failed", error),
      );
    }

    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({
      order: serializeOrder(updated),
      stock_shortfall: result.codConfirmed ? result.stockShortfall : undefined,
    });
  } catch (error) {
    console.error("[api/orders status PATCH] error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
