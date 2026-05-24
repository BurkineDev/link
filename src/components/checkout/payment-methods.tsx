"use client";

import { CreditCard, ShieldCheck } from "lucide-react";

/**
 * Displays the available payment methods for buyer checkout.
 *
 * Currently the platform only routes orders through Stripe (cards).
 * The Mobile Money rail (Orange / MTN / Wave) is shown as "coming soon"
 * so we don't promise something we can't deliver.
 */
export function PaymentMethods() {
  return (
    <div className="space-y-3">
      <div className="flex w-full items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary">
          <span className="size-2 rounded-full bg-white" />
        </span>

        <CreditCard className="size-5 shrink-0 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Carte bancaire</p>
          <p className="text-xs text-muted-foreground">
            Paiement sécurisé via Stripe — Visa, Mastercard
          </p>
        </div>

        <div className="hidden gap-1 sm:flex">
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            VISA
          </span>
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-red-600">
            MC
          </span>
        </div>
      </div>

      <div className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-3">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
        <span className="text-lg shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Mobile Money (Orange, MTN, Wave)
          </p>
          <p className="text-xs text-muted-foreground">Bientôt disponible</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          Bientôt
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
        Tes informations de paiement sont chiffrées et traitées par Stripe.
      </div>
    </div>
  );
}
