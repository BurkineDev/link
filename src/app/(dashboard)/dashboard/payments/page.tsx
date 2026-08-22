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
import { CreditCardIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/format";
import type { Currency, OrderRow } from "@/lib/types/database";

export const metadata = { title: "Paiements" };

/**
 * Vue « Paiements » : l'argent, vu depuis les encaissements plutôt que depuis
 * les commandes. Un vendeur qui se demande « ai-je été payé ? » ne veut pas
 * parcourir des statuts de préparation.
 *
 * Aucune table dédiée : les paiements sont dérivés des commandes, qui portent
 * déjà le prestataire, la référence et le statut de paiement. Une table
 * PaymentTransaction n'aura de sens qu'avec les remboursements partiels et les
 * paiements multiples (voir docs/social-commerce-os.md, phase 5).
 */

const PROVIDER_META: Record<
  string,
  { label: string; icon: typeof CreditCardIcon }
> = {
  stripe: { label: "Carte bancaire", icon: CreditCardIcon },
  geniuspay: { label: "Mobile Money", icon: SmartphoneIcon },
};

const PAYMENT_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  paid: {
    label: "Encaissé",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0",
  },
  pending: { label: "En attente", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0" },
  failed: { label: "Échoué", className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-0" },
  refunded: { label: "Remboursé", className: "bg-muted text-muted-foreground border-0" },
  partially_refunded: {
    label: "Remboursé en partie",
    className: "bg-muted text-muted-foreground border-0",
  },
};

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();
  if (!shop) redirect("/dashboard");

  const currency = shop.currency as Currency;

  const { data } = await supabase
    .from("orders")
    .select(
      "id, total_amount, currency, payment_status, payment_provider, payment_ref, buyer_name, created_at",
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const payments = (data ?? []) as Array<
    Pick<
      OrderRow,
      | "id"
      | "total_amount"
      | "currency"
      | "payment_status"
      | "payment_provider"
      | "payment_ref"
      | "buyer_name"
      | "created_at"
    >
  >;

  const collected = payments
    .filter((p) => p.payment_status === "paid")
    .reduce((sum, p) => sum + p.total_amount, 0);
  const pending = payments
    .filter((p) => p.payment_status === "pending")
    .reduce((sum, p) => sum + p.total_amount, 0);
  const failedCount = payments.filter(
    (p) => p.payment_status === "failed",
  ).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paiements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que tu as encaissé, et ce qui reste à encaisser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Encaissé"
          value={formatPrice(collected, currency)}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatTile
          label="En attente"
          value={formatPrice(pending, currency)}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <StatTile
          label="Paiements échoués"
          value={String(failedCount)}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          hint={
            failedCount > 0
              ? "Un client a peut-être abandonné en cours de paiement."
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Derniers paiements</CardTitle>
          <CardDescription>
            Dérivés de tes commandes — 50 plus récents
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <WalletIcon className="size-6 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Aucun paiement pour l&apos;instant</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Partage ta page pour recevoir ta première commande.
              </p>
              <Link
                href="/dashboard/page"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Ouvrir ma page
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((payment) => {
                const provider =
                  PROVIDER_META[payment.payment_provider ?? ""] ?? {
                    label: "Autre",
                    icon: WalletIcon,
                  };
                const ProviderIcon = provider.icon;
                const status =
                  PAYMENT_STATUS_META[payment.payment_status] ?? {
                    label: payment.payment_status,
                    className: "bg-muted text-muted-foreground border-0",
                  };

                return (
                  <li
                    key={payment.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ProviderIcon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {payment.buyer_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {provider.label} · {formatDate(payment.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPrice(
                          payment.total_amount,
                          (payment.currency as Currency) ?? currency,
                        )}
                      </span>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
        >
          <WalletIcon className="size-5" />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
