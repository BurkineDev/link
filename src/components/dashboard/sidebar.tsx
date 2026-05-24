"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import {
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingBagIcon,
  BarChart3Icon,
  StoreIcon,
  SettingsIcon,
  LogOutIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NavItemDef = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Général",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Produits", href: "/dashboard/products", icon: PackageIcon },
      { label: "Commandes", href: "/dashboard/orders", icon: ShoppingBagIcon },
    ],
  },
  {
    label: "Croissance",
    items: [
      { label: "Analytiques", href: "/dashboard/analytics", icon: BarChart3Icon },
      { label: "Ma Boutique", href: "/dashboard/shop", icon: StoreIcon },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "Paramètres", href: "/dashboard/settings", icon: SettingsIcon },
    ],
  },
];

function NavIcon({
  icon: Icon,
  active,
}: {
  icon: React.ElementType;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-white/[0.06] text-white/70",
      )}
    >
      {pending ? (
        <svg
          className="size-[15px] animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <Icon className="size-[15px]" />
      )}
    </span>
  );
}

interface SidebarProps {
  shopSlug?: string | null;
  shopName?: string | null;
}

export function Sidebar({ shopSlug, shopName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <aside className="relative flex h-full w-[228px] shrink-0 flex-col overflow-hidden bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-white/[0.08] text-white">
        <Logo size="sm" href="/dashboard" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 select-none">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm tracking-[-0.01em] transition-colors duration-150",
                    active
                      ? "bg-white/[0.08] font-semibold text-white"
                      : "font-medium text-white/55 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {/* Left accent bar — flat yellow */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                  )}

                  <NavIcon icon={Icon} active={active} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 px-2.5 pb-4 pt-3 space-y-0.5 border-t border-white/[0.08]">
        {shopSlug && (
          <a
            href={`/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-white/55 hover:bg-white/[0.04] hover:text-white transition-colors duration-150"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
              <ExternalLinkIcon className="size-[15px] text-white/80" />
            </span>
            <span className="truncate tracking-[-0.01em]">
              {shopName ? `Voir ${shopName}` : "Voir ma boutique"}
            </span>
          </a>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-white/45 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <LogOutIcon className="size-[15px]" />
          </span>
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile Bottom Nav
// ---------------------------------------------------------------------------

const BOTTOM_ITEMS: NavItemDef[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Produits", href: "/dashboard/products", icon: PackageIcon },
  { label: "Commandes", href: "/dashboard/orders", icon: ShoppingBagIcon },
  { label: "Stats", href: "/dashboard/analytics", icon: BarChart3Icon },
  { label: "Réglages", href: "/dashboard/settings", icon: SettingsIcon },
];

interface BottomNavProps {
  shopSlug?: string | null;
}

export function BottomNav({ shopSlug }: BottomNavProps) {
  const pathname = usePathname();

  const items: NavItemDef[] = shopSlug
    ? [
        ...BOTTOM_ITEMS.slice(0, 4),
        { label: "Boutique", href: `/${shopSlug}`, icon: StoreIcon },
      ]
    : BOTTOM_ITEMS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl safe-bottom border-t border-border">
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors duration-150",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-5 rounded-full bg-primary" />
              )}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors duration-150",
                  active ? "bg-primary text-primary-foreground" : "",
                )}
              >
                <Icon className="size-4 shrink-0" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
