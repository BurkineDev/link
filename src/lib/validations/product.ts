import { z } from "zod";
import { CURRENCIES, MAX_PRODUCT_IMAGES, MAX_PRODUCT_VARIANTS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .min(2, "Product URL must be at least 2 characters")
  .max(120, "Product URL must be at most 120 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
    "Product URL can only contain lowercase letters, numbers, and hyphens",
  )
  .toLowerCase();

const priceSchema = z
  .number({ error: "Price must be a number" })
  .nonnegative("Price cannot be negative")
  .finite("Price must be a finite number");

const positiveIntOrNull = z
  .number({ error: "Must be a whole number" })
  .int("Must be a whole number")
  .nonnegative("Cannot be negative")
  .nullable();

// ---------------------------------------------------------------------------
// Product image
// ---------------------------------------------------------------------------

export const productImageSchema = z.object({
  url: z.string().url("Image must be a valid URL"),
  alt: z.string().max(200, "Alt text must be at most 200 characters").optional(),
  position: z.number().int().nonnegative(),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

// ---------------------------------------------------------------------------
// Variant option (e.g. { name: "Color", value: "Red" })
// ---------------------------------------------------------------------------

export const variantOptionSchema = z.object({
  name: z
    .string()
    .min(1, "Option name is required")
    .max(50, "Option name must be at most 50 characters")
    .trim(),
  value: z
    .string()
    .min(1, "Option value is required")
    .max(100, "Option value must be at most 100 characters")
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
    .min(1, "Variant name is required")
    .max(200, "Variant name must be at most 200 characters")
    .trim(),
  options: z
    .array(variantOptionSchema)
    .min(1, "At least one option is required")
    .max(5, "A variant can have at most 5 option pairs"),
  price: priceSchema.nullable().default(null),
  stock_quantity: positiveIntOrNull.default(null),
  sku: z
    .string()
    .max(100, "SKU must be at most 100 characters")
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
    weight_grams: z.number().positive("Weight must be positive").optional(),
    dimensions: z
      .object({
        length_cm: z.number().positive(),
        width_cm: z.number().positive(),
        height_cm: z.number().positive(),
      })
      .optional(),
    tags: z
      .array(z.string().min(1).max(50))
      .max(20, "At most 20 tags are allowed")
      .optional(),
    download_url: z.string().url("Must be a valid URL").optional(),
    download_limit: z
      .number()
      .int()
      .positive("Download limit must be a positive integer")
      .optional(),
    featured: z.boolean().optional(),
  })
  .optional();

export type ProductMetadataInput = z.infer<typeof productMetadataSchema>;

// ---------------------------------------------------------------------------
// Create product
// ---------------------------------------------------------------------------

const productSchemaBase = z.object({
    name: z
      .string()
      .min(2, "Product name must be at least 2 characters")
      .max(200, "Product name must be at most 200 characters")
      .trim(),
    slug: slugSchema,
    description: z
      .string()
      .max(5000, "Description must be at most 5000 characters")
      .trim()
      .optional(),
    price: priceSchema,
    compare_price: priceSchema.nullable().optional(),
    currency: z.enum(CURRENCIES, {
      error: "Please select a supported currency",
    }),
    images: z
      .array(productImageSchema)
      .max(
        MAX_PRODUCT_IMAGES,
        `You can upload at most ${MAX_PRODUCT_IMAGES} images`,
      )
      .default([]),
    category_id: z.string().uuid("Invalid category").nullable().optional(),
    is_published: z.boolean().default(false),
    is_digital: z.boolean().default(false),
    stock_quantity: positiveIntOrNull.default(null),
    has_variants: z.boolean().default(false),
    variants: z
      .array(productVariantSchema)
      .max(
        MAX_PRODUCT_VARIANTS,
        `You can add at most ${MAX_PRODUCT_VARIANTS} variants`,
      )
      .optional(),
  metadata: productMetadataSchema,
});

function validateProductRules(
  data: Partial<z.infer<typeof productSchemaBase>>,
  ctx: z.RefinementCtx,
) {
  if (data.has_variants && (!data.variants || data.variants.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one variant is required when variants are enabled",
      path: ["variants"],
    });
  }

  if (
    data.price !== undefined &&
    data.compare_price !== null &&
    data.compare_price !== undefined &&
    data.compare_price <= data.price
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Compare price must be greater than the selling price",
      path: ["compare_price"],
    });
  }
}

export const createProductSchema = productSchemaBase.superRefine(validateProductRules);

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ---------------------------------------------------------------------------
// Update product (all fields optional, same shape)
// ---------------------------------------------------------------------------

export const updateProductSchema = z
  .object({
    name: productSchemaBase.shape.name.optional(),
    slug: slugSchema.optional(),
    description: productSchemaBase.shape.description.optional(),
    price: productSchemaBase.shape.price.optional(),
    compare_price: productSchemaBase.shape.compare_price.optional(),
    currency: productSchemaBase.shape.currency.optional(),
    images: productSchemaBase.shape.images.optional(),
    category_id: productSchemaBase.shape.category_id.optional(),
    is_published: productSchemaBase.shape.is_published.optional(),
    is_digital: productSchemaBase.shape.is_digital.optional(),
    stock_quantity: productSchemaBase.shape.stock_quantity.optional(),
    has_variants: productSchemaBase.shape.has_variants.optional(),
    variants: productSchemaBase.shape.variants.optional(),
    metadata: productSchemaBase.shape.metadata.optional(),
  })
  .superRefine(validateProductRules);

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
