"use client";

import Image from "next/image";
import Link from "next/link";
import { Globe, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShopRow } from "@/lib/types/database";

// Social icons not available in this lucide-react version — use inline SVGs

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.17 8.17 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
    </svg>
  );
}

interface ShopHeaderProps {
  shop: ShopRow;
  className?: string;
}

const SOCIAL_CONFIG = [
  {
    key: "instagram" as const,
    label: "Instagram",
    icon: InstagramIcon,
    href: (v: string) => `https://instagram.com/${v.replace("@", "")}`,
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    icon: TikTokIcon,
    href: (v: string) => `https://tiktok.com/@${v.replace("@", "")}`,
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: FacebookIcon,
    href: (v: string) =>
      v.startsWith("http") ? v : `https://facebook.com/${v}`,
  },
  {
    key: "youtube" as const,
    label: "YouTube",
    icon: YoutubeIcon,
    href: (v: string) =>
      v.startsWith("http") ? v : `https://youtube.com/@${v}`,
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    icon: MessageCircle,
    href: (v: string) =>
      `https://wa.me/${v.replace(/\D/g, "")}`,
  },
  {
    key: "website" as const,
    label: "Site web",
    icon: Globe,
    href: (v: string) => (v.startsWith("http") ? v : `https://${v}`),
  },
] as const;

export function ShopHeader({ shop, className }: ShopHeaderProps) {
  const socialLinks = shop.social_links ?? {};
  const activeSocials = SOCIAL_CONFIG.filter(
    (s) => socialLinks[s.key]
  );

  return (
    <header className={cn("relative w-full", className)}>
      {/* ── Banner ── */}
      <div className="relative h-48 sm:h-64 md:h-80 w-full overflow-hidden">
        {shop.banner_url ? (
          <Image
            src={shop.banner_url}
            alt={`Bannière de ${shop.name}`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: shop.theme_color }}
          />
        )}
        {/* Solid scrim for text legibility on the banner image */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* ── Logo + Info ── */}
      <div className="relative mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-center -mt-12 pb-6 text-center">
          {/* Logo */}
          {shop.logo_url ? (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background shadow-lg mb-4">
              <Image
                src={shop.logo_url}
                alt={`Logo de ${shop.name}`}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          ) : (
            <div
              className="h-24 w-24 shrink-0 rounded-2xl border-4 border-background shadow-lg mb-4 flex items-center justify-center text-white text-3xl font-bold"
              style={{ backgroundColor: shop.theme_color }}
            >
              {shop.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name */}
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {shop.name}
          </h1>

          {/* Bio / description */}
          {shop.description && (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
              {shop.description}
            </p>
          )}

          {/* Social links */}
          {activeSocials.length > 0 && (
            <div className="mt-4 flex items-center gap-3 flex-wrap justify-center">
              {activeSocials.map((social) => {
                const value = socialLinks[social.key]!;
                const Icon = social.icon;
                return (
                  <Link
                    key={social.key}
                    href={social.href(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      "bg-muted text-muted-foreground",
                      "transition-all hover:scale-110 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
