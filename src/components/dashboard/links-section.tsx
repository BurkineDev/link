"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShopLinkRow } from "@/lib/types/database";

export const LINK_ICONS = [
  { value: "custom",    label: "🔗 Lien" },
  { value: "instagram", label: "📷 Instagram" },
  { value: "tiktok",    label: "🎵 TikTok" },
  { value: "facebook",  label: "📘 Facebook" },
  { value: "youtube",   label: "▶️ YouTube" },
  { value: "whatsapp",  label: "💬 WhatsApp" },
  { value: "telegram",  label: "✈️ Telegram" },
  { value: "email",     label: "✉️ Email" },
  { value: "phone",     label: "📞 Téléphone" },
  { value: "website",   label: "🌐 Site web" },
  { value: "shop",      label: "🛒 Boutique" },
] as const;

interface LinksSectionProps {
  shopId: string;
  initialLinks: ShopLinkRow[];
  onChanged?: () => void;
}

export function LinksSection({
  shopId,
  initialLinks,
  onChanged,
}: LinksSectionProps) {
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
      toast.error(data.error ?? "Échec de l'ajout.");
      return;
    }
    setLinks((cur) => [...cur, data.link]);
    setLabel("");
    setUrl("");
    setIcon("custom");
    onChanged?.();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/shop-links/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Suppression échouée.");
      return;
    }
    setLinks((cur) => cur.filter((l) => l.id !== id));
    onChanged?.();
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
    setLinks((cur) =>
      cur.map((l) => (l.id === id ? { ...l, is_active } : l)),
    );
  };

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Liens CTA</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Affichés au-dessus de ta grille de produits — comme Linktree,
              mais dans ta boutique.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Icône</Label>
              <Select
                value={icon}
                onValueChange={(v) => setIcon(v ?? "custom")}
              >
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
            <Button
              onClick={add}
              disabled={isAdding}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
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
                  <p className="text-xs text-muted-foreground truncate">
                    {link.url}
                  </p>
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
