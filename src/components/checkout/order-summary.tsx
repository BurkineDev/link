"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type CartItem } from "@/hooks/use-cart";
import { CURRENCY_META, type Currency } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface OrderSummaryProps {
  items: CartItem[];
  shopName: string;
  shopLogo?: string | null;
  currency: Currency;
  shipping?: number | null;
  className?: string;
  /** Submit button rendered externally (on desktop, button lives here) */
  children?: React.ReactNode;
}

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

export function OrderSummary({
  items,
  shopName,
  shopLogo,
  currency,
  shipping,
  className,
  children,
}: OrderSummaryProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingCost = shipping ?? 0;
  const total = subtotal + shippingCost;

  return (
    <Card className={cn("sticky top-6", className)}>
      <CardHeader className="pb-4">
        {/* Shop branding */}
        <div className="flex items-center gap-3">
          {shopLogo ? (
            <div className="relative size-10 overflow-hidden rounded-lg border border-border">
              <Image
                src={shopLogo}
                alt={shopName}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="size-5 text-primary" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Commande chez</p>
            <p className="font-semibold text-foreground">{shopName}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Item list */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId ?? "default"}`}
              className="flex items-center gap-3"
            >
              {/* Thumbnail */}
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ShoppingBag className="size-6 text-muted-foreground/40" />
                  </div>
                )}
                {/* Quantity badge */}
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-muted-foreground text-[10px] font-bold text-background">
                  {item.quantity}
                </span>
              </div>

              {/* Name + variant */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </p>
                {item.variantLabel && (
                  <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                )}
              </div>

              {/* Line total */}
              <p className="shrink-0 text-sm font-medium tabular-nums">
                {formatPrice(item.price * item.quantity, currency)}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Sous-total</span>
            <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
          </div>

          <div className="flex justify-between text-muted-foreground">
            <span>Livraison</span>
            <span className="tabular-nums">
              {shippingCost === 0 ? (
                <span className="font-medium text-emerald-600">Gratuite</span>
              ) : (
                formatPrice(shippingCost, currency)
              )}
            </span>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums text-lg">{formatPrice(total, currency)}</span>
        </div>

        {/* Slot for submit button on desktop */}
        {children}
      </CardContent>
    </Card>
  );
}

export { formatPrice };
