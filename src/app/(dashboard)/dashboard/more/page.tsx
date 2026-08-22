import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BarChart3Icon,
  ChevronRightIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  MegaphoneIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

export const metadata = { title: "Plus — Bio-Lien" };

/**
 * Hub « Plus » du mobile.
 *
 * La barre du bas ne tient que cinq entrées avant que les cibles tactiles ne
 * passent sous 44 px sur un écran de 320 px. Tout ce qui n'y rentre pas
 * atterrit ici — jamais derrière un menu à tiroirs : un vendeur doit pouvoir
 * tout faire depuis son téléphone (mission §27).
 */

const SECTIONS: Array<{
  label: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ElementType;
    description: string;
  }>;
}> = [
  {
    label: "Ventes",
    items: [
      {
        label: "Produits",
        href: "/dashboard/products",
        icon: PackageIcon,
        description: "Ajouter, modifier, publier",
      },
      {
        label: "Paiements",
        href: "/dashboard/payments",
        icon: CreditCardIcon,
        description: "Ce que tu as encaissé",
      },
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
        description: "Liens, promos, QR, stories",
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
        description: "Boutique, apparence, paiements",
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

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("slug, is_published")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tout le reste de ton espace vendeur.
        </p>
      </div>

      {shop?.slug && shop.is_published && (
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

      {SECTIONS.map((section) => (
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
