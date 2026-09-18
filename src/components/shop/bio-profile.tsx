"use client";

import Image from "next/image";
import { BadgeCheck, Globe, MessageCircle } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/shop/brand-icons";
import { SmartAppLink } from "@/components/shop/smart-app-link";
import { cn } from "@/lib/utils";
import {
  bioAvatarInitialsStyle,
  bioAvatarRingStyle,
  bioSocialRingStyle,
  type BioPalette,
} from "@/lib/bio-themes";
import type { ShopRow, SocialLinks } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

const SOCIALS: Array<{
  key: keyof SocialLinks;
  label: string;
  icon: React.ElementType;
  href: (value: string) => string;
}> = [
  {
    key: "instagram",
    label: "Instagram",
    icon: InstagramIcon,
    href: (v) =>
      v.startsWith("http") ? v : `https://instagram.com/${v.replace("@", "")}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: TikTokIcon,
    href: (v) =>
      v.startsWith("http") ? v : `https://tiktok.com/@${v.replace("@", "")}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: YoutubeIcon,
    href: (v) => (v.startsWith("http") ? v : `https://youtube.com/@${v}`),
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: FacebookIcon,
    href: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`),
  },
  {
    key: "twitter",
    label: "X",
    icon: XIcon,
    href: (v) =>
      v.startsWith("http") ? v : `https://x.com/${v.replace("@", "")}`,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    href: (v) => `https://wa.me/${v.replace(/\D/g, "")}`,
  },
  {
    key: "website",
    label: "Site web",
    icon: Globe,
    href: (v) => (v.startsWith("http") ? v : `https://${v}`),
  },
];

export function BioSocials({
  socialLinks,
  palette,
  className,
}: {
  socialLinks: SocialLinks | null;
  palette: BioPalette;
  className?: string;
}) {
  const links = socialLinks ?? {};
  const active = SOCIALS.filter((s) => {
    const value = links[s.key];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (active.length === 0) return null;

  // Cercles bordés sur un thème à décor, icônes nues sinon.
  const ring = bioSocialRingStyle(palette);

  return (
    <nav
      aria-label="Réseaux sociaux"
      className={cn(
        "flex flex-wrap items-center justify-center",
        // Des cercles bordés respirent mieux que des icônes nues.
        ring ? "gap-2.5" : "gap-1",
        className,
      )}
    >
      {active.map((social) => {
        const Icon = social.icon;
        return (
          <SmartAppLink
            key={social.key}
            href={social.href(links[social.key]!.trim())}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              "transition-transform duration-150 hover:scale-110 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2",
            )}
            style={
              {
                color: palette.text,
                ...ring,
                "--tw-ring-color": palette.text,
              } as React.CSSProperties
            }
          >
            <Icon className="size-6" />
          </SmartAppLink>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function isFeatured(featuredUntil: string | null): boolean {
  if (!featuredUntil) return false;
  return new Date(featuredUntil).getTime() > Date.now();
}

export function BioProfile({
  shop,
  palette,
  className,
  style,
}: {
  shop: ShopRow;
  palette: BioPalette;
  /**
   * La page décide de la géométrie : avec une bande ou une bannière, elle
   * remonte ou descend le profil pour que l'avatar chevauche la lisière.
   */
  className?: string;
  style?: React.CSSProperties;
}) {
  const featured = isFeatured(shop.featured_until);
  const decor = palette.decor;
  // L'anneau du décor remplace l'ombre floue historique ; sans décor,
  // `undefined` et l'avatar garde sa bordure 2 px et son shadow-lg.
  const ring = bioAvatarRingStyle(palette);

  return (
    <header
      className={cn(
        "flex flex-col items-center px-4 text-center",
        className,
      )}
      style={style}
    >
      {/* Avatar */}
      {shop.logo_url ? (
        <div
          className={cn(
            "relative size-24 overflow-hidden rounded-full",
            !ring && "shadow-lg",
          )}
          style={{
            // Le double filet garde sa bordure d'encre (le lé cousu) ; les
            // anneaux moutarde de Wax se passent de bordure ; « raise »
            // apporte la sienne.
            ...(decor?.avatarRing === "highlight"
              ? {}
              : { border: `2px solid ${palette.border}` }),
            ...ring,
          }}
        >
          <Image
            src={shop.logo_url}
            alt={shop.name}
            fill
            preload
            sizes="96px"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          // Initiales en police de corps, jamais en police d'affiche : le
          // contraste inversé d'Ojuju rend un « C » ou un « O » seul étrange.
          className={cn(
            "flex size-24 items-center justify-center rounded-full text-3xl font-bold",
            !ring && "shadow-lg",
          )}
          // Couleurs, filet et anneau partagés avec la story et les
          // aperçus ; sans décor, le filet 1 px historique.
          style={
            decor
              ? bioAvatarInitialsStyle(palette)
              : {
                  ...bioAvatarInitialsStyle(palette),
                  border: `1px solid ${palette.border}`,
                }
          }
          aria-hidden
        >
          {shop.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + handle — en police d'affiche quand le thème en apporte une
          et que le vendeur n'a pas choisi la sienne (var absente → inherit). */}
      <h1
        className={cn(
          "mt-4 flex items-center gap-1.5 font-bold",
          decor
            ? "text-[26px] leading-tight"
            : "text-xl tracking-tight sm:text-2xl",
        )}
        style={{
          color: palette.accent,
          fontFamily: "var(--bio-font-display, inherit)",
        }}
      >
        {shop.name}
        {featured && (
          <BadgeCheck
            className="size-5 shrink-0"
            aria-label="Boutique mise en avant"
          />
        )}
      </h1>

      <p className="mt-0.5 text-sm font-medium" style={{ color: palette.muted }}>
        @{shop.slug}
      </p>

      {/* Bio — 16 px/500 avec décor (interligne 1,5 des maquettes), rendu
          historique sinon. L'interligne s'écrit APRÈS la taille : pour
          tailwind-merge, `text-sm` posé après `leading-relaxed` l'annule
          (les utilitaires de taille portent leur propre interligne). */}
      {shop.description && (
        <p
          className={cn(
            "mt-3 max-w-md",
            decor ? "text-base font-medium" : "text-sm leading-relaxed",
          )}
          style={{ color: palette.text }}
        >
          {shop.description}
        </p>
      )}
    </header>
  );
}
