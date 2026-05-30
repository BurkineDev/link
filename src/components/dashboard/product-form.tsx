"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  createProductSchema,
  type CreateProductInput,
  type ProductVariantInput,
} from "@/lib/validations/product";
import { CURRENCIES, CURRENCY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types/database";
import { ImageUploader } from "@/components/dashboard/image-uploader";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = Pick<Row<"categories">, "id" | "name">;

interface ProductFormProps {
  shopId: string;
  categories: Category[];
  /** Pre-filled values for edit mode */
  defaultValues?: Partial<CreateProductInput>;
  /** The DB product id when editing */
  productId?: string;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Informations de base", number: 1 },
  { label: "Images & Prix", number: 2 },
  { label: "Variantes & Stock", number: 3 },
];

const PRODUCT_DRAFT_KEY = "linkboutik:product-draft";

type ProductDraft = {
  name?: unknown;
  description?: unknown;
  price?: unknown;
};

// ---------------------------------------------------------------------------
// VariantBuilder sub-component
// ---------------------------------------------------------------------------

interface VariantBuilderProps {
  variants: ProductVariantInput[];
  onChange: (variants: ProductVariantInput[]) => void;
  error?: string;
}

function VariantBuilder({ variants, onChange, error }: VariantBuilderProps) {
  const addVariant = () => {
    onChange([
      ...variants,
      {
        name: "",
        options: [{ name: "Taille", value: "" }],
        price: null,
        stock_quantity: null,
        sku: null,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (
    index: number,
    key: keyof ProductVariantInput,
    value: unknown
  ) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)));
  };

  const addOption = (vIndex: number) => {
    const updated = variants.map((v, i) =>
      i === vIndex
        ? { ...v, options: [...v.options, { name: "", value: "" }] }
        : v
    );
    onChange(updated);
  };

  const removeOption = (vIndex: number, oIndex: number) => {
    const updated = variants.map((v, i) =>
      i === vIndex
        ? { ...v, options: v.options.filter((_, j) => j !== oIndex) }
        : v
    );
    onChange(updated);
  };

  const updateOption = (
    vIndex: number,
    oIndex: number,
    key: "name" | "value",
    value: string
  ) => {
    const updated = variants.map((v, i) =>
      i === vIndex
        ? {
            ...v,
            options: v.options.map((o, j) =>
              j === oIndex ? { ...o, [key]: value } : o
            ),
          }
        : v
    );
    onChange(updated);
  };

  const PRESET_OPTION_NAMES = ["Taille", "Couleur", "Matière", "Style"];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {variants.map((variant, vIndex) => (
        <div
          key={vIndex}
          className="rounded-xl border border-border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Variante {vIndex + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeVariant(vIndex)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          {/* Variant name */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Nom de la variante
            </Label>
            <Input
              placeholder="ex : Rouge / XL"
              value={variant.name}
              onChange={(e) => updateVariant(vIndex, "name", e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Options</Label>
            {variant.options.map((option, oIndex) => (
              <div key={oIndex} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    list={`option-names-${vIndex}-${oIndex}`}
                    placeholder="Attribut (ex : Taille)"
                    value={option.name}
                    onChange={(e) =>
                      updateOption(vIndex, oIndex, "name", e.target.value)
                    }
                  />
                  <datalist id={`option-names-${vIndex}-${oIndex}`}>
                    {PRESET_OPTION_NAMES.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Valeur (ex : XL)"
                    value={option.value}
                    onChange={(e) =>
                      updateOption(vIndex, oIndex, "value", e.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={variant.options.length <= 1}
                  onClick={() => removeOption(vIndex, oIndex)}
                  className="text-muted-foreground"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {variant.options.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addOption(vIndex)}
              >
                <Plus className="size-3.5" />
                Ajouter une option
              </Button>
            )}
          </div>

          {/* Price & Stock per variant */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Prix (optionnel)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="Hérite du produit"
                value={variant.price ?? ""}
                onChange={(e) =>
                  updateVariant(
                    vIndex,
                    "price",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stock</Label>
              <Input
                type="number"
                min={0}
                placeholder="Illimité"
                value={variant.stock_quantity ?? ""}
                onChange={(e) =>
                  updateVariant(
                    vIndex,
                    "stock_quantity",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </div>
          </div>

          {/* SKU */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              SKU (optionnel)
            </Label>
            <Input
              placeholder="ex : PROD-001-XL-ROUGE"
              value={variant.sku ?? ""}
              onChange={(e) =>
                updateVariant(vIndex, "sku", e.target.value || null)
              }
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addVariant}
        className="w-full"
      >
        <Plus className="size-4" />
        Ajouter une variante
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ProductForm component
// ---------------------------------------------------------------------------

export function ProductForm({
  shopId,
  categories,
  defaultValues,
  productId,
}: ProductFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(productId);

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema) as Resolver<CreateProductInput>,
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      price: 0,
      compare_price: null,
      currency: "XOF",
      images: [],
      category_id: null,
      is_published: false,
      is_digital: false,
      stock_quantity: null,
      has_variants: false,
      variants: [],
      metadata: undefined,
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = form;

  const watchName = watch("name");
  const watchHasVariants = watch("has_variants");
  const watchVariants = watch("variants") ?? [];
  const watchImages = watch("images");
  const watchIsDigital = watch("is_digital");

  // Auto-generate slug from name (only when slug is empty or matches previous auto-gen)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    Boolean(defaultValues?.slug)
  );

  // Pre-fill a new product from a draft stashed by the free AI tools (/outils).
  useEffect(() => {
    if (isEdit) return;

    let draft: ProductDraft | null = null;

    try {
      draft = JSON.parse(localStorage.getItem(PRODUCT_DRAFT_KEY) ?? "null");
    } catch {
      draft = null;
    }

    if (!draft) return;

    const nextName = typeof draft.name === "string" ? draft.name.trim() : "";
    const nextDescription =
      typeof draft.description === "string" ? draft.description.trim() : "";
    const nextPrice =
      typeof draft.price === "number" && Number.isFinite(draft.price)
        ? draft.price
        : null;

    if (nextName) {
      setValue("name", nextName, { shouldDirty: true, shouldValidate: true });
      setValue("slug", toSlug(nextName), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (nextDescription) {
      setValue("description", nextDescription, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (nextPrice !== null) {
      setValue("price", nextPrice, { shouldDirty: true, shouldValidate: true });
    }

    localStorage.removeItem(PRODUCT_DRAFT_KEY);
    toast.success("Brouillon importé depuis les outils LinkBoutik.");
  }, [isEdit, setValue]);

  useEffect(() => {
    if (!slugManuallyEdited && watchName) {
      setValue("slug", toSlug(watchName), { shouldValidate: false });
    }
  }, [watchName, slugManuallyEdited, setValue]);

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------

  const save = useCallback(
    async (data: CreateProductInput, publish: boolean) => {
      setIsSubmitting(true);
      const supabase = createClient();

      try {
        if (isEdit && productId) {
          const { error } = await supabase
            .from("products")
            .update({
              name: data.name,
              slug: data.slug,
              description: data.description ?? null,
              price: data.price,
              compare_price: data.compare_price ?? null,
              currency: data.currency,
              images: data.images,
              category_id: data.category_id ?? null,
              is_published: publish,
              is_digital: data.is_digital,
              stock_quantity: data.stock_quantity ?? null,
              has_variants: data.has_variants,
              metadata: data.metadata ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", productId);

          if (error) throw error;

          // Upsert variants
          if (data.has_variants && data.variants?.length) {
            for (const variant of data.variants) {
              if (variant.id) {
                await supabase
                  .from("product_variants")
                  .update({
                    name: variant.name,
                    options: variant.options,
                    price: variant.price,
                    stock_quantity: variant.stock_quantity ?? null,
                    sku: variant.sku ?? null,
                  })
                  .eq("id", variant.id);
              } else {
                await supabase.from("product_variants").insert({
                  product_id: productId,
                  name: variant.name,
                  options: variant.options ?? [],
                  price: variant.price,
                  compare_price: null,
                  stock_quantity: variant.stock_quantity ?? null,
                  sku: variant.sku ?? null,
                });
              }
            }
          }

          toast.success("Produit mis à jour avec succès");
          router.push("/dashboard/products");
          router.refresh();
        } else {
          const { data: product, error } = await supabase
            .from("products")
            .insert({
              shop_id: shopId,
              name: data.name,
              slug: data.slug,
              description: data.description ?? null,
              price: data.price,
              compare_price: data.compare_price ?? null,
              currency: data.currency,
              images: data.images,
              category_id: data.category_id ?? null,
              is_published: publish,
              is_digital: data.is_digital,
              stock_quantity: data.stock_quantity ?? null,
              has_variants: data.has_variants,
              metadata: data.metadata ?? null,
            })
            .select("id")
            .single();

          if (error || !product) throw error;

          // Insert variants
          if (data.has_variants && data.variants?.length) {
            await supabase.from("product_variants").insert(
              data.variants.map((v) => ({
                product_id: product.id,
                name: v.name,
                options: v.options ?? [],
                price: v.price,
                compare_price: null,
                stock_quantity: v.stock_quantity ?? null,
                sku: v.sku ?? null,
              }))
            );
          }

          toast.success(
            publish ? "Produit publié avec succès !" : "Brouillon enregistré."
          );
          router.push("/dashboard/products");
          router.refresh();
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Une erreur est survenue";
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [shopId, productId, isEdit, router]
  );

  const onDraft = handleSubmit((data: CreateProductInput) => save(data, false));
  const onPublish = handleSubmit((data: CreateProductInput) => save(data, true));

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const fieldError = (key: keyof CreateProductInput) =>
    errors[key]?.message as string | undefined;

  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          {STEPS.map((step) => (
            <button
              key={step.number}
              type="button"
              onClick={() => setCurrentStep(step.number)}
              className={cn(
                "flex items-center gap-1.5 font-medium transition-colors",
                currentStep === step.number
                  ? "text-foreground"
                  : currentStep > step.number
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {currentStep > step.number ? (
                <CheckCircle className="size-4 text-primary" />
              ) : (
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-xs ring-1",
                    currentStep === step.number
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "ring-border"
                  )}
                >
                  {step.number}
                </span>
              )}
              <span className="hidden sm:block">{step.label}</span>
            </button>
          ))}
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      <form className="space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* STEP 1 — Basic info */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Informations de base</h2>
              <p className="text-sm text-muted-foreground">
                Renseignez les informations principales de votre produit.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nom du produit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="ex : Robe en wax imprimée"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug">
                URL du produit <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex h-8 items-center rounded-l-lg border border-r-0 border-border bg-muted px-2.5 text-xs text-muted-foreground">
                  /boutique/
                </span>
                <Input
                  id="slug"
                  className="rounded-l-none"
                  placeholder="robe-wax-imprimee"
                  aria-invalid={Boolean(errors.slug)}
                  {...register("slug", {
                    onChange: () => setSlugManuallyEdited(true),
                  })}
                />
              </div>
              {errors.slug && (
                <p className="text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Décrivez votre produit : matière, dimensions, utilisation…"
                rows={5}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) =>
                      field.onChange(v === "none" ? null : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">
                          Sans catégorie
                        </SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Product type */}
            <div className="space-y-3">
              <Label>Type de produit</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: false,
                    label: "Produit physique",
                    desc: "Article expédié au client",
                  },
                  {
                    value: true,
                    label: "Produit digital",
                    desc: "Fichier téléchargeable",
                  },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setValue("is_digital", opt.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      watchIsDigital === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2 — Images & Pricing */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Images & Prix</h2>
              <p className="text-sm text-muted-foreground">
                Ajoutez des photos et définissez le prix de vente.
              </p>
            </div>

            {/* Images */}
            <div className="space-y-1.5">
              <Label>
                Photos du produit{" "}
                <span className="text-muted-foreground font-normal">
                  (max 6)
                </span>
              </Label>
              <ImageUploader
                shopId={shopId}
                value={watchImages ?? []}
                onChange={(imgs) => setValue("images", imgs)}
                maxImages={6}
                maxSizeMB={5}
              />
            </div>

            <Separator />

            {/* Currency */}
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as (typeof CURRENCIES)[number])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c} — {CURRENCY_META[c].symbol} (
                            {CURRENCY_META[c].region})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">
                  Prix de vente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  aria-invalid={Boolean(errors.price)}
                  {...register("price", { valueAsNumber: true })}
                />
                {errors.price && (
                  <p className="text-xs text-destructive">
                    {errors.price.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compare_price">
                  Prix barré{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    (avant remise)
                  </span>
                </Label>
                <Input
                  id="compare_price"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Laisser vide"
                  aria-invalid={Boolean(errors.compare_price)}
                  {...register("compare_price", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                />
                {errors.compare_price && (
                  <p className="text-xs text-destructive">
                    {errors.compare_price.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3 — Variants & Inventory */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Variantes & Stock</h2>
              <p className="text-sm text-muted-foreground">
                Gérez les variantes et le stock de votre produit.
              </p>
            </div>

            {/* Has variants toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  Ce produit a des variantes
                </p>
                <p className="text-xs text-muted-foreground">
                  Taille, couleur, matière, etc.
                </p>
              </div>
              <Controller
                control={control}
                name="has_variants"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Variants builder */}
            {watchHasVariants ? (
              <VariantBuilder
                variants={watchVariants}
                onChange={(v) => setValue("variants", v)}
                error={fieldError("variants")}
              />
            ) : (
              /* Global stock when no variants */
              <div className="space-y-1.5">
                <Label htmlFor="stock_quantity">
                  Quantité en stock{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    (laisser vide = illimité)
                  </span>
                </Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min={0}
                  placeholder="Illimité"
                  aria-invalid={Boolean(errors.stock_quantity)}
                  {...register("stock_quantity", {
                    setValueAs: (v) =>
                      v === "" || v == null ? null : Number(v),
                  })}
                />
                {errors.stock_quantity && (
                  <p className="text-xs text-destructive">
                    {errors.stock_quantity.message}
                  </p>
                )}
              </div>
            )}

            {/* Digital product download URL */}
            {watchIsDigital && (
              <div className="space-y-1.5">
                <Label htmlFor="download_url">
                  URL de téléchargement{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    (optionnel, peut être ajouté plus tard)
                  </span>
                </Label>
                <Input
                  id="download_url"
                  type="url"
                  placeholder="https://…"
                  {...register("metadata.download_url")}
                />
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Navigation */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="size-4" />
            Précédent
          </Button>

          <div className="flex gap-2">
            {currentStep < STEPS.length ? (
              <Button type="button" onClick={goNext}>
                Suivant
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDraft}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enregistrement…" : "Enregistrer comme brouillon"}
                </Button>
                <Button
                  type="button"
                  onClick={onPublish}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Publication…" : "Publier le produit"}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
