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
import type { BioPalette } from "@/lib/bio-themes";

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
function trackClick(linkId: string) {
  const endpoint = `/api/shop-links/${linkId}/click`;
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
}

export function BioLinkButton({
  link,
  palette,
  radiusClass,
  pageUrl,
}: BioLinkButtonProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMounted, setShareMounted] = useState(false);

  const Icon = ICONS[link.icon] ?? ICONS.custom;
  const external = isExternal(link.url);

  const surfaceStyle: React.CSSProperties = (() => {
    switch (palette.buttonVariant) {
      case "outline":
        return {
          backgroundColor: "transparent",
          color: palette.text,
          border: `2px solid ${palette.text}`,
        };
      case "shadow":
        return {
          backgroundColor: palette.surface,
          color: palette.surfaceText,
          border: `1px solid ${palette.border}`,
          boxShadow: `0 3px 0 0 ${palette.border}`,
        };
      case "glass":
        return {
          backgroundColor: palette.surface,
          color: palette.surfaceText,
          border: `1px solid ${palette.border}`,
          backdropFilter: "blur(12px)",
        };
      default:
        return {
          backgroundColor: palette.surface,
          color: palette.surfaceText,
          border: "1px solid transparent",
        };
    }
  })();

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
          style={{
            backgroundColor:
              palette.buttonVariant === "outline"
                ? "transparent"
                : `color-mix(in oklab, currentColor 10%, transparent)`,
          }}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
      )}

      <span className="min-w-0 flex-1 truncate px-1 text-center text-[15px] font-semibold">
        {link.label}
      </span>

      {/* Keeps the label optically centred behind the share button. */}
      <span className="size-12 shrink-0" aria-hidden />
    </>
  );

  const sharedClasses = cn(
    "flex w-full items-center gap-2 p-2",
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
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick(link.id)}
          className={sharedClasses}
          style={focusRing}
        >
          {body}
        </a>
      ) : (
        <Link
          href={link.url}
          onClick={() => trackClick(link.id)}
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
