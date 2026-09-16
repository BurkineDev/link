import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { OPEN_PAYOUT_STATUSES } from "@/lib/payouts/config";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import { prisma } from "@/lib/prisma";
import {
  Activity,
  BarChart3Icon,
  ChevronRightIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  MegaphoneIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  BanknoteIcon,
} from "lucide-react";

export const metadata = { title: "Plus" };

/**
 * Hub « Plus » du mobile.
 *
 * La barre du bas ne tient que cinq entrées avant que les cibles tactiles ne
 * passent sous 44 px sur un écran de 320 px. Tout ce qui n'y rentre pas
 * atterrit ici — jamais derrière un menu à tiroirs : un vendeur doit pouvoir
 * tout faire depuis son téléphone (mission §27).
 *
 * Caisse masquée (voir src/lib/payments/online-checkout.ts) : plus d'entrée
 * Paiements, et « Reversements à traiter » seulement s'il en reste.
 */

type MoreItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
};
type MoreSection = { label: string; items: MoreItem[] };

const PAYMENTS_ITEM: MoreItem = {
  label: "Paiements",
  href: "/dashboard/payments",
  icon: CreditCardIcon,
  description: "Ce que tu as encaissé",
};

function sellerSections(onlineCheckout: boolean): MoreSection[] {
  return [
    {
      label: "Ventes",
      items: [
        {
          label: "Produits",
          href: "/dashboard/products",
          icon: PackageIcon,
          description: "Ajouter, modifier, publier",
        },
        ...(onlineCheckout ? [PAYMENTS_ITEM] : []),
      ],
    },
    {
      label: "Croissance",
      items: [
        {
          label: "Clients",
          href: "/dashboard/customers",
          icon: UsersIcon,
          description: "Ton répertoire d'acheteurs",
        },
        {
          label: "Marketing",
          href: "/dashboard/marketing",
          icon: MegaphoneIcon,
          description: onlineCheckout ? "Liens, promos, QR, stories" : "Liens, pixels, QR, stories",
        },
        {
          label: "Analytics",
          href: "/dashboard/analytics",
          icon: BarChart3Icon,
          description: "Vues, clics, conversion",
        },
      ],
    },
    {
      label: "Compte",
      items: [
        {
          label: "Paramètres",
          href: "/dashboard/settings",
          icon: SettingsIcon,
          description: onlineCheckout
            ? "Boutique, apparence, paiements"
            : "Boutique, apparence, WhatsApp",
        },
        {
          label: "Profil",
          href: "/dashboard/profile",
          icon: UserIcon,
          description: "Ton compte et ton abonnement",
        },
      ],
    },
  ];
}

export default async function MorePage() {
  const user = await requireUser();
  const isAdmin = isAdminEmail(user.email);
  const onlineCheckout = isOnlineCheckoutEnabled();

  const [shop, pendingPayouts] = await Promise.all([
    prisma.shop.findFirst({
      where: { ownerId: user.id },
      select: { slug: true, isPublished: true },
    }),
    // Même compte que le layout : caisse masquée, l'entrée Reversements ne
    // s'affiche que tant qu'il reste des demandes ouvertes à solder.
    isAdmin && !onlineCheckout
      ? prisma.payout.count({ where: { status: { in: [...OPEN_PAYOUT_STATUSES] } } })
      : 0,
  ]);
  const showPayouts = onlineCheckout || pendingPayouts > 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tout le reste de ton espace vendeur.
        </p>
      </div>

      {shop?.slug && shop.isPublished && (
        <a
          href={`/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl bg-primary/10 p-4 ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ExternalLinkIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Voir ma page publique</p>
            <p className="truncate text-xs text-muted-foreground">
              bio-lien.com/{shop.slug}
            </p>
          </div>
        </a>
      )}

      {(isAdmin
        ? [
            {
              label: "Équipe",
              items: [
                ...(showPayouts
                  ? [
                      {
                        label: "Reversements à traiter",
                        href: "/dashboard/admin/payouts",
                        icon: BanknoteIcon,
                        description: "Demandes de versement des vendeurs",
                      },
                    ]
                  : []),
                {
                  label: "Santé de la plateforme",
                  href: "/dashboard/admin/ops",
                  icon: Activity,
                  description: "Alertes, cron, base, migrations",
                },
              ],
            },
            ...sellerSections(onlineCheckout),
          ]
        : sellerSections(onlineCheckout)
      ).map((section) => (
        <section key={section.label} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </h2>
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <ul className="divide-y divide-border">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
