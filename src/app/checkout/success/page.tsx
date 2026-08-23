"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShoppingBag,
  ArrowLeft,
  RefreshCw,
  Mail,
  MessageCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import { buildWaMeLink } from "@/lib/whatsapp";
import { isValidWhatsAppNumber } from "@/lib/utils/whatsapp";
import { useCart } from "@/hooks/use-cart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderDetails {
  id: string;
  buyer_name: string;
  buyer_email: string;
  total_amount: number;
  currency: Currency;
  status: string;
  payment_status: string;
  items: Array<{
    product_snapshot: { product_name: string };
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  shop_name?: string;
  shop_slug?: string;
  shop_whatsapp?: string | null;
}

type VerifyState =
  | { status: "loading" }
  | { status: "pending"; reference: string | null; timedOut: boolean }
  | { status: "success"; order: OrderDetails }
  | { status: "error"; message: string };

// Le Mobile Money est asynchrone : l'acheteur revient du site de l'opérateur
// souvent avant que celui-ci ait notifié Genius Pay. Une seule vérification
// tombait donc sur un 202 « en cours de traitement » qu'on affichait comme un
// échec — l'acheteur avait payé et lisait « Paiement non confirmé ».
const POLL_INTERVAL_MS = 4_000;
const POLL_WINDOW_MS = 150_000;

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams → must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clearCart = useCart((s) => s.clearCart);

  // Deux fournisseurs arrivent ici : Stripe renvoie `session_id`, Genius Pay
  // l'identifiant de commande. Sans le second cas, tout acheteur Mobile Money
  // — la majorité — atterrissait sur « Référence de transaction manquante »
  // alors que son paiement était bien passé.
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order");
  const provider = searchParams.get("provider");
  const reference = searchParams.get("reference");

  const hasParams = Boolean(sessionId || orderId || reference);

  const [state, setState] = useState<VerifyState>(() =>
    hasParams
      ? { status: "loading" }
      : { status: "error", message: "Référence de transaction manquante." },
  );
  // Incrémenté par « Vérifier à nouveau » : relance une fenêtre de polling.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    if (provider) params.set("provider", provider);
    if (orderId) params.set("order", orderId);
    if (reference) params.set("reference", reference);
    return params.toString();
  }, [sessionId, provider, orderId, reference]);

  useEffect(() => {
    if (!hasParams) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      let res: Response;
      let data: { order?: OrderDetails; error?: string; reference?: string } = {};

      try {
        res = await fetch(`/api/checkout/verify?${buildQuery()}`);
        data = await res.json().catch(() => ({}));
      } catch {
        // Coupure réseau — fréquent quand l'acheteur bascule entre son
        // navigateur et son application Mobile Money. On retente.
        if (cancelled) return;
        if (Date.now() - startedAt < POLL_WINDOW_MS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setState({ status: "pending", reference: null, timedOut: true });
        }
        return;
      }

      if (cancelled) return;

      if (res.ok && data.order) {
        setState({ status: "success", order: data.order });
        return;
      }

      // 202 = l'opérateur n'a pas encore confirmé. Ce n'est pas un échec.
      if (res.status === 202) {
        const timedOut = Date.now() - startedAt >= POLL_WINDOW_MS;
        setState({
          status: "pending",
          reference: data.reference ?? null,
          timedOut,
        });
        if (!timedOut) timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      setState({
        status: "error",
        message: data.error ?? "Vérification échouée.",
      });
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasParams, buildQuery, attempt]);

  // Le panier ne se vide qu'ici, une fois le paiement confirmé. Il était
  // auparavant vidé avant même la redirection vers l'opérateur : un paiement
  // abandonné ou refusé laissait l'acheteur avec un panier vide et rien à
  // reprendre.
  useEffect(() => {
    if (state.status === "success") clearCart();
  }, [state.status, clearCart]);

  // ---- Loading ----
  if (state.status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Vérification du paiement en cours…
        </p>
      </div>
    );
  }

  // ---- Pending : payé chez l'opérateur, pas encore confirmé chez nous ----
  if (state.status === "pending") {
    const shortRef = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : null;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-amber-100">
          {state.timedOut ? (
            <Clock className="size-10 text-amber-600" />
          ) : (
            <Loader2 className="size-10 animate-spin text-amber-600" />
          )}
        </div>

        <h1 className="mb-2 text-2xl font-bold">
          {state.timedOut
            ? "Confirmation plus longue que prévu"
            : "Paiement en cours de confirmation"}
        </h1>

        <p className="mb-6 text-muted-foreground">
          {state.timedOut ? (
            <>
              Votre opérateur n&apos;a pas encore confirmé le paiement à Genius
              Pay. Si le montant a été débité, la commande sera validée
              automatiquement dès réception — vous n&apos;avez rien à refaire.
              Ne payez pas une seconde fois.
            </>
          ) : (
            <>
              Nous attendons la confirmation de votre opérateur Mobile Money.
              Cela prend en général moins d&apos;une minute. Gardez cette page
              ouverte.
            </>
          )}
        </p>

        {(shortRef || state.reference) && (
          <Card className="mb-6 w-full text-left">
            <CardContent className="space-y-2 pt-6 text-sm">
              {shortRef && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Commande</span>
                  <span className="font-mono font-medium">{shortRef}</span>
                </div>
              )}
              {state.reference && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Transaction</span>
                  <span className="font-mono font-medium">
                    {state.reference}
                  </span>
                </div>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                Notez cette référence : elle identifie votre paiement auprès du
                vendeur et du support.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="gap-2"
            onClick={retry}
          >
            <RefreshCw className="size-4" />
            Vérifier à nouveau
          </Button>
          {state.timedOut && (
            <Button variant="outline" className="gap-2" asChild>
              <a href="mailto:support@bio-lien.com">
                <Mail className="size-4" />
                Contacter le support
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- Error ----
  if (state.status === "error") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="size-10 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Paiement non confirmé</h1>
        <p className="mb-6 text-muted-foreground">{state.message}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Renvoie bien tous les paramètres : l'ancien bouton ne réémettait
              que `session_id`, donc il ne pouvait rien vérifier pour un
              acheteur Mobile Money — le seul cas où il servait vraiment. */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={retry}
          >
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <a href="mailto:support@bio-lien.com">
              <Mail className="size-4" />
              Contacter le support
            </a>
          </Button>
        </div>
        <Button
          variant="ghost"
          className="mt-4 gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Retour à la boutique
        </Button>
      </div>
    );
  }

  // ---- Success ----
  const { order } = state;
  const currencyMeta = CURRENCY_META[order.currency];

  const sellerWaLink =
    order.shop_whatsapp && isValidWhatsAppNumber(order.shop_whatsapp)
      ? buildWaMeLink(
          order.shop_whatsapp,
          [
            `Bonjour ${order.shop_name ?? ""} 👋`.replace(/\s+/g, " ").trim(),
            `Je viens de passer commande sur votre boutique Bio-Lien.`,
            "",
            `Référence : #${order.id.slice(0, 8).toUpperCase()}`,
            `Total : ${formatPrice(order.total_amount)}`,
            `Nom : ${order.buyer_name}`,
          ].join("\n"),
        )
      : null;

  function formatPrice(amount: number) {
    const fmt =
      currencyMeta.decimals === 0
        ? Math.round(amount).toLocaleString("fr-FR")
        : amount.toLocaleString("fr-FR", {
            minimumFractionDigits: currencyMeta.decimals,
            maximumFractionDigits: currencyMeta.decimals,
          });
    return `${fmt} ${currencyMeta.symbol}`;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
        className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-emerald-100"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.25 }}
        >
          <CheckCircle2 className="size-12 text-emerald-600" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h1 className="mb-2 text-2xl font-bold">Paiement réussi !</h1>
        <p className="mb-8 text-muted-foreground">
          Merci <strong>{order.buyer_name}</strong>. Votre commande a bien été
          enregistrée. Le vendeur en a été informé et vous contactera pour la
          suite. Conservez votre numéro de référence ci-dessous.
        </p>
      </motion.div>

      {/* Order details card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="text-left">
          <CardContent className="space-y-4 pt-6">
            {/* Order reference */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Référence commande</span>
              <span className="font-mono font-medium text-foreground">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex-1 truncate text-foreground">
                    {item.product_snapshot.product_name}
                    <span className="text-muted-foreground">
                      {" "}
                      × {item.quantity}
                    </span>
                  </span>
                  <span className="ml-4 tabular-nums">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between font-semibold">
              <span>Total payé</span>
              <span className="tabular-nums text-lg">
                {formatPrice(order.total_amount)}
              </span>
            </div>

            {/* Status badge */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Statut</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  order.payment_status === "paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-yellow-100 text-yellow-700",
                )}
              >
                {order.payment_status === "paid" ? "Payé" : "En attente"}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Buyer relay: confirm the order in the seller's WhatsApp ── */}
      {/* Works with zero API setup, matches how buyers already talk to     */}
      {/* sellers here — and it opens the 24h service window that lets the  */}
      {/* Cloud API deliver free-text alerts afterwards.                    */}
      {sellerWaLink && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <a
            href={sellerWaLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl",
              "text-base font-semibold text-white shadow-sm",
              "transition-transform active:scale-[0.99]",
            )}
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className="size-5" />
            Prévenir le vendeur sur WhatsApp
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Envoie ta confirmation à {order.shop_name ?? "la boutique"}
            {" — le message est déjà écrit, tu n'as qu'à appuyer sur envoyer."}
          </p>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        {order.shop_slug ? (
          <Button asChild className="gap-2">
            <a href={`/${order.shop_slug}`}>
              <ShoppingBag className="size-4" />
              Retourner à la boutique
            </a>
          </Button>
        ) : (
          <Button onClick={() => router.push("/")} className="gap-2">
            <ShoppingBag className="size-4" />
            Retourner à l&apos;accueil
          </Button>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

function SuccessSkeleton() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="size-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Vérification en cours…</p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessContent />
    </Suspense>
  );
}
