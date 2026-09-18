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
import { bioAvatarRingStyle, type BioPalette } from "@/lib/bio-themes";
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

/**
 * Cercle d'un réseau sur un thème à décor : de petits tampons à filet, en
 * accord avec les pastilles de la barre haute. Filet 1 px `border` pour les
 * thèmes à ombre dure (Bogolan, Indigo), 2 px `accent` quand les boutons
 * sont eux-mêmes bordés (Wax, Pagne tissé). Sans décor : `undefined`, les
 * icônes restent nues comme avant.
 */
function socialRingStyle(palette: BioPalette): React.CSSProperties | undefined {
  const decor = palette.decor;
  if (!decor) return undefined;
  const bold = decor.buttonBorder === "bold";
  return {
    color: bold ? palette.accent : palette.text,
    border: `${bold ? 2 : 1}px solid ${bold ? palette.accent : palette.border}`,
  };
}

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

  const ring = socialRingStyle(palette);

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

/**
 * Couleurs du disque d'initiales. Sur une bande d'en-tête (Wax, Pagne
 * tissé), un disque `surface` se fondrait dans la bande de la même couleur :
 * il prend alors le fond de page avec les initiales en `accent`, comme les
 * pastilles de la barre haute. Ailleurs, la surface et son texte.
 */
function initialsColors(palette: BioPalette): {
  backgroundColor: string;
  color: string;
} {
  if (palette.decor?.header?.kind === "band") {
    return { backgroundColor: palette.backgroundSolid, color: palette.accent };
  }
  return { backgroundColor: palette.surface, color: palette.surfaceText };
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
          style={{
            ...initialsColors(palette),
            ...(decor?.avatarRing === "highlight"
              ? {}
              : { border: `${decor ? 2 : 1}px solid ${palette.border}` }),
            ...ring,
          }}
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
