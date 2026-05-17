"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import type { ProductRow } from "@/lib/types/database";
import type { Currency } from "@/lib/types/database";

interface ProductCardProps {
  product: ProductRow;
  shopSlug: string;
  shopId: string;
  currency: Currency;
  className?: string;
}

export function ProductCard({
  product,
  shopSlug,
  shopId,
  currency,
  className,
}: ProductCardProps) {
  const addItem = useCart((s) => s.addItem);

  const primaryImage = product.images?.[0];
  const isOutOfStock =
    product.stock_quantity !== null && product.stock_quantity <= 0;
  const isOnSale =
    product.compare_price !== null &&
    product.compare_price > product.price;

  const effectiveCurrency = product.currency ?? currency;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      currency: effectiveCurrency,
      quantity: 1,
      image: primaryImage?.url,
      shopId,
      shopSlug,
    });

    toast.success("Ajouté au panier", {
      description: product.name,
      icon: <ShoppingBag className="h-4 w-4" />,
    });
  }

  return (
    <Link
      href={`/${shopSlug}/${product.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl bg-card",
        "border border-border/60 shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOutOfStock && "opacity-70",
        className
      )}
    >
      {/* ── Image ── */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {isOutOfStock && (
            <span className="rounded-md bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
              Épuisé
            </span>
          )}
          {isOnSale && !isOutOfStock && (
            <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Promo
            </span>
          )}
        </div>

        {/* Add to cart button — top-right on hover */}
        {!isOutOfStock && !product.has_variants && (
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Ajouter ${product.name} au panier`}
            className={cn(
              // 44px touch target
              "absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl",
              "bg-background/90 text-foreground shadow-md backdrop-blur-sm",
              "transition-all duration-200",
              "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
              "active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* ── Details ── */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {product.name}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">
              {formatPrice(product.price, effectiveCurrency)}
            </span>
            {isOnSale && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compare_price!, effectiveCurrency)}
              </span>
            )}
          </div>

          {/* Mobile add button — always visible at bottom */}
          {!isOutOfStock && !product.has_variants && (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Ajouter ${product.name} au panier`}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:hidden",
                "shop-primary-bg text-white shadow-sm active:scale-95",
                "transition-transform"
              )}
              style={
                { "--btn-bg": "var(--shop-primary, #6366f1)" } as React.CSSProperties
              }
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}

          {product.has_variants && (
            <span className="text-xs text-muted-foreground">
              Voir options
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
