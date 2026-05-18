"use client";

import { useState, useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { ShopHeader } from "@/components/shop/shop-header";
import { ProductCard } from "@/components/shop/product-card";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { TEMPLATES } from "@/lib/constants";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";

interface ShopPageProps {
  shop: ShopRow;
  products: ProductRow[];
  categories: CategoryRow[];
}

export function ShopPage({ shop, products, categories }: ShopPageProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const itemCount = useCart((s) => s.getItemCount());

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.id === shop.template_id) ?? TEMPLATES[0],
    [shop.template_id]
  );

  const showSocialLinks = selectedTemplate.config.showSocialLinks;
  const heroStyle = selectedTemplate.config.hero.style;
  const heroVisible = selectedTemplate.config.hero.show;
  const productDisplay = selectedTemplate.id === "artisan" ? "gallery" : selectedTemplate.config.layout;

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const hasCategories = categories.length > 0;

  const productGridClasses =
    productDisplay === "masonry"
      ? "columns-1 space-y-4 sm:columns-2 lg:columns-3"
      : productDisplay === "list"
      ? "grid grid-cols-1 gap-4"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  return (
    // Inject shop theme color as CSS custom property
    <div
      className="min-h-screen bg-background"
      style={{ "--shop-primary": shop.theme_color } as React.CSSProperties}
    >
      {/* ── Shop header: banner, logo, name, bio, socials ── */}
      <ShopHeader shop={shop} showSocialLinks={showSocialLinks} />

      <main className="mx-auto max-w-6xl px-3 sm:px-4 pb-24">
        {heroVisible && (
          <section
            className={cn(
              "mt-6 overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-sm",
              heroStyle === "banner" && "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-700 text-white",
              heroStyle === "split" && "grid gap-4 lg:grid-cols-[1.4fr_1fr] items-center",
              heroStyle === "centered" && "text-center"
            )}
            style={
              heroStyle === "banner"
                ? undefined
                : { borderColor: shop.theme_color }
            }
          >
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                {selectedTemplate.name}
              </p>
              <h2 className={cn(
                "mt-3 text-3xl font-bold tracking-tight sm:text-4xl",
                heroStyle === "banner" ? "text-white" : "text-foreground"
              )}>
                {shop.name}
              </h2>
              {shop.description ? (
                <p className={cn(
                  "mt-3 max-w-3xl text-sm leading-7",
                  heroStyle === "banner" ? "text-slate-200" : "text-muted-foreground"
                )}>
                  {shop.description}
                </p>
              ) : (
                <p className={cn(
                  "mt-3 max-w-3xl text-sm leading-7",
                  heroStyle === "banner" ? "text-slate-200" : "text-muted-foreground"
                )}>
                  Découvre les meilleurs produits de cette boutique.
                </p>
              )}
            </div>

            {heroStyle === "split" && (
              <div className="rounded-3xl bg-slate-50 p-6 text-slate-900 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">À la une</p>
                <p className="mt-3 text-lg font-semibold">
                  Inspiration et sélection spéciale pour ta marque.
                </p>
              </div>
            )}
          </section>
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
                  "transition-all duration-150 whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeCategory === null
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
                style={
                  activeCategory === null
                    ? { backgroundColor: "var(--shop-primary, #6366f1)" }
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
                    "transition-all duration-150 whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeCategory === cat.id
                      ? "border-transparent text-white shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: "var(--shop-primary, #6366f1)" }
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
            className={cn(
              "mt-6 grid gap-3 sm:gap-4",
              productGridClasses
            )}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                shopSlug={shop.slug}
                shopId={shop.id}
                currency={shop.currency}
                layoutStyle={productDisplay}
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
      />
    </div>
  );
}
