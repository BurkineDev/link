import { z } from "zod";
import { CURRENCIES, MAX_PRODUCT_IMAGES, MAX_PRODUCT_VARIANTS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .min(2, "L'adresse doit contenir au moins 2 caractères")
  .max(120, "L'adresse ne peut pas dépasser 120 caractères")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
    "L'adresse n'accepte que des minuscules, des chiffres et des tirets",
  )
  .toLowerCase();

const priceSchema = z
  .number({ error: "Indique un prix" })
  .nonnegative("Le prix ne peut pas être négatif")
  .finite("Indique un prix valide");

const positiveIntOrNull = z
  .number({ error: "Indique un nombre entier" })
  .int("Indique un nombre entier")
  .nonnegative("Ne peut pas être négatif")
  .nullable();

// ---------------------------------------------------------------------------
// Product image
// ---------------------------------------------------------------------------

export const productImageSchema = z.object({
  url: z.string().url("Adresse d'image invalide"),
  alt: z.string().max(200, "La description de l'image ne peut pas dépasser 200 caractères").optional(),
  position: z.number().int().nonnegative(),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

// ---------------------------------------------------------------------------
// Variant option (e.g. { name: "Color", value: "Red" })
// ---------------------------------------------------------------------------

export const variantOptionSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom de l'option est requis")
    .max(50, "Le nom de l'option ne peut pas dépasser 50 caractères")
    .trim(),
  value: z
    .string()
    .min(1, "La valeur de l'option est requise")
    .max(100, "La valeur ne peut pas dépasser 100 caractères")
    .trim(),
});

export type VariantOptionInput = z.infer<typeof variantOptionSchema>;

// ---------------------------------------------------------------------------
// Product variant
// ---------------------------------------------------------------------------

export const productVariantSchema = z.object({
  id: z.string().uuid().optional(), // present when updating an existing variant
  name: z
    .string()
    .min(1, "Le nom de la variante est requis")
    .max(200, "Le nom de la variante ne peut pas dépasser 200 caractères")
    .trim(),
  options: z
    .array(variantOptionSchema)
    .min(1, "Ajoute au moins une option")
    .max(5, "Une variante accepte au plus 5 options"),
  price: priceSchema.nullable().default(null),
  stock_quantity: positiveIntOrNull.default(null),
  sku: z
    .string()
    .max(100, "La référence ne peut pas dépasser 100 caractères")
    .trim()
    .nullable()
    .optional(),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

// ---------------------------------------------------------------------------
// Product metadata
// ---------------------------------------------------------------------------

export const productMetadataSchema = z
  .object({
    weight_grams: z.number().positive("Le poids doit être positif").optional(),
    dimensions: z
      .object({
        length_cm: z.number().positive(),
        width_cm: z.number().positive(),
        height_cm: z.number().positive(),
      })
      .optional(),
    tags: z
      .array(z.string().min(1).max(50))
      .max(20, "20 étiquettes au maximum")
      .optional(),
    download_url: z.string().url("Adresse invalide").optional(),
    download_limit: z
      .number()
      .int()
      .positive("La limite de téléchargements doit être un entier positif")
      .optional(),
    featured: z.boolean().optional(),
  })
  .optional();

export type ProductMetadataInput = z.infer<typeof productMetadataSchema>;

// ---------------------------------------------------------------------------
// Create product
// ---------------------------------------------------------------------------

const baseProductSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(200, "Le nom ne peut pas dépasser 200 caractères")
    .trim(),
  slug: slugSchema,
  description: z
    .string()
    .max(5000, "La description ne peut pas dépasser 5000 caractères")
    .trim()
    .optional(),
  price: priceSchema,
  compare_price: priceSchema.nullable().optional(),
  currency: z.enum(CURRENCIES, {
    error: "Choisis une devise proposée",
  }),
  images: z
    .array(productImageSchema)
    .max(
      MAX_PRODUCT_IMAGES,
      `${MAX_PRODUCT_IMAGES} photos au maximum`,
    )
    .default([]),
  category_id: z.string().uuid("Catégorie invalide").nullable().optional(),
  is_published: z.boolean().default(false),
  is_digital: z.boolean().default(false),
  stock_quantity: positiveIntOrNull.default(null),
  has_variants: z.boolean().default(false),
  variants: z
    .array(productVariantSchema)
    .max(
      MAX_PRODUCT_VARIANTS,
      `${MAX_PRODUCT_VARIANTS} variantes au maximum`,
    )
    .optional(),
  metadata: productMetadataSchema,
});

export const createProductSchema = baseProductSchema.superRefine((data, ctx) => {
  if (data.has_variants && (!data.variants || data.variants.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ajoute au moins une variante, ou désactive les variantes",
      path: ["variants"],
    });
  }

  if (
    data.compare_price !== null &&
    data.compare_price !== undefined &&
    data.compare_price <= data.price
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Le prix barré doit être supérieur au prix de vente",
      path: ["compare_price"],
    });
  }
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ---------------------------------------------------------------------------
// Update product (all fields optional, same shape)
// ---------------------------------------------------------------------------

export const updateProductSchema = baseProductSchema.partial().extend({
  slug: slugSchema.optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ---------------------------------------------------------------------------
// Quick publish/unpublish toggle
// ---------------------------------------------------------------------------

export const toggleProductPublishedSchema = z.object({
  is_published: z.boolean(),
});

export type ToggleProductPublishedInput = z.infer<
  typeof toggleProductPublishedSchema
>;

// ---------------------------------------------------------------------------
// Category create/update
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(80, "Category name must be at most 80 characters")
    .trim(),
  slug: z
    .string()
    .min(1, "Category URL is required")
    .max(80, "Category URL must be at most 80 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "Category URL can only contain lowercase letters, numbers, and hyphens",
    )
    .toLowerCase(),
  position: z.number().int().nonnegative().default(0),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---------------------------------------------------------------------------
// Reorder categories
// ---------------------------------------------------------------------------

export const reorderCategoriesSchema = z.object({
  ordered_ids: z
    .array(z.string().uuid())
    .min(1, "At least one category ID is required"),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
