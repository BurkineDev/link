"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AFRICAN_COUNTRIES } from "@/lib/constants";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  deliveryDelayLabel,
  shippingZoneSchema,
  type ShippingZoneInput,
  type ShippingZoneRow,
} from "@/lib/shipping/zone-schema";

/**
 * Livraison, côté vendeur. Les zones existaient en base et au checkout
 * (frais calculés selon le pays) sans qu'aucun écran ne permette d'en
 * créer : aucune boutique n'en avait. Ici, le vendeur dit s'il livre, où,
 * à quel prix, en combien de temps — et s'il accepte d'être payé à la
 * remise du colis.
 *
 * Les deux interrupteurs sont enregistrés tout de suite (PATCH boutique) ;
 * chaque zone a son propre formulaire.
 */

interface ShippingSectionProps {
  shopId: string;
  currency: string;
  shippingEnabled: boolean;
  cashOnDelivery: boolean;
  initialZones: ShippingZoneRow[];
  onChanged?: () => void;
}

const EMPTY_FORM: ZoneForm = {
  name: "",
  countries: [],
  rate: "",
  free_above: "",
  estimated_min: "",
  estimated_max: "",
  is_active: true,
};

interface ZoneForm {
  name: string;
  countries: string[];
  rate: string;
  free_above: string;
  estimated_min: string;
  estimated_max: string;
  is_active: boolean;
}

function toInput(form: ZoneForm): unknown {
  const num = (value: string) => (value.trim() === "" ? null : Number(value.replace(/\s/g, "").replace(",", ".")));
  return {
    name: form.name,
    countries: form.countries,
    rate: num(form.rate) ?? Number.NaN,
    free_above: num(form.free_above),
    estimated_min: num(form.estimated_min),
    estimated_max: num(form.estimated_max),
    is_active: form.is_active,
  };
}

function fromRow(zone: ShippingZoneRow): ZoneForm {
  return {
    name: zone.name,
    countries: zone.countries,
    rate: String(zone.rate),
    free_above: zone.free_above === null ? "" : String(zone.free_above),
    estimated_min: zone.estimated_min === null ? "" : String(zone.estimated_min),
    estimated_max: zone.estimated_max === null ? "" : String(zone.estimated_max),
    is_active: zone.is_active,
  };
}

function countryName(code: string): string {
  return AFRICAN_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function ShippingSection({
  shopId,
  currency,
  shippingEnabled: initialShippingEnabled,
  cashOnDelivery: initialCashOnDelivery,
  initialZones,
  onChanged,
}: ShippingSectionProps) {
  const [shippingEnabled, setShippingEnabled] = useState(initialShippingEnabled);
  const [cashOnDelivery, setCashOnDelivery] = useState(initialCashOnDelivery);
  const [zones, setZones] = useState<ShippingZoneRow[]>(initialZones);
  const [editing, setEditing] = useState<{ id: string | null; form: ZoneForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglePending, setTogglePending] = useState<"shipping" | "cod" | null>(null);

  async function patchShop(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Erreur lors de la sauvegarde.");
      return false;
    }
    onChanged?.();
    return true;
  }

  async function toggleShipping(next: boolean) {
    setTogglePending("shipping");
    const previous = shippingEnabled;
    setShippingEnabled(next);
    const ok = await patchShop({ shipping_enabled: next });
    if (!ok) setShippingEnabled(previous);
    else toast.success(next ? "Livraison activée." : "Livraison désactivée.");
    setTogglePending(null);
  }

  async function toggleCod(next: boolean) {
    setTogglePending("cod");
    const previous = cashOnDelivery;
    setCashOnDelivery(next);
    const ok = await patchShop({ cash_on_delivery: next });
    if (!ok) setCashOnDelivery(previous);
    else toast.success(next ? "Paiement à la livraison accepté." : "Paiement à la livraison retiré.");
    setTogglePending(null);
  }

  async function saveZone() {
    if (!editing) return;
    if (editing.form.rate.trim() === "") {
      toast.error("Indique le tarif (0 pour une livraison gratuite).");
      return;
    }
    const parsed = shippingZoneSchema.safeParse(toInput(editing.form));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Vérifie la zone.");
      return;
    }
    setSaving(true);
    try {
      const payload: ShippingZoneInput & { shop_id?: string } = parsed.data;
      const res = editing.id
        ? await fetch(`/api/shipping-zones/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/shipping-zones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, shop_id: shopId }),
          });
      const body = (await res.json().catch(() => ({}))) as { zone?: ShippingZoneRow; error?: string };
      if (!res.ok || !body.zone) {
        toast.error(body.error ?? "Impossible d'enregistrer la zone.");
        return;
      }
      const saved = body.zone;
      setZones((current) =>
        editing.id ? current.map((z) => (z.id === saved.id ? saved : z)) : [...current, saved],
      );
      setEditing(null);
      toast.success(editing.id ? "Zone mise à jour." : "Zone ajoutée.");
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function removeZone(zone: ShippingZoneRow) {
    if (!window.confirm(`Supprimer la zone « ${zone.name} » ?`)) return;
    const res = await fetch(`/api/shipping-zones/${zone.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Impossible de supprimer la zone.");
      return;
    }
    setZones((current) => current.filter((z) => z.id !== zone.id));
    toast.success("Zone supprimée.");
    onChanged?.();
  }

  const noZone = shippingEnabled && zones.filter((z) => z.is_active).length === 0;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Interrupteurs */}
      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="shipping-enabled" className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-muted-foreground" />
              Je livre mes commandes
            </Label>
            <p id="shipping-enabled-help" className="text-[11px] text-muted-foreground">
              Les frais sont calculés selon le pays de l&apos;acheteur, d&apos;après tes zones
              ci-dessous, et ajoutés au total avant le paiement. Désactivé, la livraison se
              convient avec le client après la commande.
            </p>
          </div>
          <Switch
            id="shipping-enabled"
            checked={shippingEnabled}
            onCheckedChange={(v) => void toggleShipping(v)}
            disabled={togglePending !== null}
            aria-describedby="shipping-enabled-help"
          />
        </div>

        <div className={cn("flex items-start justify-between gap-4 border-t border-border pt-3", !shippingEnabled && "opacity-60")}>
          <div className="space-y-1">
            <Label htmlFor="cod-enabled" className="text-sm font-semibold">
              Accepter le paiement à la livraison
            </Label>
            <p id="cod-enabled-help" className="text-[11px] text-muted-foreground">
              L&apos;acheteur commande sans payer en ligne ; tu encaisses en espèces ou en
              Mobile Money à la remise du colis, puis tu marques la commande payée. Sans
              commission : Bio-Lien ne touche pas l&apos;argent.
              {!shippingEnabled && " Active d'abord la livraison."}
            </p>
          </div>
          <Switch
            id="cod-enabled"
            checked={cashOnDelivery}
            onCheckedChange={(v) => void toggleCod(v)}
            disabled={togglePending !== null || !shippingEnabled}
            aria-describedby="cod-enabled-help"
          />
        </div>
      </section>

      {/* Zones */}
      <section className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold tracking-tight">Zones de livraison</h3>
          </div>
          {!editing && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setEditing({ id: null, form: EMPTY_FORM })}
            >
              <Plus className="size-3.5" />
              Ajouter une zone
            </Button>
          )}
        </header>
        <p className="text-[11px] text-muted-foreground">
          Tarifs en {currency}. Un pays non couvert par une zone active ne peut pas commander
          en livraison.
        </p>

        {noZone && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            La livraison est activée mais aucune zone n&apos;est active : aucun acheteur ne
            pourra commander un article à livrer. Ajoute une zone.
          </p>
        )}

        {zones.length === 0 && !editing && (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune zone pour l&apos;instant.
          </p>
        )}

        <ul className="space-y-2">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{zone.name}</p>
                  {!zone.is_active && <Badge variant="secondary">Inactive</Badge>}
                  {zone.currency !== currency && (
                    <Badge variant="destructive">Tarif en {zone.currency} — à revoir</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {zone.countries.map(countryName).join(", ")}
                </p>
                <p className="text-sm">
                  {zone.rate === 0 ? "Gratuite" : formatPrice(zone.rate, zone.currency)}
                  {zone.free_above !== null && zone.rate > 0
                    ? ` · offerte dès ${formatPrice(zone.free_above, zone.currency)}`
                    : ""}
                  {deliveryDelayLabel(zone.estimated_min, zone.estimated_max)
                    ? ` · ${deliveryDelayLabel(zone.estimated_min, zone.estimated_max)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Modifier ${zone.name}`}
                  onClick={() => setEditing({ id: zone.id, form: fromRow(zone) })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer ${zone.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void removeZone(zone)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {editing && (
          <ZoneEditor
            currency={currency}
            form={editing.form}
            isNew={editing.id === null}
            saving={saving}
            onChange={(form) => setEditing({ ...editing, form })}
            onCancel={() => setEditing(null)}
            onSave={() => void saveZone()}
          />
        )}
      </section>
    </div>
  );
}

function ZoneEditor({
  currency,
  form,
  isNew,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  currency: string;
  form: ZoneForm;
  isNew: boolean;
  saving: boolean;
  onChange: (form: ZoneForm) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const toggleCountry = (code: string) =>
    onChange({
      ...form,
      countries: form.countries.includes(code)
        ? form.countries.filter((c) => c !== code)
        : [...form.countries, code],
    });

  return (
    <form
      className="space-y-4 rounded-xl border-2 border-primary/40 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <p className="text-sm font-semibold">{isNew ? "Nouvelle zone" : "Modifier la zone"}</p>

      <div className="space-y-1.5">
        <Label htmlFor="zone-name">Nom de la zone</Label>
        <Input
          id="zone-name"
          placeholder="Ex. Ouagadougou, Burkina & Côte d'Ivoire…"
          value={form.name}
          maxLength={100}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Pays desservis</Label>
        <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-3">
          {AFRICAN_COUNTRIES.map((c) => {
            const checked = form.countries.includes(c.code);
            return (
              <label
                key={c.code}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs",
                  checked ? "bg-primary/10 font-semibold" : "hover:bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={checked}
                  onChange={() => toggleCountry(c.code)}
                />
                {c.name}
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {form.countries.length} pays sélectionné{form.countries.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="zone-rate">Frais de livraison ({currency})</Label>
          <Input
            id="zone-rate"
            inputMode="decimal"
            placeholder="1500"
            value={form.rate}
            onChange={(e) => onChange({ ...form, rate: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">0 pour une livraison gratuite.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-free">Offerte à partir de ({currency}, optionnel)</Label>
          <Input
            id="zone-free"
            inputMode="decimal"
            placeholder="20000"
            value={form.free_above}
            onChange={(e) => onChange({ ...form, free_above: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-min">Délai minimum (jours, optionnel)</Label>
          <Input
            id="zone-min"
            inputMode="numeric"
            placeholder="1"
            value={form.estimated_min}
            onChange={(e) => onChange({ ...form, estimated_min: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-max">Délai maximum (jours, optionnel)</Label>
          <Input
            id="zone-max"
            inputMode="numeric"
            placeholder="3"
            value={form.estimated_max}
            onChange={(e) => onChange({ ...form, estimated_max: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <Label htmlFor="zone-active" className="text-sm">
          Zone active
        </Label>
        <Switch
          id="zone-active"
          checked={form.is_active}
          onCheckedChange={(v) => onChange({ ...form, is_active: v })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isNew ? "Ajouter la zone" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
