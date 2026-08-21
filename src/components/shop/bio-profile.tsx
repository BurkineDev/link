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
import { cn } from "@/lib/utils";
import type { BioPalette } from "@/lib/bio-themes";
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

  return (
    <nav
      aria-label="Réseaux sociaux"
      className={cn("flex flex-wrap items-center justify-center gap-1", className)}
    >
      {active.map((social) => {
        const Icon = social.icon;
        return (
          <a
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
                "--tw-ring-color": palette.text,
              } as React.CSSProperties
            }
          >
            <Icon className="size-6" />
          </a>
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
}: {
  shop: ShopRow;
  palette: BioPalette;
}) {
  const featured = isFeatured(shop.featured_until);

  return (
    <header className="flex flex-col items-center px-4 text-center">
      {/* Avatar */}
      {shop.logo_url ? (
        <div
          className="relative size-24 overflow-hidden rounded-full shadow-lg"
          style={{ border: `2px solid ${palette.border}` }}
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
          className="flex size-24 items-center justify-center rounded-full text-3xl font-bold shadow-lg"
          style={{
            backgroundColor: palette.surface,
            color: palette.surfaceText,
            border: `1px solid ${palette.border}`,
          }}
          aria-hidden
        >
          {shop.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + handle */}
      <h1
        className="mt-4 flex items-center gap-1.5 text-xl font-bold tracking-tight sm:text-2xl"
        style={{ color: palette.accent }}
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

      {/* Bio */}
      {shop.description && (
        <p
          className="mt-3 max-w-md text-sm leading-relaxed"
          style={{ color: palette.text }}
        >
          {shop.description}
        </p>
      )}
    </header>
  );
}
