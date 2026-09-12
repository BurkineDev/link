"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatPrice } from "@/lib/utils/format";
import {
  PAYOUT_PROVIDER_LABELS,
  PAYOUT_STATUS_LABELS,
  isPhonePayoutProvider,
  type PayoutProvider,
  type PayoutStatus,
} from "@/lib/payouts/config";

interface Destination {
  provider: string;
  accountName: string;
  accountIdentifier: string;
  country: string | null;
}

export interface AdminPayoutView {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  note: string | null;
  destination: unknown;
  paid_at: string | null;
  created_at: string;
  shop: { name: string; slug: string; email: string; whatsapp: string | null };
}

function destinationOf(payout: AdminPayoutView): Destination | null {
  const value = payout.destination as Destination | null;
  return value && typeof value === "object" && "accountIdentifier" in value ? value : null;
}

export function AdminPayoutsClient({
  open,
  recent,
}: {
  open: AdminPayoutView[];
  recent: AdminPayoutView[];
}) {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reversements à traiter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exécute le transfert depuis Wave, Orange Money ou la banque, puis marque-le versé
          avec la référence : c&apos;est ce qui écrit la ligne comptable et prévient le vendeur.
        </p>
      </div>

      {open.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune demande en attente.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {open.map((payout) => (
            <PayoutCard key={payout.id} payout={payout} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Derniers traités</CardTitle>
          <CardDescription>30 derniers reversements versés ou refusés.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Rien encore.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((payout) => (
                <li key={payout.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {payout.shop.name}{" "}
                      <span className="text-muted-foreground">· {formatPrice(payout.amount, payout.currency)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payout.paid_at ? `Versé le ${formatDate(payout.paid_at)}` : `Demandé le ${formatDate(payout.created_at)}`}
                      {payout.reference ? ` · réf. ${payout.reference}` : ""}
                      {payout.note ? ` · ${payout.note}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {PAYOUT_STATUS_LABELS[payout.status as PayoutStatus] ?? payout.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutCard({ payout }: { payout: AdminPayoutView }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = destinationOf(payout);

  async function act(body: Record<string, string>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Action impossible.");
        return;
      }
      toast.success(
        body.action === "paid"
          ? "Marqué versé, vendeur prévenu."
          : body.action === "failed"
            ? "Refusé, vendeur prévenu."
            : "Pris en charge.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const identifier = destination
    ? isPhonePayoutProvider(destination.provider)
      ? `+${destination.accountIdentifier}`
      : destination.accountIdentifier
    : "—";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {payout.shop.name}{" "}
            <span className="font-normal text-muted-foreground">/{payout.shop.slug}</span>
          </CardTitle>
          <Badge variant="outline">
            {PAYOUT_STATUS_LABELS[payout.status as PayoutStatus] ?? payout.status}
          </Badge>
        </div>
        <CardDescription>
          Demandé le {formatDate(payout.created_at)} · vendeur : {payout.shop.email}
          {payout.shop.whatsapp ? ` · WhatsApp +${payout.shop.whatsapp.replace(/^\+/, "")}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <p className="text-2xl font-bold tabular-nums">{formatPrice(payout.amount, payout.currency)}</p>
          <p className="text-sm">
            <span className="font-medium">
              {PAYOUT_PROVIDER_LABELS[(destination?.provider ?? payout.provider) as PayoutProvider] ??
                payout.provider}
            </span>
            {" · "}
            <span className="font-mono select-all">{identifier}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Au nom de {destination?.accountName ?? "—"}
            {destination?.country ? ` · ${destination.country}` : ""}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ref-${payout.id}`}>Référence du transfert</Label>
            <Input
              id={`ref-${payout.id}`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="ID de transaction Wave / Orange Money / virement"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`note-${payout.id}`}>Note (obligatoire pour un refus)</Label>
            <Input
              id={`note-${payout.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex. numéro inexistant, nom différent…"
              maxLength={500}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || reference.trim().length < 3}
              onClick={() => act({ action: "paid", reference: reference.trim(), ...(note.trim() ? { note: note.trim() } : {}) })}
            >
              Marquer versé
            </Button>
            {payout.status === "requested" ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => act({ action: "processing" })}>
                Je m&apos;en occupe
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={busy || note.trim().length < 3}
              onClick={() => act({ action: "failed", note: note.trim() })}
            >
              Refuser
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
