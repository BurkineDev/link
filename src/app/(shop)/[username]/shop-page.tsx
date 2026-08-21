"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Share2, ShoppingBag, Sparkles } from "lucide-react";
import { BioProfile, BioSocials } from "@/components/shop/bio-profile";
import {
  BioLinkButton,
  type PublicShopLink,
} from "@/components/shop/bio-link-button";
import { BioProductCard } from "@/components/shop/bio-product-card";
import { BioShareSheet } from "@/components/shop/bio-share-sheet";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { TrackingPixels } from "@/components/shop/tracking-pixels";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import {
  BORDER_RADIUS_CLASS,
  CTA_SHAPE_CLASS,
  FONT_FAMILY_CLASS,
} from "@/lib/constants";
import { bioThemeCssVars, resolveBioTheme } from "@/lib/bio-themes";
import { buildWhatsAppOrderUrl } from "@/lib/utils/whatsapp";
import type { ShopRow, ProductRow, CategoryRow } from "@/lib/types/database";

interface ShopPageProps {
  shop: ShopRow;
  products: ProductRow[];
  categories: CategoryRow[];
  links?: PublicShopLink[];
  /** Absolute URL of this page — used by the share sheet and the QR code. */
  pageUrl: string;
}

type BioTab = "links" | "shop";

/** Deep-link the shop tab: /{slug}#boutique opens straight on the catalogue. */
const SHOP_HASH = "#boutique";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;
/** The hash never reaches the server, so SSR always renders the default tab. */
const noHashOnServer = () => "";

export function ShopPage({
  shop,
  products,
  categories,
  links = [],
  pageUrl,
}: ShopPageProps) {
  const palette = resolveBioTheme(shop);

  const hasLinks = links.length > 0;
  const hasProducts = products.length > 0;

  const [tabOverride, setTabOverride] = useState<BioTab | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const itemCount = useCart((s) => s.getItemCount());

  // The visitor's own choice wins; until they make one, /{slug}#boutique
  // opens straight on the catalogue.
  const hash = useSyncExternalStore(subscribeToHash, readHash, noHashOnServer);
  const tab: BioTab =
    tabOverride ??
    (hasProducts && hash === SHOP_HASH ? "shop" : hasLinks ? "links" : "shop");

  const selectTab = (next: BioTab) => {
    setTabOverride(next);
    const url =
      next === "shop"
        ? `${window.location.pathname}${SHOP_HASH}`
        : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const fontClass = FONT_FAMILY_CLASS[shop.font_family] ?? FONT_FAMILY_CLASS.sans;
  const buttonRadius = CTA_SHAPE_CLASS[shop.cta_shape] ?? CTA_SHAPE_CLASS.rounded;
  const cardRadius = BORDER_RADIUS_CLASS[shop.border_radius] ?? BORDER_RADIUS_CLASS.lg;

  // WhatsApp mode only counts when a usable number exists — otherwise buyers
  // would hit a dead end with no way to order.
  const whatsappUrl =
    shop.checkout_mode === "whatsapp"
      ? buildWhatsAppOrderUrl({
          whatsappNumber: shop.whatsapp_number,
          shopName: shop.name,
          shopUrl: pageUrl,
        })
      : null;
  const isWhatsAppMode = whatsappUrl !== null;

  const showTabs = hasLinks && hasProducts;
  const showCartFab = !isWhatsAppMode && (tab === "shop" || itemCount > 0);

  return (
    <div
      className={cn("relative min-h-dvh", fontClass)}
      style={
        {
          background: palette.background,
          color: palette.text,
          colorScheme: palette.scheme,
          ...bioThemeCssVars(palette),
        } as React.CSSProperties
      }
    >
      <TrackingPixels
        tiktokPixelId={shop.tiktok_pixel_id}
        metaPixelId={shop.meta_pixel_id}
      />

      {/* ── Optional banner, faded into the page background ── */}
      {shop.banner_url && (
        <div className="absolute inset-x-0 top-0 h-44 overflow-hidden sm:h-56">
          <Image
            src={shop.banner_url}
            alt=""
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${palette.backgroundSolid}40, ${palette.backgroundSolid})`,
            }}
          />
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="relative mx-auto flex w-full max-w-[680px] items-center justify-between px-4 pt-4">
        <Link
          href="/"
          aria-label="Bio-Lien"
          className="flex size-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: palette.surface,
            color: palette.surfaceText,
            border: `1px solid ${palette.border}`,
          }}
        >
          <Sparkles className="size-5" />
        </Link>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Partager cette page"
          className="flex size-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: palette.surface,
            color: palette.surfaceText,
            border: `1px solid ${palette.border}`,
          }}
        >
          <Share2 className="size-5" />
        </button>
      </div>

      <main className="relative mx-auto w-full max-w-[680px] px-4 pb-32 pt-5">
        <BioProfile shop={shop} palette={palette} />

        {/* ── Liens / Boutique switch ── */}
        {showTabs && (
          <div
            role="tablist"
            aria-label="Sections de la page"
            className="mx-auto mt-6 grid w-full max-w-xs grid-cols-2 rounded-full p-1"
            style={{
              backgroundColor:
                palette.buttonVariant === "shadow"
                  ? palette.border
                  : `color-mix(in oklab, ${palette.text} 16%, transparent)`,
            }}
          >
            {(
              [
                { value: "links", label: "Liens" },
                { value: "shop", label: "Boutique" },
              ] as const
            ).map((entry) => {
              const selected = tab === entry.value;
              return (
                <button
                  key={entry.value}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(entry.value)}
                  className={cn(
                    "rounded-full py-2.5 text-sm font-semibold transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2",
                    !selected && "opacity-70 hover:opacity-100",
                  )}
                  style={
                    {
                      backgroundColor: selected ? palette.surface : "transparent",
                      color: selected ? palette.surfaceText : palette.text,
                      boxShadow: selected ? "0 1px 3px rgba(0,0,0,.12)" : undefined,
                      "--tw-ring-color": palette.text,
                    } as React.CSSProperties
                  }
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Links tab ── */}
        {tab === "links" && (
          <ul className="mt-6 flex flex-col gap-3">
            {links.map((link) => (
              <BioLinkButton
                key={link.id}
                link={link}
                palette={palette}
                radiusClass={buttonRadius}
                pageUrl={pageUrl}
              />
            ))}
          </ul>
        )}

        {/* ── Shop tab ── */}
        {tab === "shop" && (
          <>
            {categories.length > 0 && hasProducts && (
              <div
                className="mt-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                role="tablist"
                aria-label="Catégories"
              >
                {[{ id: null, name: "Tout" }, ...categories].map((cat) => {
                  const selected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id ?? "all"}
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
                        "transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2",
                        !selected && "opacity-70 hover:opacity-100",
                      )}
                      style={
                        {
                          backgroundColor: selected
                            ? palette.surface
                            : `color-mix(in oklab, ${palette.text} 12%, transparent)`,
                          color: selected ? palette.surfaceText : palette.text,
                          "--tw-ring-color": palette.text,
                        } as React.CSSProperties
                      }
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <BioProductCard
                    key={product.id}
                    product={product}
                    shopSlug={shop.slug}
                    shopId={shop.id}
                    shopName={shop.name}
                    currency={shop.currency}
                    palette={palette}
                    radiusClass={cardRadius}
                    whatsappNumber={isWhatsAppMode ? shop.whatsapp_number : null}
                    pageUrl={pageUrl}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShoppingBag className="size-6" />}
                title={
                  activeCategory
                    ? "Rien dans cette catégorie"
                    : "La boutique arrive bientôt"
                }
                description={
                  activeCategory
                    ? "Choisis une autre catégorie pour voir les produits."
                    : "Aucun produit n'est encore en ligne ici."
                }
                surface={palette.surface}
                surfaceText={palette.surfaceText}
                muted={palette.muted}
              />
            )}
          </>
        )}

        {/* ── Nothing published at all ── */}
        {!hasLinks && !hasProducts && (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Cette page est toute neuve"
            description="Le vendeur n'a pas encore publié de liens ni de produits."
            surface={palette.surface}
            surfaceText={palette.surfaceText}
            muted={palette.muted}
          />
        )}

        <BioSocials
          socialLinks={shop.social_links}
          palette={palette}
          className="mt-8"
        />

        {/* ── Growth loop: every visitor is a potential seller ── */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/register"
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold",
              "transition-transform hover:scale-[1.02] active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2",
            )}
            style={
              {
                backgroundColor: palette.surface,
                color: palette.surfaceText,
                border: `1px solid ${palette.border}`,
                "--tw-ring-color": palette.text,
              } as React.CSSProperties
            }
          >
            <Sparkles className="size-4" />
            Crée ta page sur Bio-Lien
          </Link>
        </div>
      </main>

      {/* ── Floating order CTA ── */}
      {isWhatsAppMode ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Commander sur WhatsApp"
          className={cn(
            "fixed bottom-5 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-5 shadow-lg sm:right-6",
            "transition-transform duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          )}
          style={{ backgroundColor: "#25D366" }}
        >
          <MessageCircle className="size-5 text-white" />
          <span className="text-sm font-semibold text-white">Commander</span>
        </a>
      ) : (
        showCartFab && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Panier (${itemCount} article${itemCount !== 1 ? "s" : ""})`}
            className={cn(
              "fixed bottom-5 right-4 z-40 flex size-14 items-center justify-center rounded-full shadow-lg sm:right-6",
              "transition-transform duration-150 active:scale-95",
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
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>
        )
      )}

      {!isWhatsAppMode && (
        <CartDrawer
          open={cartOpen}
          onOpenChange={setCartOpen}
          currency={shop.currency}
          shopSlug={shop.slug}
        />
      )}

      <BioShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={pageUrl}
        title={shop.name}
        subtitle={`Partager la page de ${shop.name}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  description,
  surface,
  surfaceText,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  surface: string;
  surfaceText: string;
  muted: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-full"
        style={{ backgroundColor: surface, color: surfaceText }}
        aria-hidden
      >
        {icon}
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-xs text-sm" style={{ color: muted }}>
        {description}
      </p>
    </div>
  );
}
