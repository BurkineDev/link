"use client";

import { useState, useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { ShopHeader } from "@/components/shop/shop-header";
import { ProductCard } from "@/components/shop/product-card";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { ShopLinks, type PublicShopLink } from "@/components/shop/shop-links";
import { TrackingPixels } from "@/components/shop/tracking-pixels";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { FONT_FAMILY_CLASS } from "@/lib/constants";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";

interface ShopPageProps {
  shop: ShopRow;
  products: ProductRow[];
  categories: CategoryRow[];
  links?: PublicShopLink[];
}

/**
 * Per-template grid layout. Falls back to the standard 2/3/4-column grid
 * when the shop's template_id isn't recognised.
 */
const TEMPLATE_GRIDS: Record<string, string> = {
  minimal:  "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4",
  boutique: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6",
  market:   "grid-cols-1 sm:grid-cols-2 gap-3",
  artisan:  "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-5",
};

const DEFAULT_GRID = TEMPLATE_GRIDS.minimal;

export function ShopPage({ shop, products, categories, links = [] }: ShopPageProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const itemCount = useCart((s) => s.getItemCount());

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const hasCategories = categories.length > 0;
  const templateGrid = TEMPLATE_GRIDS[shop.template_id ?? ""] ?? DEFAULT_GRID;
  const fontClass =
    FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;

  return (
    // Inject all shop theming as CSS custom properties so any descendant
    // (cards, buttons, FAB) can consume them via var(--shop-*).
    <div
      className={cn("min-h-screen bg-background", fontClass)}
      style={
        {
          "--shop-primary": shop.theme_color,
          "--shop-accent": shop.accent_color,
        } as React.CSSProperties
      }
    >
      {/* ── Retargeting pixels ── */}
      <TrackingPixels
        tiktokPixelId={shop.tiktok_pixel_id}
        metaPixelId={shop.meta_pixel_id}
      />

      {/* ── Shop header: banner, logo, name, bio, socials ── */}
      <ShopHeader shop={shop} />

      <main className="mx-auto max-w-6xl px-3 sm:px-4 pb-24">
        {/* ── Linktree-style CTA links ── */}
        {links.length > 0 && (
          <div className="mt-4 sm:mt-6">
            <ShopLinks
              links={links}
              primaryColor={shop.theme_color}
              accentColor={shop.accent_color}
              ctaShape={shop.cta_shape}
              ctaStyle={shop.cta_style}
            />
          </div>
        )}

        {/* ── Category filter tabs ── */}
        {hasCategories && (
          <div className="mt-6 mb-2">
            <div
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
              role="tablist"
              aria-label="Catégories"
            >
              <button
                role="tab"
                aria-selected={activeCategory === null}
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
                  "transition-colors duration-150 whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeCategory === null
                    ? "border-transparent text-white"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
                style={
                  activeCategory === null
                    ? { backgroundColor: "var(--shop-primary, var(--primary))" }
                    : undefined
                }
              >
                Tout
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
                    "transition-colors duration-150 whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeCategory === cat.id
                      ? "border-transparent text-white"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: "var(--shop-primary, var(--primary))" }
                      : undefined
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Products grid ── */}
        {filteredProducts.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Aucun produit</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCategory
                  ? "Aucun produit dans cette catégorie pour l'instant."
                  : "Cette boutique n'a pas encore de produits."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={cn("mt-6 grid", templateGrid)}
            data-template={shop.template_id ?? "minimal"}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                shopSlug={shop.slug}
                shopId={shop.id}
                currency={shop.currency}
                borderRadius={shop.border_radius}
                cardStyle={shop.card_style}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Boutique propulsée par{" "}
          <a
            href="https://www.bio-lien.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:text-foreground transition-colors"
          >
            Bio-Lien
          </a>
        </p>
      </footer>

      {/* ── Cart FAB ── */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label={`Panier (${itemCount} article${itemCount !== 1 ? "s" : ""})`}
        className={cn(
          "fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-md sm:right-6",
          "transition-transform duration-150 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        style={{ backgroundColor: "var(--shop-primary, var(--primary))" }}
      >
        <ShoppingBag className="h-6 w-6 text-white" />
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
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
