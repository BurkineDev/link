import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelUnpaidOrder, settlePaidOrder } from "@/lib/db/orders";
import { serializeOrder } from "@/lib/db/serialize";
import { fromStripeAmount, getStripe } from "@/lib/stripe";
import {
  fetchPayment as fetchGeniusPayment,
  mapStatusToPaymentStatus,
} from "@/lib/geniuspay";
import { notifyPaidOrder } from "@/lib/order-notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

// ---------------------------------------------------------------------------
// GET /api/checkout/verify?session_id=cs_xxx
//   - Stripe : ?session_id=cs_xxx
//   - Genius Pay : ?provider=geniuspay&reference=MTX-XXXXXXXXXX
//
// Called from /checkout/success after the gateway redirects back. Returns
// the order with a confirmed payment_status when verifying succeeds. The
// webhook is the source of truth — this endpoint is a fallback / UX helper
// so the success page can show the correct state without waiting on the
// webhook to fire.
//
// L'acheteur est anonyme : il n'y a plus de RLS pour le filtrer, donc c'est
// la référence de paiement à forte entropie (Stripe cs_…, Genius Pay MTX-…)
// ou l'UUID de commande qui sert de capacité d'accès. Les changements de
// statut ne s'exécutent qu'après confirmation par le prestataire lui-même.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const provider = searchParams.get("provider");
    const reference = searchParams.get("reference");
    const orderId = searchParams.get("order");

    // Genius Pay ne nous donne la référence qu'*après* avoir créé le paiement,
    // alors que l'URL de retour, elle, doit être fournie *pendant*. On y met
    // donc l'identifiant de commande, connu avant l'appel — la référence est
    // ensuite relue depuis la commande. (L'ancienne URL portait un gabarit
    // `{REFERENCE}` que Genius Pay ne remplaçait pas et refusait même de
    // valider : les accolades ne sont pas des caractères d'URL.)
    const isGeniusByOrder =
      provider === "geniuspay" && !!orderId && /^[0-9a-f-]{36}$/i.test(orderId);
    const isFreeByOrder =
      provider === "free" && !!orderId && /^[0-9a-f-]{36}$/i.test(orderId);
    const isGenius = provider === "geniuspay" && (!!reference || isGeniusByOrder);
    const isStripe = !!sessionId;

    if (!isGenius && !isStripe && !isFreeByOrder) {
      return NextResponse.json(
        { error: "Paramètres de vérification manquants." },
        { status: 400 },
      );
    }

    // `payment_ref` n'est pas unique en base (une référence peut rester nulle
    // sur plusieurs commandes en attente) : `findFirst`, avec la valeur
    // toujours renseignée par construction.
    const row =
      isGeniusByOrder || isFreeByOrder
        ? await prisma.order.findUnique({ where: { id: orderId! } })
        : await prisma.order.findFirst({
            where: { paymentRef: (isGenius ? reference : sessionId) as string },
          });

    if (!row) {
      return NextResponse.json(
        { error: "Commande introuvable pour cette référence." },
        { status: 404 },
      );
    }

    const order = serializeOrder(row);

    /**
     * Réponse PUBLIQUE de la page de succès : cette route est un GET sans
     * authentification, atteignable par quiconque connaît l'identifiant de
     * commande. On ne renvoie que ce que la page affiche — jamais l'e-mail,
     * le téléphone, l'adresse ni les notes de l'acheteur.
     *
     * Une fois payée, la commande emporte son lien de suivi et ses fichiers
     * numériques : avant, tout partait uniquement par e-mail, et l'acheteur
     * sans e-mail (ou avec une faute de frappe) ne recevait jamais son
     * fichier ni son suivi.
     */
    const withShop = async (orderObj: typeof order) => {
      const paid = orderObj.payment_status === "paid";
      const [shop, downloads] = await Promise.all([
        prisma.shop.findUnique({
          where: { id: orderObj.shop_id },
          select: { name: true, slug: true, whatsappNumber: true },
        }),
        paid
          ? prisma.digitalDownload.findMany({
              where: { orderId: orderObj.id },
              select: { token: true, fileName: true, expiresAt: true },
            })
          : Promise.resolve([]),
      ]);
      // whatsapp_number is already public (it powers the wa.me CTAs on the
      // shop page); exposing it here lets the buyer relay their confirmation.
      return {
        id: orderObj.id,
        buyer_name: orderObj.buyer_name,
        total_amount: orderObj.total_amount,
        currency: orderObj.currency,
        status: orderObj.status,
        payment_status: orderObj.payment_status,
        items: orderObj.items,
        shop_name: shop?.name,
        shop_slug: shop?.slug,
        shop_whatsapp: shop?.whatsappNumber ?? null,
        tracking_token: paid ? orderObj.tracking_token : null,
        downloads: downloads.map((d) => ({
          token: d.token,
          file_name: d.fileName,
          expires_at: d.expiresAt?.toISOString() ?? null,
        })),
      };
    };

    // Already settled — idempotent return.
    if (order.payment_status === "paid") {
      return NextResponse.json({ order: await withShop(order) });
    }

    if (isFreeByOrder) {
      return NextResponse.json(
        { error: "Cette commande gratuite n'est pas confirmée." },
        { status: 409 },
      );
    }

    // --------------------------------------------------------------------- //
    // Genius Pay branch                                                     //
    // --------------------------------------------------------------------- //
    if (isGenius) {
      let payment;
      try {
        payment = await fetchGeniusPayment(
          reference ?? (order.payment_ref as string),
        );
      } catch (err) {
        console.error("[verify] Genius Pay fetch failed:", err);
        return NextResponse.json(
          { error: "Impossible de vérifier le paiement Mobile Money." },
          { status: 502 },
        );
      }

      const nextStatus = mapStatusToPaymentStatus(payment.status);
      const amountOk = payment.amount >= order.total_amount;
      const currencyOk =
        payment.currency.toUpperCase() === order.currency.toUpperCase();

      if (nextStatus === "paid" && amountOk && currencyOk) {
        const settlement = await settlePaidOrder(
          order.id,
          payment.reference ?? (order.payment_ref as string),
          "geniuspay",
        );
        if (settlement.settled) {
          scheduleAfterResponse(
            () => notifyPaidOrder(order.id),
            (error) => console.warn("[verify] order notification failed", error),
          );
        }
        return NextResponse.json({
          order: await withShop({
            ...order,
            payment_status: "paid",
            status: "confirmed",
          }),
        });
      }

      if (nextStatus === "paid" && (!amountOk || !currencyOk)) {
        console.warn("[verify] Genius Pay mismatch for order:", order.id);
        return NextResponse.json(
          { error: "Le montant ou la devise ne correspond pas à la commande." },
          { status: 400 },
        );
      }

      if (nextStatus === "failed") {
        await cancelUnpaidOrder(
          order.id,
          payment.reference ?? order.payment_ref,
          "geniuspay",
        );
        return NextResponse.json({ error: "Le paiement a échoué." }, { status: 400 });
      }

      // Tracé volontairement : une commande bloquée en attente sans aucune
      // trace côté serveur est impossible à diagnostiquer après coup — c'est
      // exactement ce qui s'est passé au premier paiement réel.
      console.info(
        `[verify] order ${order.id} still pending — geniuspay status=${payment.status} ref=${payment.reference} method=${payment.payment_method ?? "?"} provider=${payment.payment_provider ?? "?"} env=${payment.environment} gateway=${payment.gateway ?? "?"}`,
      );

      // 202 — l'opérateur n'a pas encore confirmé. La page de retour reboucle
      // dessus ; on lui rend la référence pour qu'elle puisse l'afficher à
      // l'acheteur, qui en a besoin pour se faire identifier auprès du vendeur.
      return NextResponse.json(
        {
          error:
            "Le paiement est encore en cours de traitement. Réessayez dans quelques instants.",
          reference: payment.reference ?? (order.payment_ref as string | null),
        },
        { status: 202 },
      );
    }

    // --------------------------------------------------------------------- //
    // Stripe branch                                                          //
    // --------------------------------------------------------------------- //
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId!);

    const isPaid = session.payment_status === "paid";
    const isFailed = session.status === "expired";
    const paidAmount = fromStripeAmount(session.amount_total, order.currency);
    const amountOk = paidAmount !== null && paidAmount >= order.total_amount;
    const currencyOk =
      session.currency?.toUpperCase() === order.currency.toUpperCase();

    if (isPaid && amountOk && currencyOk) {
      const settlement = await settlePaidOrder(order.id, session.id, "stripe");
      if (settlement.settled) {
        scheduleAfterResponse(
          () => notifyPaidOrder(order.id),
          (error) => console.warn("[verify] order notification failed", error),
        );
      }
      return NextResponse.json({
        order: await withShop({
          ...order,
          payment_status: "paid",
          status: "confirmed",
        }),
      });
    }

    if (isFailed) {
      await cancelUnpaidOrder(order.id, session.id, "stripe");
      return NextResponse.json({ error: "Le paiement a échoué." }, { status: 400 });
    }

    if (isPaid && (!amountOk || !currencyOk)) {
      console.warn("[verify] Stripe amount/currency mismatch for order:", order.id);
      return NextResponse.json(
        { error: "Le montant ou la devise du paiement ne correspond pas à la commande." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Le paiement est encore en cours de traitement. Réessayez dans quelques instants.",
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("[verify] unexpected error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
