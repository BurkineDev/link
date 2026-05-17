import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, BottomNav } from "@/components/dashboard/sidebar";
import { Logo } from "@/components/shared/logo";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLinkIcon, UserIcon, SettingsIcon, LogOutIcon } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile and shop in parallel
  const [profileResult, shopResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("shops")
      .select("name, slug")
      .eq("owner_id", user.id)
      .single(),
  ]);

  const profile = profileResult.data;
  const shop = shopResult.data;

  const displayName =
    profile?.full_name ?? profile?.username ?? user.email ?? "Mon compte";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar shopSlug={shop?.slug} shopName={shop?.name} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
          {/* Mobile: logo */}
          <div className="flex items-center gap-3 md:hidden">
            <Logo size="sm" href="/dashboard" />
          </div>

          {/* Desktop: shop name */}
          <div className="hidden items-center md:flex">
            {shop?.name ? (
              <p className="text-sm font-semibold text-foreground">
                {shop.name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Mon tableau de bord</p>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {shop?.slug && (
              <a
                href={`/boutique/${shop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:flex"
              >
                <ExternalLinkIcon className="size-3.5" />
                Voir ma boutique
              </a>
            )}

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Avatar>
                  {profile?.avatar_url && (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={displayName}
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 w-full"
                  >
                    <UserIcon className="size-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 w-full"
                  >
                    <SettingsIcon className="size-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <SignOutButton />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav shopSlug={shop?.slug} />
      </div>
    </div>
  );
}
