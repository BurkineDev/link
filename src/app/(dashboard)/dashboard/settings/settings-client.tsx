"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ShopRow, ShopLinkRow } from "@/lib/types/database";
import type {
  ShopFontFamily,
  ShopBorderRadius,
  ShopCardStyle,
  ShopCtaShape,
  ShopCtaStyle,
} from "@/lib/types/database";
import {
  CURRENCIES,
  CURRENCY_META,
  TEMPLATES,
  SHOP_THEME_COLORS,
  SHOP_FONTS,
  SHOP_BORDER_RADIUS,
  SHOP_CARD_STYLES,
  SHOP_CTA_SHAPES,
  SHOP_CTA_STYLES,
  FONT_FAMILY_CLASS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  EyeOff,
  Sparkles,
  Type,
  Square,
  Layers,
  MousePointerClick,
  Palette,
  RotateCcw,
} from "lucide-react";

import { ThemePreview } from "@/components/dashboard/theme-preview";
import { LinksSection } from "@/components/dashboard/links-section";

interface SettingsClientProps {
  shop: ShopRow;
  links: ShopLinkRow[];
}

// ---------------------------------------------------------------------------
// Logo / Banner uploader
// ---------------------------------------------------------------------------

interface ImageFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  shopId: string;
  storageKey: string;
  aspectClass?: string;
}

function ImageField({
  label,
  value,
  onChange,
  shopId,
  storageKey,
  aspectClass = "aspect-square",
}: ImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const supabase = createClient();
    const path = `${shopId}/${storageKey}-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const { data, error } = await supabase.storage
      .from("shop-assets")
      .upload(path, file, { upsert: true });

    if (error || !data) {
      toast.error("Échec de l'upload.");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("shop-assets").getPublicUrl(data.path);

    onChange(publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-muted cursor-pointer hover:border-primary/50 transition-colors",
          aspectClass,
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Upload className="size-6" />
            <span className="text-xs">Cliquez pour choisir</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onChange(null)}
        >
          <Trash2 className="size-3.5" />
          Supprimer
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color picker
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SHOP_THEME_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              "size-8 rounded-full ring-offset-2 transition-all",
              value === c.value
                ? "ring-2 ring-foreground"
                : "hover:scale-110",
            )}
            style={{ backgroundColor: c.value }}
          >
            {value === c.value && (
              <Check className="size-4 text-white mx-auto drop-shadow" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="size-8 rounded-full border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366F1"
          className="font-mono max-w-32"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic option-grid (used by Bordures, Card style, CTA shape, CTA style)
// ---------------------------------------------------------------------------

interface OptionGridProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{
    value: T;
    label: string;
    description?: string;
    pxHint?: string;
  }>;
  cols?: 2 | 3 | 4 | 6;
  renderPreview?: (value: T, selected: boolean) => React.ReactNode;
}

function OptionGrid<T extends string>({
  value,
  onChange,
  options,
  cols = 3,
  renderPreview,
}: OptionGridProps<T>) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    6: "grid-cols-3 sm:grid-cols-6",
  }[cols];

  return (
    <div className={cn("grid gap-2", colsClass)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all",
              "hover:border-foreground/40",
              selected
                ? "border-foreground bg-foreground/5 ring-2 ring-foreground"
                : "border-border",
            )}
          >
            {renderPreview ? (
              renderPreview(opt.value, selected)
            ) : null}
            <span className="text-xs font-semibold text-foreground">
              {opt.label}
            </span>
            {opt.description && (
              <span className="text-[10px] text-muted-foreground line-clamp-1">
                {opt.description}
              </span>
            )}
            {opt.pxHint && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {opt.pxHint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SettingsClient
// ---------------------------------------------------------------------------

export function SettingsClient({ shop, links }: SettingsClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // ---- General ----
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [description, setDescription] = useState(shop.description ?? "");
  const [logoUrl, setLogoUrl] = useState(shop.logo_url);
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url);

  // ---- Appearance ----
  const [templateId, setTemplateId] = useState(shop.template_id ?? "minimal");
  const [themeColor, setThemeColor] = useState(shop.theme_color);
  const [accentColor, setAccentColor] = useState(shop.accent_color);
  const [fontFamily, setFontFamily] = useState<ShopFontFamily>(shop.font_family);
  const [borderRadius, setBorderRadius] = useState<ShopBorderRadius>(
    shop.border_radius,
  );
  const [cardStyle, setCardStyle] = useState<ShopCardStyle>(shop.card_style);
  const [ctaShape, setCtaShape] = useState<ShopCtaShape>(shop.cta_shape);
  const [ctaStyle, setCtaStyle] = useState<ShopCtaStyle>(shop.cta_style);

  // ---- Contact ----
  const [contactEmail, setContactEmail] = useState(shop.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(shop.contact_phone ?? "");
  const [instagram, setInstagram] = useState(
    shop.social_links?.instagram ?? "",
  );
  const [facebook, setFacebook] = useState(shop.social_links?.facebook ?? "");
  const [tiktok, setTiktok] = useState(shop.social_links?.tiktok ?? "");
  const [twitter, setTwitter] = useState(shop.social_links?.twitter ?? "");

  // ---- Payments ----
  const [currency, setCurrency] = useState(shop.currency);
  const [flutterwaveKey, setFlutterwaveKey] = useState<string>("");

  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------

  const saveGeneral = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        name,
        slug,
        description: description || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);

    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Cette adresse est déjà utilisée. Choisis-en une autre.");
      } else if (error.code === "23514") {
        toast.error(
          "Adresse invalide. Utilise uniquement lettres minuscules, chiffres et tirets.",
        );
      } else {
        toast.error(error.message ?? "Erreur lors de la sauvegarde.");
      }
    } else {
      toast.success("Informations mises à jour.");
      router.refresh();
    }
  };

  const saveAppearance = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        template_id: templateId,
        theme_color: themeColor,
        accent_color: accentColor,
        font_family: fontFamily,
        border_radius: borderRadius,
        card_style: cardStyle,
        cta_shape: ctaShape,
        cta_style: ctaStyle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);

    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Erreur lors de la sauvegarde.");
    } else {
      toast.success("Apparence mise à jour.");
      router.refresh();
    }
  };

  const resetAppearance = () => {
    setTemplateId(shop.template_id ?? "minimal");
    setThemeColor(shop.theme_color);
    setAccentColor(shop.accent_color);
    setFontFamily(shop.font_family);
    setBorderRadius(shop.border_radius);
    setCardStyle(shop.card_style);
    setCtaShape(shop.cta_shape);
    setCtaStyle(shop.cta_style);
  };

  const saveContact = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        social_links: {
          instagram: instagram || undefined,
          facebook: facebook || undefined,
          tiktok: tiktok || undefined,
          twitter: twitter || undefined,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Contact mis à jour.");
  };

  const savePayments = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        currency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Paramètres de paiement mis à jour.");
  };

  const handleUnpublish = async () => {
    const { error } = await supabase
      .from("shops")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", shop.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Boutique dépubliée.");
      router.refresh();
    }
  };

  const handleDeleteShop = async () => {
    const { error } = await supabase.from("shops").delete().eq("id", shop.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Boutique supprimée.");
      router.push("/dashboard");
    }
  };

  // Detect unsaved appearance changes
  const appearanceDirty =
    templateId !== (shop.template_id ?? "minimal") ||
    themeColor !== shop.theme_color ||
    accentColor !== shop.accent_color ||
    fontFamily !== shop.font_family ||
    borderRadius !== shop.border_radius ||
    cardStyle !== shop.card_style ||
    ctaShape !== shop.cta_shape ||
    ctaStyle !== shop.cta_style;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre boutique, son apparence et vos paiements.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Apparence
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <MousePointerClick className="size-3.5" />
            Liens CTA
          </TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger
            value="danger"
            className="text-destructive data-active:text-destructive"
          >
            Zone de danger
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* GÉNÉRAL */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="general" className="space-y-6 pt-6">
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="shop-name">Nom de la boutique</Label>
              <Input
                id="shop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ma boutique"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shop-slug">URL de la boutique</Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex h-8 items-center rounded-l-lg border border-r-0 border-border bg-muted px-2.5 text-xs text-muted-foreground">
                  linkboutik.com/
                </span>
                <Input
                  id="shop-slug"
                  className="rounded-l-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shop-desc">Description</Label>
              <Textarea
                id="shop-desc"
                rows={4}
                placeholder="Décrivez votre boutique…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ImageField
                label="Logo"
                value={logoUrl}
                onChange={setLogoUrl}
                shopId={shop.id}
                storageKey="logo"
                aspectClass="aspect-square max-h-40"
              />
              <ImageField
                label="Bannière"
                value={bannerUrl}
                onChange={setBannerUrl}
                shopId={shop.id}
                storageKey="banner"
                aspectClass="aspect-video"
              />
            </div>

            <Button onClick={saveGeneral} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* APPARENCE — split-pane editor + live preview */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="appearance" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            {/* ── Left column: controls ── */}
            <div className="space-y-8 min-w-0">
              {/* Template */}
              <section className="space-y-3">
                <header className="flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Template
                  </h3>
                </header>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TEMPLATES.map((tpl) => {
                    const selected = templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplateId(tpl.id)}
                        className={cn(
                          "group overflow-hidden rounded-xl border text-left transition-all",
                          selected
                            ? "border-foreground ring-2 ring-foreground"
                            : "border-border hover:border-foreground/40",
                        )}
                      >
                        <div className="relative aspect-[4/3] bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tpl.preview_image}
                            alt={tpl.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          {selected && (
                            <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                              <Check className="size-3" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold">{tpl.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                            {tpl.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              {/* Couleurs */}
              <section className="space-y-3">
                <header className="flex items-center gap-2">
                  <Palette className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Couleurs
                  </h3>
                </header>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Couleur primaire</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Boutons d&apos;achat, accents, navigation
                    </p>
                    <ColorPicker value={themeColor} onChange={setThemeColor} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Couleur d&apos;accent</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Texte sur boutons primaires & contrastes
                    </p>
                    <ColorPicker
                      value={accentColor}
                      onChange={setAccentColor}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Typographie */}
              <section className="space-y-3">
                <header className="flex items-center gap-2">
                  <Type className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Typographie
                  </h3>
                </header>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SHOP_FONTS.map((f) => {
                    const selected = fontFamily === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFontFamily(f.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all",
                          FONT_FAMILY_CLASS[f.value],
                          selected
                            ? "border-foreground bg-foreground/5 ring-2 ring-foreground"
                            : "border-border hover:border-foreground/40",
                        )}
                      >
                        <span className="text-3xl leading-none">
                          {f.sample}
                        </span>
                        <span className="text-xs font-semibold">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1 font-sans">
                          {f.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              {/* Bordures */}
              <section className="space-y-3">
                <header className="flex items-center gap-2">
                  <Square className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Bordures des cartes
                  </h3>
                </header>
                <OptionGrid
                  value={borderRadius}
                  onChange={setBorderRadius}
                  cols={6}
                  options={SHOP_BORDER_RADIUS.map((r) => ({
                    value: r.value,
                    label: r.label,
                    pxHint: r.pxHint,
                  }))}
                  renderPreview={(value) => (
                    <div
                      className={cn(
                        "size-8 border-2 border-foreground/70 bg-foreground/5",
                        {
                          "rounded-none": value === "none",
                          "rounded-sm": value === "sm",
                          "rounded-md": value === "md",
                          "rounded-lg": value === "lg",
                          "rounded-xl": value === "xl",
                          "rounded-2xl": value === "2xl",
                        },
                      )}
                    />
                  )}
                />
              </section>

              <Separator />

              {/* Style des cartes */}
              <section className="space-y-3">
                <header className="flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Style des cartes produits
                  </h3>
                </header>
                <OptionGrid
                  value={cardStyle}
                  onChange={setCardStyle}
                  cols={4}
                  options={SHOP_CARD_STYLES.map((s) => ({
                    value: s.value,
                    label: s.label,
                    description: s.description,
                  }))}
                  renderPreview={(value) => (
                    <div
                      className={cn(
                        "size-10 rounded-md bg-background",
                        value === "flat" && "",
                        value === "bordered" &&
                          "border border-border/60 shadow-sm",
                        value === "elevated" && "shadow-md",
                        value === "glass" &&
                          "border border-white/30 bg-white/40 backdrop-blur",
                      )}
                    />
                  )}
                />
              </section>

              <Separator />

              {/* Boutons CTA */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <MousePointerClick className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Boutons CTA
                  </h3>
                </header>
                <div className="space-y-3">
                  <Label className="text-xs">Forme</Label>
                  <OptionGrid
                    value={ctaShape}
                    onChange={setCtaShape}
                    cols={3}
                    options={SHOP_CTA_SHAPES.map((s) => ({
                      value: s.value,
                      label: s.label,
                      description: s.description,
                    }))}
                    renderPreview={(value) => (
                      <div
                        className={cn(
                          "h-7 w-16 bg-foreground",
                          value === "pill" && "rounded-full",
                          value === "rounded" && "rounded-xl",
                          value === "square" && "rounded-none",
                        )}
                      />
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs">Style</Label>
                  <OptionGrid
                    value={ctaStyle}
                    onChange={setCtaStyle}
                    cols={3}
                    options={SHOP_CTA_STYLES.map((s) => ({
                      value: s.value,
                      label: s.label,
                      description: s.description,
                    }))}
                    renderPreview={(value) => {
                      const baseStyle: React.CSSProperties = {
                        backgroundColor:
                          value === "filled"
                            ? themeColor
                            : value === "soft"
                              ? `${themeColor}25`
                              : "transparent",
                        color:
                          value === "filled" ? accentColor : themeColor,
                        border:
                          value === "outline"
                            ? `2px solid ${themeColor}`
                            : "none",
                      };
                      return (
                        <div
                          className="flex h-7 w-16 items-center justify-center rounded-xl text-[10px] font-bold"
                          style={baseStyle}
                        >
                          CTA
                        </div>
                      );
                    }}
                  />
                </div>
              </section>

              {/* Save bar */}
              <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 border-t border-border bg-background/95 backdrop-blur px-1 py-3">
                <p className="text-xs text-muted-foreground">
                  {appearanceDirty
                    ? "Modifications non enregistrées"
                    : "Tout est synchronisé"}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetAppearance}
                    disabled={!appearanceDirty || saving}
                  >
                    <RotateCcw className="size-4" />
                    Annuler
                  </Button>
                  <Button
                    onClick={saveAppearance}
                    disabled={!appearanceDirty || saving}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Enregistrer l&apos;apparence
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Right column: live preview ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Aperçu en direct
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      appearanceDirty
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {appearanceDirty ? "Non publié" : "À jour"}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                  <div className="h-[560px]">
                    <ThemePreview
                      shopName={name || "Ma boutique"}
                      logoUrl={logoUrl}
                      primaryColor={themeColor}
                      accentColor={accentColor}
                      fontFamily={fontFamily}
                      borderRadius={borderRadius}
                      cardStyle={cardStyle}
                      ctaShape={ctaShape}
                      ctaStyle={ctaStyle}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  La boutique publique se mettra à jour après enregistrement.
                </p>
              </div>
            </aside>

            {/* Mobile preview (below controls on small screens) */}
            <div className="lg:hidden">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Aperçu
              </p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="h-[480px]">
                  <ThemePreview
                    shopName={name || "Ma boutique"}
                    logoUrl={logoUrl}
                    primaryColor={themeColor}
                    accentColor={accentColor}
                    fontFamily={fontFamily}
                    borderRadius={borderRadius}
                    cardStyle={cardStyle}
                    ctaShape={ctaShape}
                    ctaStyle={ctaStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* LIENS CTA */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="links" className="space-y-6 pt-6">
          <div className="max-w-3xl">
            <LinksSection
              shopId={shop.id}
              initialLinks={links}
              onChanged={() => router.refresh()}
            />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* CONTACT */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="contact" className="space-y-6 pt-6">
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">E-mail de contact</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="boutique@exemple.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Téléphone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+225 07 00 00 00 00"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            <Separator />

            <p className="text-sm font-medium">Réseaux sociaux</p>

            {[
              {
                id: "instagram",
                label: "Instagram",
                placeholder: "https://instagram.com/maboutique",
                value: instagram,
                set: setInstagram,
              },
              {
                id: "facebook",
                label: "Facebook",
                placeholder: "https://facebook.com/maboutique",
                value: facebook,
                set: setFacebook,
              },
              {
                id: "tiktok",
                label: "TikTok",
                placeholder: "https://tiktok.com/@maboutique",
                value: tiktok,
                set: setTiktok,
              },
              {
                id: "twitter",
                label: "Twitter / X",
                placeholder: "https://x.com/maboutique",
                value: twitter,
                set: setTwitter,
              },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  type="url"
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                />
              </div>
            ))}

            <Button onClick={saveContact} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* PAIEMENTS */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="payments" className="space-y-6 pt-6">
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <Label>Devise principale</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as typeof currency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c} — {CURRENCY_META[c].symbol} ({CURRENCY_META[c].region})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="flutterwave-key">
                Clé publique Flutterwave{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="flutterwave-key"
                type="text"
                placeholder="FLWPUBK_TEST-…"
                value={flutterwaveKey}
                onChange={(e) => setFlutterwaveKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Trouvez votre clé dans le tableau de bord Flutterwave →
                Paramètres → API.
              </p>
            </div>

            <Button onClick={savePayments} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* ZONE DE DANGER */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="danger" className="space-y-6 pt-6">
          <div className="space-y-4 max-w-xl">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <EyeOff className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">
                    Dépublier la boutique
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Votre boutique ne sera plus visible par vos clients. Vous
                    pourrez la republier à tout moment.
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!shop.is_published}
                    />
                  }
                >
                  {shop.is_published
                    ? "Dépublier la boutique"
                    : "Déjà hors ligne"}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <EyeOff className="size-5" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Dépublier la boutique ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Votre boutique <strong>{shop.name}</strong> ne sera plus
                      accessible au public. Vous pourrez la republier depuis
                      les paramètres.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnpublish}>
                      Dépublier
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    Supprimer la boutique
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cette action est irréversible. Tous vos produits,
                    commandes et données seront définitivement supprimés.
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive" size="sm" />}
                >
                  <Trash2 className="size-4" />
                  Supprimer la boutique
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <AlertTriangle className="size-5 text-destructive" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>
                      Supprimer définitivement la boutique ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Toutes les données liées à{" "}
                      <strong>{shop.name}</strong> seront supprimées. Pour
                      confirmer, tapez le nom de votre boutique ci-dessous.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <Input
                    placeholder={shop.name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="mt-2"
                  />

                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setDeleteConfirmName("")}
                    >
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDeleteShop}
                      disabled={deleteConfirmName !== shop.name}
                    >
                      Supprimer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
