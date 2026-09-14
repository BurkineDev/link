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
import { ops } from "@/lib/ops/events";
import { enforceLimits, getClientIp } from "@/lib/rate-limit";

/**
 * La page de succès interroge cette route toutes les 4 s pendant 150 s, soit
 * une quarantaine d'appels par paiement ; plusieurs acheteurs peuvent partager
 * une adresse IP. La limite vise l'énumération de références, pas ce polling.
 */
const VERIFY_PER_IP = { limit: 120, windowSeconds: 60 };

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
    const blocked = await enforceLimits([
      { name: "checkout-verify:ip", key: getClientIp(request), ...VERIFY_PER_IP },
    ]);
    if (blocked) return blocked;

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
    // Paiement à la livraison : rien à vérifier chez un prestataire, la
    // commande est ferme dès sa création — il s'agit de la montrer.
    const isCodByOrder =
      provider === "cash_on_delivery" && !!orderId && /^[0-9a-f-]{36}$/i.test(orderId);
    const isGenius = provider === "geniuspay" && (!!reference || isGeniusByOrder);
    const isStripe = !!sessionId;

    if (!isGenius && !isStripe && !isFreeByOrder && !isCodByOrder) {
      return NextResponse.json(
        { error: "Paramètres de vérification manquants." },
        { status: 400 },
      );
    }

    // `payment_ref` n'est pas unique en base (une référence peut rester nulle
    // sur plusieurs commandes en attente) : `findFirst`, avec la valeur
    // toujours renseignée par construction.
    const row =
      isGeniusByOrder || isFreeByOrder || isCodByOrder
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
      // Une commande à régler à la livraison est ferme : son suivi lui
      // appartient déjà, même sans paiement.
      const firm = paid || orderObj.payment_provider === "cash_on_delivery";
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
        shipping_amount: orderObj.shipping_amount,
        discount_amount: orderObj.discount_amount,
        currency: orderObj.currency,
        status: orderObj.status,
        payment_status: orderObj.payment_status,
        payment_provider: orderObj.payment_provider,
        items: orderObj.items,
        shop_name: shop?.name,
        shop_slug: shop?.slug,
        shop_whatsapp: shop?.whatsappNumber ?? null,
        tracking_token: firm ? orderObj.tracking_token : null,
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

    if (isCodByOrder) {
      if (order.payment_provider !== "cash_on_delivery" || order.status === "cancelled") {
        return NextResponse.json(
          { error: "Cette commande n'est pas confirmée." },
          { status: 409 },
        );
      }
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
        return settledResponse(settlement, order, withShop, {
          provider: "geniuspay",
          reference: payment.reference ?? order.payment_ref,
          amount: payment.amount,
          currency: payment.currency,
        });
      }

      if (nextStatus === "paid" && (!amountOk || !currencyOk)) {
        console.warn("[verify] Genius Pay mismatch for order:", order.id);
        ops.critical({
          kind: "payment.amount_mismatch",
          title: `Paiement Genius Pay d'un montant inattendu — commande #${order.id.slice(0, 8).toUpperCase()}`,
          detail: `Genius Pay confirme ${payment.amount} ${payment.currency} pour une commande de ${order.total_amount} ${order.currency}. La commande reste en attente : rembourse la transaction depuis Genius Pay, ou demande au vendeur de la marquer payée depuis ses Commandes s'il accepte ce montant.`,
          context: { provider: "geniuspay", orderId: order.id, reference: payment.reference, received: payment.amount, receivedCurrency: payment.currency, expected: order.total_amount, expectedCurrency: order.currency },
          dedupeKey: `payment.amount_mismatch:${order.id}`,
        });
        return NextResponse.json(
          { error: "Le montant ou la devise ne correspond pas à la commande.", code: "AMOUNT_MISMATCH" },
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
      return settledResponse(settlement, order, withShop, {
        provider: "stripe",
        reference: session.id,
        amount: paidAmount,
        currency: session.currency ?? null,
      });
    }

    if (isFailed) {
      await cancelUnpaidOrder(order.id, session.id, "stripe");
      return NextResponse.json({ error: "Le paiement a échoué." }, { status: 400 });
    }

    if (isPaid && (!amountOk || !currencyOk)) {
      console.warn("[verify] Stripe amount/currency mismatch for order:", order.id);
      ops.critical({
        kind: "payment.amount_mismatch",
        title: `Paiement Stripe d'un montant inattendu — commande #${order.id.slice(0, 8).toUpperCase()}`,
        detail: `Stripe confirme ${paidAmount ?? "?"} ${session.currency?.toUpperCase() ?? ""} pour une commande de ${order.total_amount} ${order.currency}. La commande reste en attente : rembourse depuis Stripe, ou demande au vendeur de la marquer payée depuis ses Commandes s'il accepte ce montant.`,
        context: { provider: "stripe", orderId: order.id, sessionId: session.id, received: paidAmount, receivedCurrency: session.currency, expected: order.total_amount, expectedCurrency: order.currency },
        dedupeKey: `payment.amount_mismatch:${order.id}`,
      });
      return NextResponse.json(
        { error: "Le montant ou la devise du paiement ne correspond pas à la commande.", code: "AMOUNT_MISMATCH" },
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

/**
 * La réponse après un règlement demandé par la page de succès.
 *
 * L'ancienne version renvoyait « payé / confirmée » quoi qu'ait répondu
 * `settlePaidOrder` (constat A03 de l'audit) : un paiement confirmé après
 * l'annulation de la commande affichait un succès à l'acheteur alors que
 * la base disait « annulée ». On répond désormais avec l'état réel, et le
 * fondateur est prévenu de ce paiement tardif.
 */
async function settledResponse(
  settlement: Awaited<ReturnType<typeof settlePaidOrder>>,
  order: ReturnType<typeof serializeOrder>,
  withShop: (orderObj: ReturnType<typeof serializeOrder>) => Promise<unknown>,
  payment: { provider: "geniuspay" | "stripe"; reference: string | null; amount: number | null; currency: string | null },
) {
  if (settlement.settled || settlement.reason === "already_paid") {
    if (settlement.settled) {
      scheduleAfterResponse(
        () => notifyPaidOrder(order.id),
        (error) => console.warn("[verify] order notification failed", error),
      );
    }
    return NextResponse.json({
      order: await withShop({ ...order, payment_status: "paid", status: "confirmed" }),
    });
  }

  if (settlement.reason === "not_found") {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  // Une commande remboursée (en tout ou partie) reste « payée » chez le
  // prestataire : l'acheteur qui rouvre la page voit son état réel, sans
  // fausse alerte.
  if (order.payment_status === "refunded" || order.payment_status === "partially_refunded") {
    return NextResponse.json({ order: await withShop(order) });
  }

  // `not_pending` sur une commande échouée : elle a été annulée (expirée,
  // échouée) avant que le paiement soit confirmé. L'acheteur a payé ;
  // rien n'est réservé.
  ops.critical({
    kind: "payment.late_after_cancel",
    title: `Paiement ${payment.provider === "stripe" ? "Stripe" : "Mobile Money"} reçu sur une commande annulée — #${order.id.slice(0, 8).toUpperCase()}`,
    detail: `Le prestataire confirme le paiement mais la commande était déjà annulée (expirée ou échouée) : rien n'est réservé, personne ne livrera. Rembourse depuis ${payment.provider === "stripe" ? "Stripe" : "Genius Pay"}, ou préviens le vendeur pour qu'il livre et marque la commande payée depuis ses Commandes.`,
    context: { provider: payment.provider, orderId: order.id, reference: payment.reference, amount: payment.amount, currency: payment.currency, orderStatus: order.status, paymentStatus: order.payment_status },
    dedupeKey: `payment.late_after_cancel:${order.id}`,
  });
  return NextResponse.json(
    {
      error:
        "Ton paiement a bien été reçu, mais la commande avait expiré entre-temps. L'équipe Bio-Lien te contacte pour la confirmer ou te rembourser : garde ta référence.",
      code: "LATE_PAYMENT",
      reference: payment.reference,
    },
    { status: 409 },
  );
}
