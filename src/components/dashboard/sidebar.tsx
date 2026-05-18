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
  from: string;
  to: string;
};

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Général",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboardIcon,
        from: "oklch(0.68 0.22 145)",   /* vert vif */
        to:   "oklch(0.46 0.20 148)",
      },
      {
        label: "Produits",
        href: "/dashboard/products",
        icon: PackageIcon,
        from: "oklch(0.60 0.18 138)",   /* vert moyen */
        to:   "oklch(0.42 0.16 142)",
      },
      {
        label: "Commandes",
        href: "/dashboard/orders",
        icon: ShoppingBagIcon,
        from: "oklch(0.56 0.14 118)",   /* vert forêt */
        to:   "oklch(0.38 0.12 122)",
      },
    ],
  },
  {
    label: "Croissance",
    items: [
      {
        label: "Analytiques",
        href: "/dashboard/analytics",
        icon: BarChart3Icon,
        from: "oklch(0.62 0.16 132)",   /* vert clair */
        to:   "oklch(0.44 0.18 138)",
      },
      {
        label: "Ma Boutique",
        href: "/dashboard/shop",
        icon: StoreIcon,
        from: "oklch(0.58 0.14 108)",   /* vert olive */
        to:   "oklch(0.40 0.12 105)",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Paramètres",
        href: "/dashboard/settings",
        icon: SettingsIcon,
        from: "oklch(0.50 0.08 118)",   /* olive sombre */
        to:   "oklch(0.34 0.06 115)",
      },
    ],
  },
];

function NavIcon({
  icon: Icon,
  active,
  from,
  to,
}: {
  icon: React.ElementType;
  active: boolean;
  from: string;
  to: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${from}, ${to})`,
              boxShadow: `0 2px 10px ${to}55`,
            }
          : { background: "oklch(1 0 0 / 6%)" }
      }
    >
      {pending ? (
        <svg
          className="size-[15px] animate-spin text-white"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <Icon className="size-[15px] text-white" />
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
      {/* Ambient orb — top-left */}
      <div
        className="pointer-events-none absolute -top-24 -left-12 size-60 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.62 0.24 22 / 0.22) 0%, transparent 70%)",
          filter: "blur(36px)",
        }}
      />
      {/* Ambient orb — bottom-right */}
      <div
        className="pointer-events-none absolute -bottom-20 -right-12 size-52 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.22 270 / 0.14) 0%, transparent 70%)",
          filter: "blur(32px)",
        }}
      />

      {/* Logo */}
      <div
        className="flex h-14 shrink-0 items-center px-4"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
      >
        <Logo size="sm" href="/dashboard" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/22 select-none">
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
                    "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm tracking-[-0.01em] transition-all duration-200",
                    active
                      ? "bg-white/[0.09] font-semibold text-white"
                      : "font-medium text-white/48 hover:bg-white/[0.05] hover:text-white/78"
                  )}
                >
                  {/* Left accent bar */}
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                      style={{
                        background: `linear-gradient(to bottom, ${item.from}, ${item.to})`,
                      }}
                    />
                  )}

                  {/* Icon badge */}
                  <NavIcon
                    icon={Icon}
                    active={active}
                    from={item.from}
                    to={item.to}
                  />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div
        className="shrink-0 px-2.5 pb-4 pt-3 space-y-0.5"
        style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}
      >
        {shopSlug && (
          <a
            href={`/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-white/48 hover:bg-white/[0.05] hover:text-white/78 transition-all duration-200"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "oklch(1 0 0 / 6%)" }}
            >
              <ExternalLinkIcon className="size-[15px] text-white" />
            </span>
            <span className="truncate tracking-[-0.01em]">
              {shopName ? `Voir ${shopName}` : "Voir ma boutique"}
            </span>
          </a>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-white/38 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "oklch(1 0 0 / 6%)" }}
          >
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
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    from: "oklch(0.68 0.22 145)",
    to:   "oklch(0.46 0.20 148)",
  },
  {
    label: "Produits",
    href: "/dashboard/products",
    icon: PackageIcon,
    from: "oklch(0.60 0.18 138)",
    to:   "oklch(0.42 0.16 142)",
  },
  {
    label: "Commandes",
    href: "/dashboard/orders",
    icon: ShoppingBagIcon,
    from: "oklch(0.56 0.14 118)",
    to:   "oklch(0.38 0.12 122)",
  },
  {
    label: "Stats",
    href: "/dashboard/analytics",
    icon: BarChart3Icon,
    from: "oklch(0.62 0.16 132)",
    to:   "oklch(0.44 0.18 138)",
  },
  {
    label: "Réglages",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    from: "oklch(0.50 0.08 118)",
    to:   "oklch(0.34 0.06 115)",
  },
];

interface BottomNavProps {
  shopSlug?: string | null;
}

export function BottomNav({ shopSlug }: BottomNavProps) {
  const pathname = usePathname();

  const items: NavItemDef[] = shopSlug
    ? [
        ...BOTTOM_ITEMS.slice(0, 4),
        {
          label: "Boutique",
          href: `/${shopSlug}`,
          icon: StoreIcon,
          from: "oklch(0.58 0.14 108)",
          to:   "oklch(0.40 0.12 105)",
        },
      ]
    : BOTTOM_ITEMS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl safe-bottom"
      style={{ borderTop: "1px solid oklch(0 0 0 / 8%)" }}
    >
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
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-5 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${item.from}, ${item.to})`,
                  }}
                />
              )}
              <span
                className="flex size-8 items-center justify-center rounded-lg transition-all duration-200"
                style={
                  active
                    ? { background: `linear-gradient(135deg, ${item.from}, ${item.to})` }
                    : undefined
                }
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-white" : ""
                  )}
                />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
