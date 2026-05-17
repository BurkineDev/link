"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/types/database";
import { CURRENCIES, CURRENCY_META, TEMPLATES, SHOP_THEME_COLORS } from "@/lib/constants";
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
  Store,
} from "lucide-react";

type Shop = Row<"shops">;

interface SettingsClientProps {
  shop: Shop;
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
          aspectClass
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
                : "hover:scale-110"
            )}
            style={{ backgroundColor: c.value }}
          >
            {value === c.value && (
              <Check className="size-4 text-white mx-auto drop-shadow" />
            )}
          </button>
        ))}
      </div>
      {/* Custom hex input */}
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
// Main SettingsClient
// ---------------------------------------------------------------------------

export function SettingsClient({ shop }: SettingsClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Form state — general
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [description, setDescription] = useState(shop.description ?? "");
  const [logoUrl, setLogoUrl] = useState(shop.logo_url);
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url);

  // Appearance
  const [templateId, setTemplateId] = useState(shop.template_id ?? "minimal");
  const [themeColor, setThemeColor] = useState(shop.theme_color);

  // Contact
  const [contactEmail, setContactEmail] = useState(shop.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(shop.contact_phone ?? "");
  const [instagram, setInstagram] = useState(shop.social_links?.instagram ?? "");
  const [facebook, setFacebook] = useState(shop.social_links?.facebook ?? "");
  const [tiktok, setTiktok] = useState(shop.social_links?.tiktok ?? "");
  const [twitter, setTwitter] = useState(shop.social_links?.twitter ?? "");

  // Payments
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
      toast.error(error.message ?? "Erreur lors de la sauvegarde.");
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Apparence mise à jour.");
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
    const { error } = await supabase
      .from("shops")
      .delete()
      .eq("id", shop.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Boutique supprimée.");
      router.push("/dashboard");
    }
  };

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
          <TabsTrigger value="appearance">Apparence</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive data-active:text-destructive">
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
        {/* APPARENCE */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="appearance" className="space-y-6 pt-6">
          <div className="space-y-6 max-w-2xl">
            {/* Template selector */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Thème de la boutique
              </Label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    className={cn(
                      "rounded-xl border overflow-hidden text-left transition-all",
                      templateId === tpl.id
                        ? "border-primary ring-2 ring-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="aspect-video bg-muted relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tpl.preview_image}
                        alt={tpl.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {templateId === tpl.id && (
                        <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                          <Check className="size-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Theme color */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Couleur principale</Label>
              <ColorPicker value={themeColor} onChange={setThemeColor} />
            </div>

            <Button onClick={saveAppearance} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Enregistrer l&apos;apparence
            </Button>
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
            {/* Unpublish shop */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <EyeOff className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Dépublier la boutique</p>
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
                  {shop.is_published ? "Dépublier la boutique" : "Déjà hors ligne"}
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

            {/* Delete shop */}
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
                <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
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
