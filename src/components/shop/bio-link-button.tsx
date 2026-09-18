"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Globe,
  Mail,
  MessageCircle,
  MoreVertical,
  Phone,
  Send,
  ShoppingBag,
  Link2,
} from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  SnapchatIcon,
  TikTokIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/shop/brand-icons";
import { cn } from "@/lib/utils";
import { CTA_SHAPE_CLASS } from "@/lib/constants";
import {
  bioButtonStyle,
  bioSurfaceMutedOn,
  contrastRatio,
  type BioPalette,
} from "@/lib/bio-themes";
import { SmartAppLink } from "@/components/shop/smart-app-link";
import { blockGoHref } from "@/lib/blocks/ids";
import { linkSubtitle } from "@/lib/links/subtitle";

// Per-link sharing is a rare tap on a page that must paint fast — load the
// dialog only when someone actually reaches for it.
const BioShareSheet = dynamic(() =>
  import("@/components/shop/bio-share-sheet").then((m) => m.BioShareSheet),
);

export type PublicShopLink = {
  id: string;
  label: string;
  url: string;
  icon: string;
  thumbnail_url: string | null;
  position: number;
};

const ICONS: Record<string, React.ElementType> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  snapchat: SnapchatIcon,
  x: XIcon,
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
  phone: Phone,
  website: Globe,
  shop: ShoppingBag,
  custom: Link2,
};

function isExternal(url: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(url);
}

/**
 * Counts the tap without delaying navigation.
 *
 * `sendBeacon` is the right primitive here: the browser hands the request to
 * the network stack and lets the page unload immediately, which matters on the
 * 3G connections most of these pages are opened on. `keepalive` fetch is the
 * fallback for the few browsers without it.
 */
function trackClick(endpoint: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint);
      return;
    }
    void fetch(endpoint, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never break the actual navigation.
  }
}

interface BioLinkButtonProps {
  link: PublicShopLink;
  palette: BioPalette;
  /** Tailwind radius class derived from the shop's CTA shape. */
  radiusClass: string;
  /** Absolute page URL — used as the base of the share sheet. */
  pageUrl: string;
  /**
   * Where to count the tap. A button rendered from a stored block counts on
   * `page_blocks`, one synthesised from `shop_links` on its original row —
   * the caller knows which, this component doesn't have to.
   */
  clickEndpoint?: string;
}

export function BioLinkButton({
  link,
  palette,
  radiusClass,
  pageUrl,
  clickEndpoint,
}: BioLinkButtonProps) {
  const endpoint = clickEndpoint ?? `/api/shop-links/${link.id}/click`;
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMounted, setShareMounted] = useState(false);

  const Icon = ICONS[link.icon] ?? ICONS.custom;
  const external = isExternal(link.url);
  // Sous le titre, où ça mène : « @la_philosophia », « maboutique.com ».
  const subtitle = linkSubtitle(link.url, link.label);
  // Les liens web portent leur route serveur /go/<id> : sur Android, avant
  // hydratation, le script inline y envoie le tap (décision app/web et clic
  // comptés côté serveur). Une fois hydraté, tout se passe ici.
  const viaGo = /^https?:/i.test(link.url);

  const decor = palette.decor;
  // Une seule implémentation du style de bouton, partagée avec les aperçus
  // du tableau de bord ; la lisière du Pagne tissé s'efface en forme pilule.
  const surfaceStyle = bioButtonStyle(palette, {
    pill: radiusClass === CTA_SHAPE_CLASS.pill,
  });
  // Ce sur quoi le sous-titre est posé : la page pour un bouton contour,
  // la surface pour les autres.
  const subtitleOn =
    palette.buttonVariant === "outline"
      ? palette.backgroundSolid
      : palette.surface;
  // Tuile d'icône : sur un thème à décor dont les boutons sont un aplat
  // franc sur page claire (Wax : cobalt sur crème), la tuile s'inverse en
  // disque du fond de page avec l'icône couleur bouton ; sur des boutons
  // clairs bordés (Pagne tissé), elle se teinte de l'accent ; partout
  // ailleurs, le rendu historique (10 % de la couleur courante).
  const invertedTile =
    Boolean(decor) &&
    palette.scheme === "light" &&
    contrastRatio(palette.surface, palette.backgroundSolid) >= 3;
  const accentTile = !invertedTile && decor?.buttonBorder === "bold";

  const body = (
    <>
      {/* Thumbnail — the visual anchor that makes a row scannable. */}
      {link.thumbnail_url ? (
        // Seller-supplied https URLs from arbitrary hosts can't be whitelisted
        // in next.config, so this stays a plain <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.thumbnail_url}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className={cn("size-12 shrink-0 object-cover", radiusClass)}
        />
      ) : (
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center",
            radiusClass,
          )}
          style={
            invertedTile
              ? {
                  backgroundColor: palette.backgroundSolid,
                  color: palette.surface,
                }
              : accentTile
                ? {
                    backgroundColor: `color-mix(in oklab, ${palette.accent} 10%, transparent)`,
                    color: palette.accent,
                  }
                : {
                    backgroundColor:
                      palette.buttonVariant === "outline"
                        ? "transparent"
                        : `color-mix(in oklab, currentColor 10%, transparent)`,
                  }
          }
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
        {/* Avec décor, le titre tient sur deux lignes (« Prendre rendez-vous
            à l'atelier » était tronqué) et le sous-titre s'écrit en couleur
            plutôt qu'en opacité, qui tombait sous 4,5:1 au soleil. */}
        <span
          className={cn(
            "w-full text-[15px] font-semibold",
            decor ? "line-clamp-2 leading-snug" : "truncate",
          )}
        >
          {link.label}
        </span>
        {subtitle && (
          <span
            className={cn(
              "w-full truncate font-medium",
              decor ? "text-[13px]" : "text-xs opacity-60",
            )}
            style={decor ? { color: bioSurfaceMutedOn(palette, subtitleOn) } : undefined}
          >
            {subtitle}
          </span>
        )}
      </span>

      {/* Keeps the label optically centred behind the share button. */}
      <span className="size-12 shrink-0" aria-hidden />
    </>
  );

  const sharedClasses = cn(
    "flex min-h-16 w-full items-center gap-2 p-2",
    // La lisière de 5 px du Pagne tissé mordrait sur la tuile d'icône.
    decor?.selvedge && radiusClass !== CTA_SHAPE_CLASS.pill && "pl-3",
    "transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    radiusClass,
  );

  const focusRing = {
    ...surfaceStyle,
    ["--tw-ring-color" as string]: palette.text,
    ["--tw-ring-offset-color" as string]: palette.backgroundSolid,
  } as React.CSSProperties;

  return (
    <li className="relative">
      {external ? (
        <SmartAppLink
          href={link.url}
          goHref={viaGo ? blockGoHref(link.id) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          // Une fois hydraté, l'ancre directe ou le tap intercepté passent
          // ici : on compte côté client. Avant hydratation, le script inline
          // envoie vers /go, qui compte côté serveur.
          onClick={() => trackClick(endpoint)}
          className={sharedClasses}
          style={focusRing}
        >
          {body}
        </SmartAppLink>
      ) : (
        <Link
          href={link.url}
          onClick={() => trackClick(endpoint)}
          className={sharedClasses}
          style={focusRing}
        >
          {body}
        </Link>
      )}

      {/* Per-link share — a visitor can forward one button, not just the page. */}
      <button
        type="button"
        onClick={() => {
          setShareMounted(true);
          setShareOpen(true);
        }}
        aria-label={`Partager le lien ${link.label}`}
        className={cn(
          "absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
          "opacity-60 transition-opacity hover:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2",
        )}
        style={{
          color:
            palette.buttonVariant === "outline"
              ? palette.text
              : palette.surfaceText,
          ["--tw-ring-color" as string]: palette.text,
        } as React.CSSProperties}
      >
        <MoreVertical className="size-5" />
      </button>

      {shareMounted && (
        <BioShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          url={external ? link.url : `${pageUrl}${link.url}`}
          title={link.label}
          subtitle={`Partager « ${link.label} »`}
        />
      )}
    </li>
  );
}
