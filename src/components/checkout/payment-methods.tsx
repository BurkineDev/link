"use client";

import { CreditCard, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { type MobileMoneyProvider } from "@/lib/constants";

export type PaymentType = "mobile_money" | "card";

interface PaymentMethodsProps {
  value: {
    type: PaymentType;
    mobileProvider?: MobileMoneyProvider;
  };
  onChange: (value: { type: PaymentType; mobileProvider?: MobileMoneyProvider }) => void;
  error?: string;
}

export function PaymentMethods({ value, onChange, error }: PaymentMethodsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChange({ type: "card" })}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
          value.type === "card"
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-muted-foreground/40",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            value.type === "card"
              ? "border-primary bg-primary"
              : "border-border",
          )}
        >
          {value.type === "card" && (
            <span className="size-2 rounded-full bg-white" />
          )}
        </span>

        <CreditCard className="size-5 shrink-0 text-muted-foreground" />

        <div className="flex-1">
          <p className="text-sm font-medium">Carte bancaire</p>
          <p className="text-xs text-muted-foreground">Redirection vers Stripe Checkout</p>
        </div>

        <div className="hidden gap-1 sm:flex">
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            VISA
          </span>
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-red-600">
            MC
          </span>
        </div>
        <ExternalLink className="size-4 text-muted-foreground sm:hidden" />
      </button>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
