"use client";

import Image from "next/image";
import Link from "next/link";
import { Loader2, MessageCircle, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ProductVectorIllustration } from "@/components/shop/product-vector-illustration";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { formatPrice, splitPriceSymbol } from "@/lib/utils/format";
import { buildWhatsAppOrderUrl } from "@/lib/utils/whatsapp";
import { useWhatsAppOrder } from "@/components/shop/whatsapp-order-button";
import {
  bioCardStyle,
  bioPriceBadgeStyle,
  bioSurfaceMutedOn,
  primaryActionColor,
  readableTextOn,
  whatsappButtonStyle,
  type BioPalette,
} from "@/lib/bio-themes";
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
  /**
   * Le panier n'est montré que si la page le permet : vente en ligne, ou
   * repli sans numéro WhatsApp quand la caisse Bio-Lien est rallumée. À
   * `false` sans numéro WhatsApp valide, la carte ne montre aucun bouton
   * d'achat : mieux vaut rien qu'un « + » qui mène à une caisse fermée.
   * `true` par défaut pour ne rien changer aux appelants existants.
   */
  cartEnabled?: boolean;
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
  cartEnabled = true,
}: BioProductCardProps) {
  const addItem = useCart((s) => s.addItem);

  const decor = palette.decor;
  // La carte peut ne pas suivre `surface` (Wax : blanche sous des boutons
  // cobalt) : tout ce qui se pose dessus est choisi contre sa vraie couleur.
  const cardStyle = bioCardStyle(palette);
  const cardBg = decor?.card?.bg ?? palette.surface;
  // The theme accent is tuned against the page background; on the card it can
  // wash out, so the add button uses the surface-aware action colour.
  const actionFill = primaryActionColor(palette, cardBg);
  const priceBadge = bioPriceBadgeStyle(palette);
  const smallText = bioSurfaceMutedOn(palette, cardBg);

  const primaryImage = product.images?.[0];
  const effectiveCurrency = product.currency ?? currency;
  const isOutOfStock =
    product.stock_quantity !== null && product.stock_quantity <= 0;
  const isOnSale =
    product.compare_price !== null && product.compare_price > product.price;

  const whatsappOrder = useWhatsAppOrder();
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
      isDigital: product.is_digital,
    });

    toast.success("Ajouté au panier", {
      description: product.name,
      icon: <ShoppingBag className="h-4 w-4" />,
    });
  }

  const price = splitPriceSymbol(formatPrice(product.price, effectiveCurrency));

  // « Commander » en toutes lettres et pleine largeur, sur tous les thèmes :
  // une icône seule de 44 px ne disait pas ce qu'elle faisait, et le vert
  // WhatsApp reste le vert WhatsApp (jamais thémé), avec l'encre qui lit
  // dessus. Rendu sous le prix, pas à côté : le mot a besoin de la largeur.
  const showOrder = !isOutOfStock && !product.has_variants && whatsappUrl !== null;

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
          ...cardStyle,
          "--tw-ring-color": palette.text,
          "--tw-ring-offset-color": palette.backgroundSolid,
        } as React.CSSProperties
      }
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        // Avec décor, un filet sépare la photo du corps : une photo à fond
        // blanc paraîtrait « sale » posée directement sur le sable ou l'écru.
        style={decor ? { borderBottom: `1px solid ${palette.border}` } : undefined}
      >
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            quality={45}
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
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                !decor?.highlight && "bg-rose-500 text-white",
              )}
              // Sur un thème à décor, la promo porte la couleur de rehaut du
              // thème (ocre, moutarde) plutôt qu'un rose hors palette.
              style={
                decor?.highlight
                  ? {
                      backgroundColor: decor.highlight.bg,
                      color: decor.highlight.text,
                    }
                  : undefined
              }
            >
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
          {/* `gap-1` n'aère que la pastille : sans décor, la colonne garde
              son espacement historique entre le prix et le prix barré. */}
          <div className={cn("flex min-w-0 flex-col items-start", decor && "gap-1")}>
            {priceBadge ? (
              // La pastille de prix : chiffres en police d'affiche et
              // tabulaires, « FCFA » en petit — un objet typographique qui
              // se lit en plein soleil. Elle peut se replier : quand le « + »
              // du panier lui prend la place, « FCFA » passe à la ligne DANS
              // la pastille plutôt que d'en sortir en crème sur crème.
              <span
                className="inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 rounded-md px-2 py-1 leading-none"
                style={priceBadge}
              >
                <span className="text-[17px] font-bold">{price.amount}</span>
                {price.symbol && (
                  // Le symbole reste en police de corps : en Ojuju, « FCFA »
                  // se lisait « FCFR ». Sans variable (police du vendeur),
                  // il hérite comme les chiffres.
                  <span
                    className="text-xs font-bold tracking-wide"
                    style={{ fontFamily: "var(--bio-font-body, inherit)" }}
                  >
                    {price.symbol}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-sm font-bold">
                {formatPrice(product.price, effectiveCurrency)}
              </span>
            )}
            {isOnSale && (
              <span
                className={cn("text-xs line-through", !decor && "opacity-60")}
                style={decor ? { color: smallText } : undefined}
              >
                {formatPrice(product.compare_price!, effectiveCurrency)}
              </span>
            )}
          </div>

          {isOutOfStock ? null : product.has_variants ? (
            // À côté du prix historique ; sous la pastille, plus large, la
            // mention passe à la ligne suivante (voir plus bas).
            priceBadge ? null : (
              <span className="text-[11px] font-medium opacity-70">
                Voir options
              </span>
            )
          ) : whatsappUrl ? null : cartEnabled ? (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Ajouter ${product.name} au panier`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform active:scale-95"
              style={{
                backgroundColor: actionFill,
                color: readableTextOn(actionFill),
              }}
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>

        {priceBadge && product.has_variants && !isOutOfStock && (
          <span className="text-[11px] font-medium" style={{ color: smallText }}>
            Voir options
          </span>
        )}

        {showOrder && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void whatsappOrder.start({
                shopId,
                items: [{ product_id: product.id, variant_id: null, quantity: 1 }],
                fallbackUrl: whatsappUrl!,
              });
            }}
            // Pas de `disabled` : un clic sur un bouton désactivé remonterait
            // au Link de la carte. Le hook ignore les taps répétés.
            aria-disabled={whatsappOrder.busy}
            aria-busy={whatsappOrder.busy}
            aria-label={
              whatsappOrder.busy
                ? "Ouverture de WhatsApp…"
                : `Commander ${product.name} sur WhatsApp`
            }
            // 44 px de haut : le bouton est emboîté dans le Link de la carte,
            // un pouce qui tape à côté ouvrirait la fiche au lieu de WhatsApp.
            className={cn(
              "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold",
              "transition-transform active:scale-[0.98]",
              whatsappOrder.busy && "cursor-wait opacity-70",
            )}
            style={whatsappButtonStyle("inline")}
          >
            {whatsappOrder.busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="size-4" aria-hidden="true" />
            )}
            Commander
          </button>
        )}
      </div>
    </Link>
  );
}
