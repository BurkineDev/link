"use client";

import { CreditCard, Info, ShieldCheck, Smartphone } from "lucide-react";
import { isMobileMoneyCovered } from "@/lib/payments/mobile-money-coverage";
import { cn } from "@/lib/utils";

export type PaymentType = "card" | "mobile_money";

export type MobileProvider =
  | "wave"
  | "orange_money"
  | "mtn_money"
  | "moov_money"
  | "airtel_money";

interface PaymentMethodsProps {
  value: { type: PaymentType; mobileProvider?: MobileProvider };
  onChange: (v: { type: PaymentType; mobileProvider?: MobileProvider }) => void;
  /** When true the Mobile Money option stays visible but disabled. */
  mobileMoneyDisabled?: boolean;
  /** Pays de l'acheteur (ISO2) — décide si le Mobile Money peut aboutir. */
  buyerCountry?: string | null;
  /** Nom lisible du pays, pour l'expliquer à l'acheteur. */
  buyerCountryLabel?: string | null;
}

const PROVIDERS: { id: MobileProvider; label: string; emoji: string }[] = [
  { id: "wave", label: "Wave", emoji: "🌊" },
  { id: "orange_money", label: "Orange Money", emoji: "🟠" },
  { id: "mtn_money", label: "MTN Mobile Money", emoji: "🟡" },
  { id: "moov_money", label: "Moov Money", emoji: "🔵" },
];

export function PaymentMethods({
  value,
  onChange,
  mobileMoneyDisabled = false,
  buyerCountry,
  buyerCountryLabel,
}: PaymentMethodsProps) {
  // Genius Pay accepte le paiement puis n'envoie jamais le push quand le pays
  // n'est pas couvert. Mieux vaut le dire avant que l'acheteur attende.
  const outOfCoverage = !isMobileMoneyCovered(buyerCountry);
  const mobileMoneyUnavailable = mobileMoneyDisabled || outOfCoverage;

  return (
    <div className="space-y-3">
      {/* Carte bancaire (Stripe) */}
      <button
        type="button"
        onClick={() => onChange({ type: "card" })}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-150",
          value.type === "card"
            ? "border-primary bg-primary/10"
            : "border-border bg-background hover:border-foreground/30",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            value.type === "card" ? "border-primary bg-primary" : "border-border",
          )}
        >
          {value.type === "card" && <span className="size-2 rounded-full bg-primary-foreground" />}
        </span>

        <CreditCard className="size-5 shrink-0 text-foreground" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Carte bancaire</p>
          <p className="text-xs text-muted-foreground">
            Visa, Mastercard — sécurisé par Stripe
          </p>
        </div>
      </button>

      {/* Mobile Money (Genius Pay) */}
      <button
        type="button"
        onClick={() =>
          !mobileMoneyUnavailable && onChange({ type: "mobile_money" })
        }
        disabled={mobileMoneyUnavailable}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-150",
          mobileMoneyUnavailable && "opacity-60 cursor-not-allowed",
          value.type === "mobile_money"
            ? "border-primary bg-primary/10"
            : "border-border bg-background hover:border-foreground/30",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            value.type === "mobile_money"
              ? "border-primary bg-primary"
              : "border-border",
          )}
        >
          {value.type === "mobile_money" && (
            <span className="size-2 rounded-full bg-primary-foreground" />
          )}
        </span>

        <Smartphone className="size-5 shrink-0 text-foreground" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Mobile Money</p>
          <p className="text-xs text-muted-foreground">
            {outOfCoverage
              ? `Pas encore disponible ${buyerCountryLabel ? `au ${buyerCountryLabel}` : "dans ce pays"}`
              : mobileMoneyDisabled
                ? "Bientôt disponible"
                : "Wave, Orange, MTN, Moov — sécurisé par Genius Pay"}
          </p>
        </div>

        {mobileMoneyUnavailable && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            Bientôt
          </span>
        )}
      </button>

      {/* Pays hors couverture : on explique, plutôt que de laisser une option
          grisée sans raison. */}
      {outOfCoverage && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Notre partenaire Mobile Money ne couvre pas encore
            {buyerCountryLabel ? ` le ${buyerCountryLabel}` : " ce pays"}. Le
            paiement par carte bancaire fonctionne normalement.
          </p>
        </div>
      )}

      {/* Provider chips — shown only when Mobile Money is selected */}
      {value.type === "mobile_money" && !mobileMoneyUnavailable && (
        <div className="pl-4 pt-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Choisis ton opérateur (optionnel — détecté automatiquement sinon)
          </p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => {
              const active = value.mobileProvider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      type: "mobile_money",
                      mobileProvider: active ? undefined : p.id,
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <span>{p.emoji}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-[var(--success)] shrink-0" />
        Paiement chiffré. Tes coordonnées ne sont jamais stockées.
      </div>
    </div>
  );
}
