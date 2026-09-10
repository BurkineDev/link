import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, BottomNav } from "@/components/dashboard/sidebar";
import { BrandBackdrop, Wordmark } from "@/components/brand/brand-shell";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLinkIcon, UserIcon, SettingsIcon, ChevronRightIcon, HomeIcon } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Le proxy ne fait qu'un contrôle optimiste sur le cookie : c'est ici que
  // la session est réellement vérifiée (redirection vers /login sinon).
  const user = await requireUser();

  const reqHeaders = await headers();
  const pathname = reqHeaders.get("x-pathname") ?? "";
  const isOnboarding = pathname === "/dashboard/onboarding";

  const [profile, shop] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        username: true,
        avatarUrl: true,
        onboardingCompleted: true,
      },
    }),
    prisma.shop.findFirst({
      where: { ownerId: user.id },
      select: { name: true, slug: true, isPublished: true },
    }),
  ]);

  // Un vendeur qui n'a pas terminé son onboarding est ramené dessus, quelle
  // que soit la page du tableau de bord demandée. Ce contrôle vivait dans le
  // proxy ; il est ici parce que c'est le seul endroit qui lit la base.
  if (!isOnboarding && !profile?.onboardingCompleted) {
    redirect("/dashboard/onboarding");
  }

  // Sur la page d'onboarding, pas de chrome : elle fournit sa propre mise en
  // page plein écran.
  if (isOnboarding) {
    return <>{children}</>;
  }

  const displayName =
    profile?.fullName ?? profile?.username ?? user.email ?? "Mon compte";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="relative flex h-screen overflow-hidden font-[family-name:var(--font-brand)]"
      style={{ background: "var(--b-canvas)", color: "var(--b-ink)" }}
    >
      <BrandBackdrop />
      {/* Desktop sidebar */}
      <div className="relative z-10 hidden md:flex">
        <Sidebar shopSlug={shop?.slug} shopName={shop?.name} />
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header — transparent : le fond lilas traverse. */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-4 md:px-5">
          {/* Mobile: logotype */}
          <div className="flex items-center gap-3 md:hidden">
            <Wordmark className="text-[19px]" href="/dashboard" />
          </div>

          {/* Desktop: shop status pill */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HomeIcon className="size-3.5" />
              <ChevronRightIcon className="size-3 text-muted-foreground/40" />
              {shop?.name ? (
                <span className="font-medium text-foreground">{shop.name}</span>
              ) : (
                <span className="text-muted-foreground">Mon tableau de bord</span>
              )}
            </div>
            {shop && (
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  shop.isPublished
                    ? "bg-[var(--b-lime)] text-[var(--b-ink)]"
                    : "bg-[var(--b-wash)] text-[var(--b-muted)] border border-[var(--b-line)]",
                ].join(" ")}
              >
                {shop.isPublished ? "En ligne" : "Hors ligne"}
              </span>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            {shop?.slug && (
              <a
                href={`/${shop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--b-line)] bg-white px-4 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-[var(--b-ink)] sm:flex"
              >
                <ExternalLinkIcon className="size-3.5" />
                Voir ma boutique
              </a>
            )}

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="cursor-pointer rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all">
                <Avatar className="size-8">
                  {profile?.avatarUrl && (
                    <AvatarImage src={profile.avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        {profile?.avatarUrl && (
                          <AvatarImage src={profile.avatarUrl} alt={displayName} />
                        )}
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-semibold truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/dashboard/profile" className="flex w-full items-center gap-2">
                    <UserIcon className="size-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
                    <SettingsIcon className="size-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                {shop?.slug && (
                  <DropdownMenuItem>
                    <a
                      href={`/${shop.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-2"
                    >
                      <ExternalLinkIcon className="size-4" />
                      Voir ma boutique
                    </a>
                  </DropdownMenuItem>
                )}
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
        <BottomNav />
      </div>
    </div>
  );
}
