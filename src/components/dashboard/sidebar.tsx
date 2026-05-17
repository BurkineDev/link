"use client";

import Link from "next/link";
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

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Produits", href: "/dashboard/products", icon: PackageIcon },
  { label: "Commandes", href: "/dashboard/orders", icon: ShoppingBagIcon },
  { label: "Analytiques", href: "/dashboard/analytics", icon: BarChart3Icon },
  { label: "Ma Boutique", href: "/dashboard/shop", icon: StoreIcon },
  { label: "Paramètres", href: "/dashboard/settings", icon: SettingsIcon },
];

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

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo size="sm" href="/dashboard" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors touch-target",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-3 flex flex-col gap-1">
        {shopSlug && (
          <a
            href={`/boutique/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <ExternalLinkIcon className="size-4 shrink-0" />
            <span>Voir ma boutique</span>
          </a>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOutIcon className="size-4 shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

interface BottomNavProps {
  shopSlug?: string | null;
}

export function BottomNav({ shopSlug: _shopSlug }: BottomNavProps) {
  const pathname = usePathname();

  const BOTTOM_ITEMS: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
    { label: "Produits", href: "/dashboard/products", icon: PackageIcon },
    { label: "Commandes", href: "/dashboard/orders", icon: ShoppingBagIcon },
    { label: "Analytiques", href: "/dashboard/analytics", icon: BarChart3Icon },
    { label: "Paramètres", href: "/dashboard/settings", icon: SettingsIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background safe-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
