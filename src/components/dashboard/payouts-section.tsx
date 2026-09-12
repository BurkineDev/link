"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanknoteIcon, ClockIcon, LandmarkIcon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppNumberField, defaultIso2ForCurrency } from "@/components/dashboard/whatsapp-number-field";
import { formatDate, formatPrice } from "@/lib/utils/format";
import {
  PAYOUT_PROVIDERS,
  PAYOUT_PROVIDER_LABELS,
  PAYOUT_STATUS_LABELS,
  isPhonePayoutProvider,
  type PayoutProvider,
  type PayoutStatus,
} from "@/lib/payouts/config";

/**
 * Section « Reversements » de la page Paiements : ce que le vendeur peut se
 * faire verser, où, et l'historique. Les données viennent du serveur ; les
 * actions passent par /api/payout-account et /api/payouts, puis la page se
 * rafraîchit.
 */

export interface PayoutAccountView {
  provider: string;
  account_name: string;
  account_identifier: string;
  country: string | null;
  is_verified: boolean;
}

export interface PayoutView {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  note: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface BalanceView {
  currency: string;
  available: number;
  maturing: number;
  reserved: number;
  paidOut: number;
  minimum: number;
  nextMaturityAt: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  requested: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0",
  processing: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-0",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-0",
};

function identifierLabel(account: PayoutAccountView) {
  return isPhonePayoutProvider(account.provider)
    ? `+${account.account_identifier}`
    : account.account_identifier;
}

export function PayoutsSection({
  balance,
  account,
  payouts,
}: {
  balance: BalanceView;
  account: PayoutAccountView | null;
  payouts: PayoutView[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(account === null);
  const [requesting, setRequesting] = useState(false);
  const currency = balance.currency;
  const openRequest = payouts.find((p) => p.status === "requested" || p.status === "processing");

  const canRequest =
    account !== null && !openRequest && balance.available >= balance.minimum;
  const blockedReason = !account
    ? "Renseigne d'abord ton compte de reversement."
    : openRequest
      ? "Une demande est déjà en cours de traitement."
      : balance.available < balance.minimum
        ? `Minimum de reversement : ${formatPrice(balance.minimum, currency)}.`
        : null;

  async function request() {
    setRequesting(true);
    try {
      const res = await fetch("/api/payouts", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "La demande n'a pas pu être enregistrée.");
        return;
      }
      toast.success("Demande envoyée. Tu recevras un e-mail dès que le transfert est fait.");
      router.refresh();
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section id="reversements" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Reversements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que Bio-Lien a encaissé pour toi, moins la commission, te revient.
          Demande le versement quand tu veux : l&apos;équipe l&apos;exécute sous 2 jours ouvrés.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="Disponible"
          value={formatPrice(balance.available, currency)}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          hint={
            balance.reserved > 0
              ? `${formatPrice(balance.reserved, currency)} en cours de versement.`
              : undefined
          }
        />
        <Tile
          label="En sécurisation"
          value={formatPrice(balance.maturing, currency)}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          hint={
            balance.nextMaturityAt
              ? `Prochain déblocage le ${formatDate(balance.nextMaturityAt)}.`
              : "Les encaissements deviennent reversables après quelques jours."
          }
        />
        <Tile
          label="Déjà versé"
          value={formatPrice(balance.paidOut, currency)}
          tone="bg-muted text-foreground"
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            {account && !isPhonePayoutProvider(account.provider) ? (
              <LandmarkIcon className="size-4" />
            ) : (
              <SmartphoneIcon className="size-4" />
            )}
            Compte de reversement
          </CardTitle>
          <CardDescription>
            Là où l&apos;argent est envoyé. Mobile Money ou virement bancaire.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {editing ? (
            <PayoutAccountForm
              initial={account}
              currency={currency}
              onSaved={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={account ? () => setEditing(false) : undefined}
            />
          ) : account ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {PAYOUT_PROVIDER_LABELS[account.provider as PayoutProvider] ?? account.provider}
                  {" · "}
                  <span className="font-mono">{identifierLabel(account)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Au nom de {account.account_name}
                  {account.is_verified ? " · vérifié par l'équipe" : " · vérifié au premier versement"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                Modifier
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            {canRequest
              ? `Demander le reversement de ${formatPrice(balance.available, currency)}`
              : "Demander un reversement"}
          </p>
          <p className="text-xs text-muted-foreground">
            {blockedReason ?? "Tout le solde disponible est versé en une fois."}
          </p>
        </div>
        <Button type="button" onClick={request} disabled={!canRequest || requesting}>
          <BanknoteIcon className="size-4" />
          {requesting ? "Envoi…" : "Demander"}
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Historique des reversements</CardTitle>
          <CardDescription>Chaque demande, avec la référence du transfert une fois versée.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payouts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <ClockIcon className="size-5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">Aucun reversement pour l&apos;instant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {payouts.map((payout) => (
                <li key={payout.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatPrice(payout.amount, payout.currency)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {PAYOUT_PROVIDER_LABELS[payout.provider as PayoutProvider] ?? payout.provider}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demandé le {formatDate(payout.created_at)}
                      {payout.paid_at ? ` · versé le ${formatDate(payout.paid_at)}` : ""}
                      {payout.reference ? ` · réf. ${payout.reference}` : ""}
                      {payout.status === "failed" && payout.note ? ` · ${payout.note}` : ""}
                    </p>
                  </div>
                  <Badge className={STATUS_CLASS[payout.status] ?? "bg-muted border-0"}>
                    {PAYOUT_STATUS_LABELS[payout.status as PayoutStatus] ?? payout.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Tile({
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
    <div className={`rounded-xl p-4 ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-80">{hint}</p> : null}
    </div>
  );
}

export function PayoutAccountForm({
  initial,
  currency,
  onSaved,
  onCancel,
}: {
  initial: PayoutAccountView | null;
  currency: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [provider, setProvider] = useState<PayoutProvider>(
    (initial?.provider as PayoutProvider | undefined) ?? "wave",
  );
  const [accountName, setAccountName] = useState(initial?.account_name ?? "");
  const [phone, setPhone] = useState(
    initial && isPhonePayoutProvider(initial.provider) ? initial.account_identifier : "",
  );
  const [iban, setIban] = useState(
    initial && !isPhonePayoutProvider(initial.provider) ? initial.account_identifier : "",
  );
  const [saving, setSaving] = useState(false);
  const phoneProvider = isPhonePayoutProvider(provider);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (phoneProvider && !phone) {
      toast.error("Indique un numéro Mobile Money valide.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/payout-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          account_name: accountName,
          // Le numéro composé est déjà international : on l'envoie avec « + ».
          account_identifier: phoneProvider ? `+${phone}` : iban,
          ...(phoneProvider ? {} : { country: defaultIso2ForCurrency(currency) }),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Impossible d'enregistrer le compte.");
        return;
      }
      toast.success("Compte de reversement enregistré.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="payout-provider">Moyen de réception</Label>
        <Select value={provider} onValueChange={(value) => setProvider(value as PayoutProvider)}>
          <SelectTrigger id="payout-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYOUT_PROVIDERS.map((value) => (
              <SelectItem key={value} value={value}>
                {PAYOUT_PROVIDER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payout-account-name">Nom du titulaire</Label>
        <Input
          id="payout-account-name"
          value={accountName}
          onChange={(event) => setAccountName(event.target.value)}
          placeholder="Tel qu'il apparaît sur le compte"
          minLength={2}
          maxLength={100}
          required
        />
      </div>

      <div className="sm:col-span-2">
        {phoneProvider ? (
          <WhatsAppNumberField
            id="payout-phone"
            value={phone}
            onChange={setPhone}
            currency={currency}
            label={`Numéro ${PAYOUT_PROVIDER_LABELS[provider]}`}
            help="Le numéro qui reçoit l'argent."
            testLink={false}
          />
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="payout-iban">IBAN ou RIB</Label>
            <Input
              id="payout-iban"
              value={iban}
              onChange={(event) => setIban(event.target.value)}
              placeholder="CI93 CI00 0000 …"
              minLength={8}
              maxLength={40}
              required
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}
