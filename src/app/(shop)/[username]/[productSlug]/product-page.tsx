"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ShoppingBag, Zap, Minus, Plus, Home } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VariantSelector } from "@/components/shop/variant-selector";
import { ProductCard } from "@/components/shop/product-card";
import { ProductVectorIllustration } from "@/components/shop/product-vector-illustration";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { FONT_FAMILY_CLASS } from "@/lib/constants";
import type {
  ShopRow,
  ProductRow,
  ProductVariantRow,
} from "@/lib/types/database";

interface ProductPageProps {
  shop: ShopRow;
  product: ProductRow;
  variants: ProductVariantRow[];
  related: ProductRow[];
}

export function ProductPage({
  shop,
  product,
  variants,
  related,
}: ProductPageProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  const addItem = useCart((s) => s.addItem);
  const itemCount = useCart((s) => s.getItemCount());

  const images = product.images ?? [];
  const primaryImage = images[selectedImage];

  const effectivePrice = selectedVariant?.price ?? product.price;
  const isOnSale =
    product.compare_price !== null && product.compare_price > product.price;
  const isOutOfStock = selectedVariant
    ? selectedVariant.stock_quantity !== null &&
      selectedVariant.stock_quantity <= 0
    : product.stock_quantity !== null && product.stock_quantity <= 0;

  const variantLabel = selectedVariant
    ? selectedVariant.options.map((o) => o.value).join(" / ")
    : undefined;

  function handleAddToCart() {
    if (isOutOfStock) return;
    if (product.has_variants && !selectedVariant) {
      toast.error("Veuillez choisir une variante");
      return;
    }

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      price: effectivePrice,
      currency: product.currency,
      quantity,
      image: images[0]?.url,
      variantLabel,
      shopId: shop.id,
      shopSlug: shop.slug,
    });

    toast.success("Ajouté au panier", {
      description: `${product.name}${variantLabel ? ` — ${variantLabel}` : ""}`,
      icon: <ShoppingBag className="h-4 w-4" />,
    });
  }

  function handleBuyNow() {
    handleAddToCart();
    setCartOpen(true);
  }

  const fontClass =
    FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;

  return (
    <div
      className={cn("min-h-screen bg-background", fontClass)}
      style={
        {
          "--shop-primary": shop.theme_color,
          "--shop-accent": shop.accent_color,
        } as React.CSSProperties
      }
    >
      {/* ── Breadcrumb ── */}
      <nav
        aria-label="Fil d'Ariane"
        className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">Accueil</span>
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180 shrink-0" />
          <Link
            href={`/${shop.slug}`}
            className="hover:text-foreground transition-colors truncate max-w-32 sm:max-w-none"
          >
            {shop.name}
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180 shrink-0" />
          <span className="text-foreground font-medium truncate max-w-36 sm:max-w-none">
            {product.name}
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {/* ── Product detail grid ── */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {/* ── Left: Image gallery ── */}
          <div className="space-y-3">
            {/* Main image replaced with Vector Illustration */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
              <ProductVectorIllustration
                name={product.name}
                description={product.description ?? ""}
              />

              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-2">
                {isOutOfStock && (
                  <span className="rounded-lg bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-background">
                    Épuisé
                  </span>
                )}
                {isOnSale && !isOutOfStock && (
                  <span className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white">
                    Promo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Details ── */}
          <div className="flex flex-col gap-5">
            {/* Name */}
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">
                {formatPrice(effectivePrice, product.currency)}
              </span>
              {isOnSale && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.compare_price!, product.currency)}
                </span>
              )}
              {isOnSale && (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-sm font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                  {Math.round(
                    ((product.compare_price! - product.price) /
                      product.compare_price!) *
                      100
                  )}
                  % off
                </span>
              )}
            </div>

            {/* Variants */}
            {product.has_variants && variants.length > 0 && (
              <VariantSelector
                variants={variants}
                selectedVariantId={selectedVariant?.id ?? null}
                onSelect={setSelectedVariant}
                basePrice={product.price}
                currency={product.currency}
              />
            )}

            {/* Quantity */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Quantité</p>
              <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-border w-fit">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label="Diminuer la quantité"
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="flex h-11 min-w-12 items-center justify-center border-x border-border px-3 text-sm font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Augmenter la quantité"
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 flex-1 gap-2 text-base font-semibold text-white"
                style={{ backgroundColor: "var(--shop-primary, #6366f1)" }}
                disabled={isOutOfStock}
                onClick={handleAddToCart}
              >
                <ShoppingBag className="h-5 w-5" />
                {isOutOfStock ? "Épuisé" : "Ajouter au panier"}
              </Button>
              {!isOutOfStock && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 flex-1 gap-2 text-base font-semibold"
                  onClick={handleBuyNow}
                >
                  <Zap className="h-5 w-5" />
                  Acheter maintenant
                </Button>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="border-t border-border pt-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </h2>
                <div className="prose prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </div>
              </div>
            )}

            {/* Back to shop */}
            <Link
              href={`/${shop.slug}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Retour à {shop.name}
            </Link>
          </div>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-lg font-bold text-foreground">
              Vous pourriez aussi aimer
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  shopSlug={shop.slug}
                  shopId={shop.id}
                  currency={shop.currency}
                  borderRadius={shop.border_radius}
                  cardStyle={shop.card_style}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Boutique propulsée par{" "}
          <a
            href="https://linkboutik.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:text-foreground transition-colors"
          >
            LinkBoutik
          </a>
        </p>
      </footer>

      {/* ── Cart FAB ── */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label={`Panier (${itemCount} article${itemCount !== 1 ? "s" : ""})`}
        className={cn(
          "fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg sm:right-6",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        style={{ backgroundColor: "var(--shop-primary, #6366f1)" }}
      >
        <ShoppingBag className="h-6 w-6 text-white" />
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </button>

      {/* ── Cart drawer ── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        currency={shop.currency}
        shopSlug={shop.slug}
      />
    </div>
  );
}
