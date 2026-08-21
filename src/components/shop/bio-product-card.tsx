"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ProductVectorIllustration } from "@/components/shop/product-vector-illustration";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/format";
import { buildWhatsAppOrderUrl } from "@/lib/utils/whatsapp";
import { readableTextOn, type BioPalette } from "@/lib/bio-themes";
import type { Currency, ProductRow } from "@/lib/types/database";

interface BioProductCardProps {
  product: ProductRow;
  shopSlug: string;
  shopId: string;
  shopName: string;
  currency: Currency;
  palette: BioPalette;
  radiusClass: string;
  /** Set when the shop sells through WhatsApp — the CTA becomes a wa.me link. */
  whatsappNumber: string | null;
  pageUrl: string;
}

export function BioProductCard({
  product,
  shopSlug,
  shopId,
  shopName,
  currency,
  palette,
  radiusClass,
  whatsappNumber,
  pageUrl,
}: BioProductCardProps) {
  const addItem = useCart((s) => s.addItem);

  const primaryImage = product.images?.[0];
  const effectiveCurrency = product.currency ?? currency;
  const isOutOfStock =
    product.stock_quantity !== null && product.stock_quantity <= 0;
  const isOnSale =
    product.compare_price !== null && product.compare_price > product.price;

  const whatsappUrl = whatsappNumber
    ? buildWhatsAppOrderUrl({
        whatsappNumber,
        shopName,
        productName: product.name,
        price: product.price,
        currency: effectiveCurrency,
        shopUrl: `${pageUrl}/${product.slug}`,
      })
    : null;

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
        "group relative flex flex-col overflow-hidden",
        "transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        radiusClass,
        isOutOfStock && "opacity-70",
      )}
      style={
        {
          backgroundColor: palette.surface,
          color: palette.surfaceText,
          border: `1px solid ${palette.border}`,
          backdropFilter:
            palette.buttonVariant === "glass" ? "blur(12px)" : undefined,
          "--tw-ring-color": palette.text,
          "--tw-ring-offset-color": palette.backgroundSolid,
        } as React.CSSProperties
      }
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ProductVectorIllustration
            name={product.name}
            description={product.description ?? ""}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {isOutOfStock && (
            <span className="rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Épuisé
            </span>
          )}
          {isOnSale && !isOutOfStock && (
            <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Promo
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-bold">
              {formatPrice(product.price, effectiveCurrency)}
            </span>
            {isOnSale && (
              <span className="text-xs opacity-60 line-through">
                {formatPrice(product.compare_price!, effectiveCurrency)}
              </span>
            )}
          </div>

          {isOutOfStock ? null : product.has_variants ? (
            <span className="text-[11px] font-medium opacity-70">
              Voir options
            </span>
          ) : whatsappUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(whatsappUrl, "_blank", "noopener,noreferrer");
              }}
              aria-label={`Commander ${product.name} sur WhatsApp`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform active:scale-95"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Ajouter ${product.name} au panier`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform active:scale-95"
              style={{
                backgroundColor: palette.accent,
                color: readableTextOn(palette.accent),
              }}
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
