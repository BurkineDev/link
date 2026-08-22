"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BLOCK_CONFIG_SCHEMAS,
  BLOCK_TYPE_META,
  type BlockType,
} from "@/lib/blocks/types";
import type { ShopRow } from "@/lib/types/database";

/**
 * Formulaire d'édition d'un bloc.
 *
 * Un champ par clé de config, dérivé du type. La validation finale reste
 * celle du schéma Zod partagé avec l'API : le formulaire guide, il ne
 * remplace pas la validation serveur.
 */

interface BlockEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: BlockType;
  initialConfig: unknown;
  initialTitle: string | null;
  onSubmit: (config: unknown, title: string | null) => void | Promise<void>;
}

/** Config de départ d'un nouveau bloc, pré-remplie depuis la boutique. */
export function defaultConfigFor(type: BlockType, shop: ShopRow): unknown {
  switch (type) {
    case "LINK":
      return { url: "", label: "", icon: "custom" };
    case "WHATSAPP":
      return {
        phone: shop.whatsapp_number ?? "",
        label: "Commander sur WhatsApp",
      };
    case "TEXT":
      return { body: "", align: "center" };
    case "IMAGE":
      return { url: "", alt: "" };
    case "PRODUCT_COLLECTION":
      return { layout: "grid", limit: 12, productIds: [] };
    case "PRODUCT":
      return { productId: "", featured: false };
    case "SOCIAL":
      return { networks: [] };
    default:
      return {};
  }
}

export function BlockEditorDialog({
  open,
  onOpenChange,
  type,
  initialConfig,
  initialTitle,
  onSubmit,
}: BlockEditorDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    (initialConfig as Record<string, unknown>) ?? {},
  );
  const [title, setTitle] = useState(initialTitle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = BLOCK_TYPE_META[type];
  const set = (key: string, value: unknown) =>
    setConfig((cur) => ({ ...cur, [key]: value }));

  const submit = async () => {
    // Valider ici avec le schéma partagé évite un aller-retour réseau pour
    // une faute de frappe, et donne un message avant l'envoi.
    const schema = BLOCK_CONFIG_SCHEMAS[type];
    const result = schema.safeParse(config);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Vérifie les champs du bloc.",
      );
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(result.data, title.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {type === "LINK" && (
            <>
              <Field label="Libellé">
                <Input
                  value={String(config.label ?? "")}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="Mon TikTok"
                  maxLength={120}
                />
              </Field>
              <Field label="Adresse">
                <Input
                  value={String(config.url ?? "")}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://tiktok.com/@moi"
                  inputMode="url"
                />
              </Field>
              <Field label="Vignette (optionnelle)" hint="Adresse d'image en https://">
                <Input
                  value={String(config.thumbnailUrl ?? "")}
                  onChange={(e) =>
                    set("thumbnailUrl", e.target.value || null)
                  }
                  placeholder="https://…"
                  inputMode="url"
                />
              </Field>
            </>
          )}

          {type === "WHATSAPP" && (
            <>
              <Field label="Libellé du bouton">
                <Input
                  value={String(config.label ?? "")}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="Commander sur WhatsApp"
                />
              </Field>
              <Field
                label="Numéro"
                hint="Laisse vide pour utiliser celui de ta boutique"
              >
                <Input
                  value={String(config.phone ?? "")}
                  onChange={(e) => set("phone", e.target.value || null)}
                  placeholder="+226 70 00 00 00"
                  inputMode="tel"
                />
              </Field>
              <Field label="Message pré-rempli (optionnel)">
                <Textarea
                  value={String(config.prefilledMessage ?? "")}
                  onChange={(e) =>
                    set("prefilledMessage", e.target.value || null)
                  }
                  placeholder="Bonjour, je suis intéressé(e) par…"
                  rows={3}
                />
              </Field>
            </>
          )}

          {type === "TEXT" && (
            <Field label="Texte">
              <Textarea
                value={String(config.body ?? "")}
                onChange={(e) => set("body", e.target.value)}
                placeholder="Livraison gratuite à Ouaga cette semaine !"
                rows={4}
              />
            </Field>
          )}

          {type === "IMAGE" && (
            <>
              <Field label="Adresse de l'image" hint="En https://">
                <Input
                  value={String(config.url ?? "")}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
              </Field>
              <Field label="Description (accessibilité)">
                <Input
                  value={String(config.alt ?? "")}
                  onChange={(e) => set("alt", e.target.value)}
                  placeholder="Robe en wax bleue"
                />
              </Field>
            </>
          )}

          {type === "PRODUCT_COLLECTION" && (
            <Field
              label="Nombre de produits affichés"
              hint="Tes produits publiés, du plus récent au plus ancien"
            >
              <Input
                type="number"
                min={1}
                max={50}
                value={Number(config.limit ?? 12)}
                onChange={(e) => set("limit", Number(e.target.value))}
              />
            </Field>
          )}

          {type === "PRODUCT" && (
            <Field
              label="Identifiant du produit"
              hint="Copie-le depuis l'adresse de la page d'édition du produit"
            >
              <Input
                value={String(config.productId ?? "")}
                onChange={(e) => set("productId", e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
          )}

          {type === "SOCIAL" && (
            <p className="text-sm text-muted-foreground">
              Ce bloc affiche les réseaux renseignés dans Réglages → Contact.
              Rien à configurer ici.
            </p>
          )}

          <Field label="Titre au-dessus du bloc (optionnel)">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mes nouveautés"
              maxLength={120}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
