import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircleIcon, UsersIcon } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { buildWaMeLink } from "@/lib/whatsapp";
import { isValidWhatsAppNumber } from "@/lib/utils/whatsapp";
import type { Currency, OrderRow } from "@/lib/types/database";

export const metadata = { title: "Clients — Bio-Lien" };

/**
 * Vue « Clients », première marche du CRM.
 *
 * Agrège les commandes par acheteur plutôt que de créer une table `customers`
 * tout de suite : la donnée existe déjà, et un vendeur a besoin de voir ses
 * clients maintenant, pas après une migration. La table dédiée (tags, notes,
 * consentements) arrive en phase 6 ; l'agrégat ci-dessous en définit le
 * contrat de lecture.
 *
 * Clé d'identité : le téléphone s'il existe, sinon l'e-mail. C'est le bon
 * ordre pour ce marché — un acheteur donne son numéro WhatsApp plus
 * volontiers qu'une adresse e-mail, et le donne de façon plus stable.
 */

type OrderSlice = Pick<
  OrderRow,
  | "id"
  | "buyer_name"
  | "buyer_email"
  | "buyer_phone"
  | "total_amount"
  | "currency"
  | "payment_status"
  | "created_at"
>;

interface CustomerAggregate {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  currency: Currency;
}

/** Regroupe les commandes payées par acheteur, du plus récent au plus ancien. */
function aggregate(orders: OrderSlice[], fallback: Currency): CustomerAggregate[] {
  const byKey = new Map<string, CustomerAggregate>();

  for (const order of orders) {
    const phone = order.buyer_phone?.trim() || null;
    const email = order.buyer_email?.trim().toLowerCase() || null;
    const key = phone ?? email;
    // Sans identifiant, impossible de rattacher la commande à quelqu'un.
    if (!key) continue;

    const existing = byKey.get(key);
    const isPaid = order.payment_status === "paid";

    if (!existing) {
      byKey.set(key, {
        key,
        name: order.buyer_name,
        email,
        phone,
        orderCount: 1,
        totalSpent: isPaid ? order.total_amount : 0,
        lastOrderAt: order.created_at,
        currency: (order.currency as Currency) ?? fallback,
      });
      continue;
    }

    existing.orderCount += 1;
    if (isPaid) existing.totalSpent += order.total_amount;
    if (order.created_at > existing.lastOrderAt) {
      existing.lastOrderAt = order.created_at;
      existing.name = order.buyer_name;
    }
    existing.email ??= email;
    existing.phone ??= phone;
  }

  return [...byKey.values()].sort((a, b) =>
    a.lastOrderAt < b.lastOrderAt ? 1 : -1,
  );
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!shop) redirect("/dashboard");

  const currency = shop.currency as Currency;

  const { data } = await supabase
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, total_amount, currency, payment_status, created_at",
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const customers = aggregate((data ?? []) as OrderSlice[], currency);
  const repeat = customers.filter((c) => c.orderCount > 1).length;
  const revenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les personnes qui ont commandé chez toi. Recontacte-les en un tap.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Clients" value={String(customers.length)} />
        <Tile
          label="Clients fidèles"
          value={String(repeat)}
          hint="Au moins deux commandes"
        />
        <Tile label="Chiffre d'affaires" value={formatPrice(revenue, currency)} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Répertoire</CardTitle>
          <CardDescription>Du plus récent au plus ancien</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <UsersIcon className="size-6 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Aucun client pour l&apos;instant</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Tes clients apparaîtront ici dès ta première commande.
              </p>
              <Link
                href="/dashboard/page"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Partager ma page
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {customers.map((customer) => {
                const waLink =
                  customer.phone && isValidWhatsAppNumber(customer.phone)
                    ? buildWaMeLink(
                        customer.phone,
                        `Bonjour ${customer.name} 👋 Merci pour ta commande chez ${shop.name} !`,
                      )
                    : null;

                return (
                  <li
                    key={customer.key}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {customer.name}
                        {customer.orderCount > 1 && (
                          <Badge className="border-0 bg-primary/10 text-primary">
                            {customer.orderCount} commandes
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.phone ?? customer.email} ·{" "}
                        {formatDate(customer.lastOrderAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPrice(customer.totalSpent, customer.currency)}
                      </span>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Écrire à ${customer.name} sur WhatsApp`}
                          className="flex size-9 items-center justify-center rounded-lg text-white transition-transform active:scale-95"
                          style={{ backgroundColor: "#25D366" }}
                        >
                          <MessageCircleIcon className="size-4" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Ces fiches sont reconstituées à partir de tes commandes. Les tags, notes
        et consentements marketing arrivent avec le CRM complet — n&apos;envoie
        pas de message promotionnel sans accord de la personne.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
