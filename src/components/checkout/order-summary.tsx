"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type CartItem } from "@/hooks/use-cart";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import { checkoutTotal, type ShippingQuote } from "@/lib/checkout/shipping";
import { cn } from "@/lib/utils";
import { readableTextOn } from "@/lib/bio-themes";

/**
 * Récapitulatif de commande. Sur ordinateur, la carte fixe à droite ; sur
 * téléphone, un bandeau repliable en tête de page — l'acheteur venu de
 * TikTok doit voir chez qui il paie, quoi, et combien, avant de remplir
 * quoi que ce soit. La ligne « Livraison » dit la vérité : chiffrée quand
 * le pays est connu, « à convenir » quand le vendeur ne la facture pas ici,
 * jamais « Gratuite » par défaut.
 */

function formatPrice(amount: number, currency: Currency): string {
  const meta = CURRENCY_META[currency];
  const formatted = meta.decimals === 0
    ? Math.round(amount).toLocaleString("fr-FR")
    : amount.toLocaleString("fr-FR", {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      });
  return `${formatted} ${meta.symbol}`;
}

export interface OrderTotalsInput {
  items: CartItem[];
  currency: Currency;
  shipping: ShippingQuote;
  discount?: number;
}

export function orderTotal({ items, shipping, discount = 0 }: OrderTotalsInput): number {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return checkoutTotal({ subtotal, discount, shipping });
}

// ---------------------------------------------------------------------------
// Pièces
// ---------------------------------------------------------------------------

export function ShopIdentity({
  name,
  logoUrl,
  accent,
  compact = false,
}: {
  name: string;
  logoUrl?: string | null;
  accent?: string;
  compact?: boolean;
}) {
  const size = compact ? "size-9" : "size-10";
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <div className={cn("relative shrink-0 overflow-hidden rounded-lg border border-border", size)}>
          <Image src={logoUrl} alt="" fill className="object-cover" sizes="40px" />
        </div>
      ) : (
        <div
          className={cn("flex shrink-0 items-center justify-center rounded-lg", size)}
          style={{ backgroundColor: accent ? `${accent}1a` : undefined }}
        >
          <ShoppingBag className="size-5" style={{ color: accent }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Commande chez</p>
        <p className="truncate font-semibold text-foreground">{name}</p>
      </div>
    </div>
  );
}

function OrderLines({
  items,
  currency,
  accent,
}: {
  items: CartItem[];
  currency: Currency;
  accent?: string;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={`${item.productId}-${item.variantId ?? "default"}`}
          className="flex items-center gap-3"
        >
          {/* Le badge déborde de la vignette : il vit hors du cadre rogné. */}
          <div className="relative shrink-0">
            <div className="relative size-14 overflow-hidden rounded-md border border-border bg-muted">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <ShoppingBag className="size-6 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <span
              className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-muted-foreground text-[10px] font-bold text-background"
              style={accent ? { backgroundColor: accent, color: readableTextOn(accent) } : undefined}
              aria-label={`Quantité : ${item.quantity}`}
            >
              {item.quantity}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
            {item.variantLabel && (
              <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
            )}
          </div>
          <p className="shrink-0 text-sm font-medium tabular-nums">
            {formatPrice(item.price * item.quantity, currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ShippingLine({ quote, currency }: { quote: ShippingQuote; currency: Currency }) {
  switch (quote.kind) {
    case "none":
      return <span>À convenir avec le vendeur</span>;
    case "unknown":
      return <span>Selon le pays</span>;
    case "unavailable":
      return <span className="font-medium text-destructive">Indisponible pour ce pays</span>;
    case "free":
      return <span className="font-medium text-[var(--success)]">Gratuite</span>;
    case "paid":
      return <>{formatPrice(quote.amount, currency)}</>;
  }
}

function OrderTotals({
  items,
  currency,
  shipping,
  physical,
  discount = 0,
  discountLabel,
}: OrderTotalsInput & { physical: boolean; discountLabel?: string }) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = orderTotal({ items, currency, shipping, discount });

  return (
    <>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Sous-total</span>
          <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
        </div>

        {physical && (
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Livraison</span>
            <span className="text-right tabular-nums">
              <ShippingLine quote={shipping} currency={currency} />
            </span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between text-[var(--success)]">
            <span>Remise {discountLabel ? `(${discountLabel})` : null}</span>
            <span className="font-medium tabular-nums">−{formatPrice(discount, currency)}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between font-semibold">
        <span>Total</span>
        <span className="text-lg tabular-nums">{formatPrice(total, currency)}</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Compositions
// ---------------------------------------------------------------------------

interface OrderSummaryProps extends OrderTotalsInput {
  shopName: string;
  shopLogo?: string | null;
  /** Couleur de la boutique, pour que la page reste la sienne. */
  accent?: string;
  /** Le panier contient au moins un article à livrer. */
  physical: boolean;
  discountLabel?: string;
  className?: string;
  /** Bouton de paiement rendu par le parent (sur ordinateur, il vit ici). */
  children?: ReactNode;
}

/** Carte fixe de la colonne de droite (ordinateur). */
export function OrderSummary({
  items,
  shopName,
  shopLogo,
  accent,
  currency,
  shipping,
  physical,
  discount = 0,
  discountLabel,
  className,
  children,
}: OrderSummaryProps) {
  return (
    <Card className={cn("sticky top-6", className)}>
      <CardHeader className="pb-4">
        <ShopIdentity name={shopName} logoUrl={shopLogo} accent={accent} />
      </CardHeader>
      <CardContent className="space-y-4">
        <OrderLines items={items} currency={currency} accent={accent} />
        <Separator />
        <OrderTotals
          items={items}
          currency={currency}
          shipping={shipping}
          physical={physical}
          discount={discount}
          discountLabel={discountLabel}
        />
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Bandeau repliable en tête de page (téléphone) : replié, il montre chez
 * qui on paie et combien ; déplié, les articles et le détail.
 */
export function MobileOrderSummary({
  items,
  shopName,
  shopLogo,
  accent,
  currency,
  shipping,
  physical,
  discount = 0,
  discountLabel,
  className,
}: Omit<OrderSummaryProps, "children">) {
  const [open, setOpen] = useState(false);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = orderTotal({ items, currency, shipping, discount });

  return (
    <section
      className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}
      aria-label="Récapitulatif de la commande"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-order-details"
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <ShopIdentity name={shopName} logoUrl={shopLogo} accent={accent} compact />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {count} article{count > 1 ? "s" : ""}
            </p>
            <p className="font-semibold tabular-nums">{formatPrice(total, currency)}</p>
          </div>
          <ChevronDown
            className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </div>
      </button>

      <div id="mobile-order-details" hidden={!open} className="space-y-4 border-t border-border p-4">
        <OrderLines items={items} currency={currency} accent={accent} />
        <Separator />
        <OrderTotals
          items={items}
          currency={currency}
          shipping={shipping}
          physical={physical}
          discount={discount}
          discountLabel={discountLabel}
        />
      </div>
    </section>
  );
}

export { formatPrice };
