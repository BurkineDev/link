"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Plus,
  Trash2,
  Copy,
  Check,
  Tag,
  Loader2,
  Smartphone,
  Activity,
  QrCode as QrCodeIcon,
  Save,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QrCode } from "@/components/shared/qr-code";
import type { ShopRow, ShopLinkRow, PromoCodeRow } from "@/lib/types/database";

interface MarketingClientProps {
  shop: ShopRow;
  links: ShopLinkRow[];
  codes: PromoCodeRow[];
  publicShopUrl: string;
}

const LINK_ICONS = [
  { value: "custom", label: "🔗 Lien" },
  { value: "instagram", label: "📷 Instagram" },
  { value: "tiktok", label: "🎵 TikTok" },
  { value: "facebook", label: "📘 Facebook" },
  { value: "youtube", label: "▶️ YouTube" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "telegram", label: "✈️ Telegram" },
  { value: "email", label: "✉️ Email" },
  { value: "phone", label: "📞 Téléphone" },
  { value: "website", label: "🌐 Site web" },
  { value: "shop", label: "🛒 Boutique" },
];

export function MarketingClient({
  shop,
  links: initialLinks,
  codes: initialCodes,
  publicShopUrl,
}: MarketingClientProps) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing & croissance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tous les outils pour faire connaître ta boutique et convertir tes visiteurs.
        </p>
      </div>

      <Tabs defaultValue="links">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="links" className="gap-1.5">
            <Link2 className="size-3.5" />
            Liens CTA
          </TabsTrigger>
          <TabsTrigger value="promos" className="gap-1.5">
            <Tag className="size-3.5" />
            Codes promo
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1.5">
            <Activity className="size-3.5" />
            Pixels & WhatsApp
          </TabsTrigger>
          <TabsTrigger value="share" className="gap-1.5">
            <QrCodeIcon className="size-3.5" />
            Partage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="pt-6 space-y-6">
          <LinksSection
            shopId={shop.id}
            initialLinks={initialLinks}
            onChanged={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="promos" className="pt-6 space-y-6">
          <PromoCodesSection
            shopId={shop.id}
            initialCodes={initialCodes}
            currency={shop.currency}
            onChanged={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="tracking" className="pt-6 space-y-6">
          <TrackingSection shop={shop} onSaved={() => router.refresh()} />
        </TabsContent>

        <TabsContent value="share" className="pt-6 space-y-6">
          <ShareSection url={publicShopUrl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links section
// ---------------------------------------------------------------------------

function LinksSection({
  shopId,
  initialLinks,
  onChanged,
}: {
  shopId: string;
  initialLinks: ShopLinkRow[];
  onChanged: () => void;
}) {
  const [links, setLinks] = useState<ShopLinkRow[]>(initialLinks);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("custom");
  const [isAdding, setIsAdding] = useState(false);

  const add = async () => {
    if (!label.trim() || !url.trim()) {
      toast.error("Libellé et URL sont requis.");
      return;
    }
    setIsAdding(true);
    const res = await fetch("/api/shop-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopId,
        label: label.trim(),
        url: url.trim(),
        icon,
        position: links.length,
      }),
    });
    const data = await res.json();
    setIsAdding(false);
    if (!res.ok) {
      toast.error(data.error ?? "Échec.");
      return;
    }
    setLinks((cur) => [...cur, data.link]);
    setLabel("");
    setUrl("");
    setIcon("custom");
    onChanged();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/shop-links/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Suppression échouée.");
      return;
    }
    setLinks((cur) => cur.filter((l) => l.id !== id));
    onChanged();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const res = await fetch(`/api/shop-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      toast.error("Mise à jour échouée.");
      return;
    }
    setLinks((cur) => cur.map((l) => (l.id === id ? { ...l, is_active } : l)));
  };

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Liens CTA</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Affichés au-dessus de ta grille de produits — comme Linktree, mais
              dans ta boutique.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Icône</Label>
              <Select value={icon} onValueChange={(v) => setIcon(v ?? "custom")}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_ICONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Libellé</Label>
              <Input
                placeholder="Mon TikTok"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
              />
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                placeholder="https://tiktok.com/@..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={add} disabled={isAdding} className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {links.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Link2 className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun lien pour l&apos;instant. Ajoute ton premier ci-dessus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-base">
                  {LINK_ICONS.find((i) => i.value === link.icon)?.label.split(" ")[0] ?? "🔗"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{link.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={(v) => toggle(link.id, v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(link.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Promo codes section
// ---------------------------------------------------------------------------

function PromoCodesSection({
  shopId,
  initialCodes,
  currency,
  onChanged,
}: {
  shopId: string;
  initialCodes: PromoCodeRow[];
  currency: string;
  onChanged: () => void;
}) {
  const [codes, setCodes] = useState<PromoCodeRow[]>(initialCodes);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const add = async () => {
    const value = Number(discountValue);
    if (!code.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Code et remise sont requis.");
      return;
    }
    if (discountType === "percent" && value > 100) {
      toast.error("La remise en % ne peut pas dépasser 100.");
      return;
    }

    setIsAdding(true);
    const res = await fetch("/api/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopId,
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: value,
        min_order_amount: minOrder ? Number(minOrder) : null,
        max_uses: maxUses ? Number(maxUses) : null,
      }),
    });
    const data = await res.json();
    setIsAdding(false);
    if (!res.ok) {
      toast.error(data.error ?? "Échec.");
      return;
    }
    setCodes((cur) => [data.code, ...cur]);
    setCode("");
    setDiscountValue("");
    setMinOrder("");
    setMaxUses("");
    onChanged();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const res = await fetch(`/api/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      toast.error("Mise à jour échouée.");
      return;
    }
    setCodes((cur) => cur.map((c) => (c.id === id ? { ...c, is_active } : c)));
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/promo-codes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Suppression échouée.");
      return;
    }
    setCodes((cur) => cur.filter((c) => c.id !== id));
    onChanged();
  };

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Codes promo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crée un code que tes clients pourront utiliser au checkout.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                placeholder="BLACKFRIDAY"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                maxLength={30}
                className="uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType((v as "percent" | "fixed") ?? "percent")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% remise</SelectItem>
                  <SelectItem value="fixed">Montant fixe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{discountType === "percent" ? "% remise" : `Montant (${currency})`}</Label>
              <Input
                type="number"
                placeholder={discountType === "percent" ? "10" : "1000"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Achat min ({currency})</Label>
              <Input
                type="number"
                placeholder="-"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Usages max</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="∞"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min={1}
                />
                <Button
                  onClick={add}
                  disabled={isAdding}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 shrink-0"
                >
                  {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {codes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Tag className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun code promo. Crées-en un ci-dessus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-base font-bold tracking-wide">{c.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.discount_type === "percent"
                      ? `-${c.discount_value}%`
                      : `-${c.discount_value} ${currency}`}
                    {c.min_order_amount ? ` · min ${c.min_order_amount} ${currency}` : ""}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ""} usages
                </div>
                {c.is_active ? (
                  <Badge className="bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30 border">
                    Actif
                  </Badge>
                ) : (
                  <Badge variant="secondary">Désactivé</Badge>
                )}
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(v) => toggle(c.id, v)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pixels & WhatsApp section
// ---------------------------------------------------------------------------

function TrackingSection({ shop, onSaved }: { shop: ShopRow; onSaved: () => void }) {
  const [tiktok, setTiktok] = useState(shop.tiktok_pixel_id ?? "");
  const [meta, setMeta] = useState(shop.meta_pixel_id ?? "");
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("shops")
      .update({
        tiktok_pixel_id: tiktok.trim() || null,
        meta_pixel_id: meta.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23514"
          ? "Format invalide. Vérifie les champs."
          : error.message,
      );
      return;
    }
    toast.success("Réglages enregistrés.");
    onSaved();
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity className="size-4" />
            Pixels de retargeting
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Récupère tes IDs depuis TikTok Ads Manager et Meta Business Manager.
            Les pixels se chargent uniquement sur ta boutique publique.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tiktok">TikTok Pixel ID</Label>
            <Input
              id="tiktok"
              placeholder="C1XXXXXXXXXXXXXXXXX"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta">Meta Pixel ID</Label>
            <Input
              id="meta"
              placeholder="1234567890123456"
              value={meta}
              onChange={(e) => setMeta(e.target.value.replace(/\D/g, ""))}
              maxLength={20}
            />
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 pt-2">
            <Smartphone className="size-4" />
            Notifications WhatsApp
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reçois un message à chaque nouvelle commande payée. Ton numéro
            n&apos;est jamais visible par les acheteurs.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">Numéro WhatsApp (international)</Label>
          <Input
            id="whatsapp"
            placeholder="+2250708070000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            maxLength={20}
          />
        </div>

        <div className="pt-2">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Share / QR code section
// ---------------------------------------------------------------------------

function ShareSection({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier.");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Lien de partage</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Colle ce lien dans ta bio TikTok, Instagram, WhatsApp…
            </p>
          </div>
          <div className="flex gap-2">
            <Input value={url} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              onClick={copy}
              className="shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[var(--success)]" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copier
                </>
              )}
            </Button>
          </div>

          <div className="pt-2 text-xs text-muted-foreground">
            Astuce : utilise le QR code à droite pour partager ta boutique
            sur tes flyers ou tes vitrines physiques.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <h2 className="text-base font-semibold self-start">QR code</h2>
          <div className="rounded-2xl border-2 border-border p-3 bg-white">
            <QrCode value={url} size={200} alt={`QR code pour ${url}`} />
          </div>
          <a
            href={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=600x600&margin=1&qzone=1&format=png&color=0F0F0F&bgcolor=FFFFFF`}
            download={`linkboutik-qr.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors w-full justify-center"
          >
            <Download className="size-3.5" />
            Télécharger (PNG HD)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
