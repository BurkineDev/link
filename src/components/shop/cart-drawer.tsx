"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types/database";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: Currency;
  shopSlug: string;
}

export function CartDrawer({
  open,
  onOpenChange,
  currency,
  shopSlug,
}: CartDrawerProps) {
  const items = useCart((s) => s.items);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const getTotal = useCart((s) => s.getTotal);

  const total = getTotal();
  const isEmpty = items.length === 0;
  // Use currency from first item if available (cart is per-shop)
  const displayCurrency = items[0]?.currency ?? currency;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-5 w-5" />
            Mon panier
            {!isEmpty && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isEmpty ? (
          /* ── Empty state ── */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Panier vide</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez des articles pour commencer vos achats.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mt-2"
            >
              Continuer les achats
            </Button>
          </div>
        ) : (
          <>
            {/* ── Item list ── */}
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={`${item.productId}-${item.variantId ?? "base"}`}
                    className="flex gap-3 p-4"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      {item.variantLabel && (
                        <p className="text-xs text-muted-foreground">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-foreground">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </p>

                      {/* Quantity controls + remove */}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.quantity - 1,
                                item.variantId
                              )
                            }
                            aria-label="Diminuer la quantité"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="flex h-8 min-w-8 items-center justify-center border-x border-border px-2 text-sm font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.quantity + 1,
                                item.variantId
                              )
                            }
                            aria-label="Augmenter la quantité"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(item.productId, item.variantId)
                          }
                          aria-label="Supprimer l'article"
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Order summary ── */}
            <SheetFooter className="border-t border-border p-4 gap-3">
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-semibold text-foreground">
                    {formatPrice(total, displayCurrency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Frais de livraison calculés à la commande
                </p>
              </div>

              <Separator />

              <div className="flex w-full flex-col gap-2">
                <Link
                  href="/checkout"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: "var(--shop-primary, #6366f1)" }}
                >
                  Passer la commande
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Continuer les achats
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
