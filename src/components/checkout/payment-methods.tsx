"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Smartphone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type MobileMoneyProvider, MOBILE_MONEY_META } from "@/lib/constants";

// Subset shown in checkout UI
const FEATURED_PROVIDERS: {
  id: MobileMoneyProvider;
  emoji: string;
  color: string;
}[] = [
  { id: "orange_money", emoji: "🟠", color: "bg-orange-50 border-orange-200 hover:border-orange-400" },
  { id: "mtn_momo", emoji: "🟡", color: "bg-yellow-50 border-yellow-200 hover:border-yellow-400" },
  { id: "wave", emoji: "🌊", color: "bg-blue-50 border-blue-200 hover:border-blue-400" },
  { id: "moov_money", emoji: "🔵", color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400" },
  { id: "airtel_money", emoji: "🔴", color: "bg-red-50 border-red-200 hover:border-red-400" },
  { id: "free_money", emoji: "🟢", color: "bg-green-50 border-green-200 hover:border-green-400" },
];

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
  const [expanded, setExpanded] = useState<PaymentType | null>(value.type);

  function selectType(type: PaymentType) {
    setExpanded(type);
    onChange({ type, mobileProvider: value.mobileProvider });
  }

  function selectProvider(provider: MobileMoneyProvider) {
    onChange({ type: "mobile_money", mobileProvider: provider });
  }

  return (
    <div className="space-y-3">
      {/* Mobile Money option */}
      <div
        className={cn(
          "rounded-xl border-2 transition-colors",
          expanded === "mobile_money"
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-muted-foreground/40",
        )}
      >
        <button
          type="button"
          onClick={() => selectType("mobile_money")}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          aria-expanded={expanded === "mobile_money"}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              expanded === "mobile_money"
                ? "border-primary bg-primary"
                : "border-border",
            )}
          >
            {expanded === "mobile_money" && (
              <span className="size-2 rounded-full bg-white" />
            )}
          </span>

          <Smartphone className="size-5 shrink-0 text-muted-foreground" />

          <div className="flex-1">
            <p className="text-sm font-medium">Mobile Money</p>
            <p className="text-xs text-muted-foreground">
              Orange Money, MTN MoMo, Wave, Moov, Airtel...
            </p>
          </div>

          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded === "mobile_money" && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded === "mobile_money" && (
            <motion.div
              key="mobile-money-providers"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-6">
                {FEATURED_PROVIDERS.map((p) => {
                  const isSelected = value.mobileProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProvider(p.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all",
                        p.color,
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent",
                      )}
                      aria-pressed={isSelected}
                    >
                      <span className="text-2xl leading-none" role="img" aria-label={MOBILE_MONEY_META[p.id].label}>
                        {p.emoji}
                      </span>
                      <span className="text-[10px] font-medium leading-tight text-foreground">
                        {MOBILE_MONEY_META[p.id].label.replace(" Money", "").replace(" Mobile", "")}
                      </span>
                    </button>
                  );
                })}
              </div>
              {value.type === "mobile_money" && !value.mobileProvider && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  Sélectionnez votre opérateur ci-dessus
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card option */}
      <button
        type="button"
        onClick={() => {
          setExpanded("card");
          onChange({ type: "card" });
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
          value.type === "card" && expanded === "card"
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-muted-foreground/40",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            value.type === "card" && expanded === "card"
              ? "border-primary bg-primary"
              : "border-border",
          )}
        >
          {value.type === "card" && expanded === "card" && (
            <span className="size-2 rounded-full bg-white" />
          )}
        </span>

        <CreditCard className="size-5 shrink-0 text-muted-foreground" />

        <div className="flex-1">
          <p className="text-sm font-medium">Carte bancaire</p>
          <p className="text-xs text-muted-foreground">Visa / Mastercard</p>
        </div>

        <div className="flex gap-1">
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            VISA
          </span>
          <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-red-600">
            MC
          </span>
        </div>
      </button>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
