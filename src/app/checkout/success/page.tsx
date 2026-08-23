"use client";

import { useEffect, useState, Suspense } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import { buildWaMeLink } from "@/lib/whatsapp";
import { isValidWhatsAppNumber } from "@/lib/utils/whatsapp";

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
  | { status: "success"; order: OrderDetails }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams → must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

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

  useEffect(() => {
    if (!hasParams) return;

    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    if (provider) params.set("provider", provider);
    if (orderId) params.set("order", orderId);
    if (reference) params.set("reference", reference);

    fetch(`/api/checkout/verify?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setState({ status: "success", order: data.order as OrderDetails });
      })
      .catch((err) => {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Vérification échouée.",
        });
      });
  }, [hasParams, sessionId, provider, orderId, reference]);

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
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setState({ status: "loading" });
              const params = new URLSearchParams();
              if (sessionId) params.set("session_id", sessionId);
              fetch(`/api/checkout/verify?${params.toString()}`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.error) throw new Error(data.error);
                  setState({ status: "success", order: data.order });
                })
                .catch((err) => {
                  setState({
                    status: "error",
                    message: err instanceof Error ? err.message : "Vérification échouée.",
                  });
                });
            }}
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
