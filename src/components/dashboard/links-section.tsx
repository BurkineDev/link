"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Link2,
  Camera,
  Music2,
  Share2,
  Video,
  MessageCircle,
  Send,
  Mail,
  Phone,
  Globe,
  ShoppingBag,
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShopLinkRow } from "@/lib/types/database";

// Map each link kind to a Lucide SVG icon (no emojis — keeps the UI premium).
const LINK_ICON_MAP: Record<string, LucideIcon> = {
  custom: Link2,
  instagram: Camera,
  tiktok: Music2,
  facebook: Share2,
  youtube: Video,
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
  phone: Phone,
  website: Globe,
  shop: ShoppingBag,
};

export const LINK_ICONS = [
  { value: "custom", label: "Lien" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Téléphone" },
  { value: "website", label: "Site web" },
  { value: "shop", label: "Boutique" },
] as const;

function LinkIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = LINK_ICON_MAP[name] ?? Link2;
  return <Cmp className={className} />;
}

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
  const [busyId, setBusyId] = useState<string | null>(null);

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
    toast.success("Lien ajouté.");
    onChanged?.();
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/shop-links/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Suppression échouée.");
      return;
    }
    setLinks((cur) => cur.filter((l) => l.id !== id));
    onChanged?.();
  };

  const toggle = async (id: string, is_active: boolean) => {
    // Optimistic — revert on failure so the switch always reflects the truth.
    setLinks((cur) =>
      cur.map((l) => (l.id === id ? { ...l, is_active } : l)),
    );
    const res = await fetch(`/api/shop-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      toast.error("Mise à jour échouée.");
      setLinks((cur) =>
        cur.map((l) => (l.id === id ? { ...l, is_active: !is_active } : l)),
      );
    }
  };

  const activeCount = links.filter((l) => l.is_active).length;

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Ajouter un lien</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Affichés en haut de ta boutique, façon Linktree.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={icon} onValueChange={(v) => setIcon(v ?? "custom")}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_ICONS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    <span className="flex items-center gap-2">
                      <LinkIcon name={i.value} className="size-4 text-muted-foreground" />
                      {i.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé</Label>
            <Input
              placeholder="Mon TikTok"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              placeholder="https://tiktok.com/@…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
            />
          </div>
          <Button onClick={add} disabled={isAdding} className="gap-1.5">
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Ajouter
          </Button>
        </div>
      </div>

      {/* List */}
      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Link2 className="mx-auto mb-2 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun lien pour l&apos;instant. Ajoute ton premier ci-dessus.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            {links.length} lien{links.length > 1 ? "s" : ""} · {activeCount}{" "}
            actif{activeCount > 1 ? "s" : ""}
          </p>
          {links.map((link) => (
            <div
              key={link.id}
              className={cnRow(link.is_active)}
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LinkIcon name={link.icon} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{link.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {link.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={link.is_active}
                  onCheckedChange={(v) => toggle(link.id, v)}
                  aria-label={link.is_active ? "Désactiver le lien" : "Activer le lien"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(link.id)}
                  disabled={busyId === link.id}
                  aria-label="Supprimer le lien"
                  className="text-muted-foreground hover:text-destructive"
                >
                  {busyId === link.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cnRow(active: boolean): string {
  return [
    "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-200",
    active ? "border-border" : "border-border/60 opacity-60",
  ].join(" ");
}
