"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VariantSelector } from "@/components/shop/variant-selector";
import { BioProductCard } from "@/components/shop/bio-product-card";
import { BioShareSheet } from "@/components/shop/bio-share-sheet";
import { ProductVectorIllustration } from "@/components/shop/product-vector-illustration";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { BORDER_RADIUS_CLASS, FONT_FAMILY_CLASS } from "@/lib/constants";
import {
  primaryActionColor,
  readableTextOn,
  resolveBioTheme,
  withAlpha,
} from "@/lib/bio-themes";
import { buildWhatsAppOrderUrl } from "@/lib/utils/whatsapp";
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
  /** Absolute URL of this product page — share sheet, QR and WhatsApp message. */
  pageUrl: string;
  /** Absolute URL of the shop's bio page, for the related-product cards. */
  shopUrl: string;
}

/**
 * Product detail, painted in the shop's bio-page palette.
 *
 * A buyer arrives here by tapping a product on /{slug}, so the page keeps the
 * same background, the same surfaces and the same top bar: the content sits on
 * a surface card, which is what guarantees the text stays readable whatever
 * theme the seller picked.
 */
export function ProductPage({
  shop,
  product,
  variants,
  related,
  pageUrl,
  shopUrl,
}: ProductPageProps) {
  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariantRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const addItem = useCart((s) => s.addItem);
  const itemCount = useCart((s) => s.getItemCount());

  const palette = resolveBioTheme(shop);
  const fontClass = FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;
  const radiusClass = BORDER_RADIUS_CLASS[shop.border_radius] ?? BORDER_RADIUS_CLASS.lg;

  const actionFill = primaryActionColor(palette);
  const actionInk = readableTextOn(actionFill);
  const hairline = withAlpha(palette.surfaceText, 0.15);

  const surfaceStyle: React.CSSProperties = {
    backgroundColor: palette.surface,
    color: palette.surfaceText,
    border: `1px solid ${palette.border}`,
    backdropFilter:
      palette.buttonVariant === "glass" ? "blur(12px)" : undefined,
  };

  const images = product.images ?? [];
  const mainImage = images[activeImage] ?? images[0];

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

  // WhatsApp mode only when a usable number exists; otherwise fall back to
  // the cart so the product is never a dead end (mirrors the bio page).
  const whatsAppUrl =
    shop.checkout_mode === "whatsapp"
      ? buildWhatsAppOrderUrl({
          whatsappNumber: shop.whatsapp_number,
          shopName: shop.name,
          productName: product.name,
          price: effectivePrice,
          currency: product.currency,
          variantLabel,
          quantity,
          shopUrl: pageUrl,
        })
      : null;
  const isWhatsAppMode = whatsAppUrl !== null;

  return (
    <div
      className={cn("min-h-dvh", fontClass)}
      style={{
        background: palette.background,
        color: palette.text,
        colorScheme: palette.scheme,
      }}
    >
      {/* ── Top bar: back to the bio page, share this product ── */}
      <div className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-3 px-4 pt-4 lg:max-w-5xl">
        <Link
          href={`/${shop.slug}`}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full py-2 pl-2 pr-4",
            "transition-transform hover:scale-[1.02] active:scale-95",
          )}
          style={{
            backgroundColor: palette.surface,
            color: palette.surfaceText,
            border: `1px solid ${palette.border}`,
          }}
        >
          <ChevronLeft className="size-5 shrink-0" />
          <span className="truncate text-sm font-semibold">{shop.name}</span>
        </Link>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Partager ce produit"
          className="flex size-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: palette.surface,
            color: palette.surfaceText,
            border: `1px solid ${palette.border}`,
          }}
        >
          <Share2 className="size-5" />
        </button>
      </div>

      <main className="mx-auto w-full max-w-[680px] px-4 pb-32 pt-4 lg:max-w-5xl">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          {/* ── Gallery ── */}
          <div className="space-y-3">
            <div
              className={cn("relative aspect-square w-full overflow-hidden", radiusClass)}
              style={surfaceStyle}
            >
              {mainImage?.url ? (
                <Image
                  src={mainImage.url}
                  alt={mainImage.alt ?? product.name}
                  fill
                  preload
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="object-cover"
                />
              ) : (
                <ProductVectorIllustration
                  name={product.name}
                  description={product.description ?? ""}
                />
              )}

              <div className="absolute left-3 top-3 flex flex-col gap-2">
                {isOutOfStock && (
                  <span className="rounded-lg bg-black/75 px-2.5 py-1 text-xs font-semibold text-white">
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

            {/* Thumbnails — only worth the space when there is a choice */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {images.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Voir l'image ${index + 1}`}
                    aria-pressed={index === activeImage}
                    className={cn(
                      "relative size-16 shrink-0 overflow-hidden transition-opacity",
                      radiusClass,
                      index === activeImage ? "opacity-100" : "opacity-60 hover:opacity-100",
                    )}
                    style={{
                      border: `2px solid ${index === activeImage ? actionFill : "transparent"}`,
                    }}
                  >
                    <Image
                      src={image.url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details card ── */}
          <div
            className={cn("flex flex-col gap-5 p-5 sm:p-6", radiusClass)}
            style={surfaceStyle}
          >
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold">
                {formatPrice(effectivePrice, product.currency)}
              </span>
              {isOnSale && (
                <>
                  <span className="text-lg line-through opacity-60">
                    {formatPrice(product.compare_price!, product.currency)}
                  </span>
                  <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-sm font-semibold text-white">
                    −
                    {Math.round(
                      ((product.compare_price! - product.price) /
                        product.compare_price!) *
                        100,
                    )}
                    %
                  </span>
                </>
              )}
            </div>

            {product.has_variants && variants.length > 0 && (
              <VariantSelector
                variants={variants}
                selectedVariantId={selectedVariant?.id ?? null}
                onSelect={setSelectedVariant}
                basePrice={product.price}
                currency={product.currency}
                palette={palette}
              />
            )}

            {/* Quantity */}
            <div>
              <p className="mb-2 text-sm font-medium">Quantité</p>
              <div
                className="flex w-fit items-center overflow-hidden rounded-xl"
                style={{ border: `1px solid ${hairline}` }}
              >
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label="Diminuer la quantité"
                  className="flex size-11 items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-30"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="flex h-11 min-w-12 items-center justify-center px-3 text-sm font-semibold tabular-nums"
                  style={{ borderInline: `1px solid ${hairline}` }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Augmenter la quantité"
                  className="flex size-11 items-center justify-center transition-opacity hover:opacity-70"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* CTAs */}
            {isWhatsAppMode ? (
              <a
                href={isOutOfStock ? undefined : whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={isOutOfStock}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white",
                  "transition-transform active:scale-[0.99]",
                  isOutOfStock && "pointer-events-none opacity-50",
                )}
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="size-5" />
                {isOutOfStock ? "Épuisé" : "Commander sur WhatsApp"}
              </a>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className={cn(
                    "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold",
                    "transition-transform active:scale-[0.99] disabled:opacity-50",
                  )}
                  style={{ backgroundColor: actionFill, color: actionInk }}
                >
                  <ShoppingBag className="size-5" />
                  {isOutOfStock ? "Épuisé" : "Ajouter au panier"}
                </button>

                {!isOutOfStock && (
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className={cn(
                      "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold",
                      "transition-transform active:scale-[0.99]",
                    )}
                    style={{
                      color: palette.surfaceText,
                      border: `2px solid ${actionFill}`,
                    }}
                  >
                    <Zap className="size-5" />
                    Acheter maintenant
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="pt-2" style={{ borderTop: `1px solid ${hairline}` }}>
                <h2 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-wide opacity-70">
                  Description
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Related ── */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold">Ça pourrait aussi te plaire</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {related.map((item) => (
                <BioProductCard
                  key={item.id}
                  product={item}
                  shopSlug={shop.slug}
                  shopId={shop.id}
                  shopName={shop.name}
                  currency={shop.currency}
                  palette={palette}
                  radiusClass={radiusClass}
                  whatsappNumber={isWhatsAppMode ? shop.whatsapp_number : null}
                  pageUrl={shopUrl}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Back + growth CTA ── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href={`/${shop.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
          >
            <ChevronLeft className="size-4" />
            Retour à {shop.name}
          </Link>

          <Link
            href="/register"
            className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.border}`,
            }}
          >
            <Sparkles className="size-4" />
            Crée ta page sur Bio-Lien
          </Link>
        </div>
      </main>

      {/* ── Cart FAB + drawer: online checkout mode only ── */}
      {!isWhatsAppMode && (
        <>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Panier (${itemCount} article${itemCount !== 1 ? "s" : ""})`}
            className={cn(
              "fixed bottom-5 right-4 z-40 flex size-14 items-center justify-center rounded-full shadow-lg sm:right-6",
              "transition-transform duration-150 hover:scale-105 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            )}
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.border}`,
            }}
          >
            <ShoppingBag className="size-6" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>

          <CartDrawer
            open={cartOpen}
            onOpenChange={setCartOpen}
            currency={shop.currency}
            shopSlug={shop.slug}
          />
        </>
      )}

      <BioShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={pageUrl}
        title={product.name}
        subtitle={`Partager « ${product.name} »`}
      />
    </div>
  );
}
