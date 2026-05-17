import { z } from "zod";
import { CURRENCIES, SHOP_THEME_COLORS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .min(3, "Shop URL must be at least 3 characters")
  .max(50, "Shop URL must be at most 50 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
    "Shop URL can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen",
  )
  .toLowerCase();

const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .optional()
  .or(z.literal(""));

const phoneSchema = z
  .string()
  .regex(
    /^\+?[1-9]\d{6,14}$/,
    "Please enter a valid phone number (e.g. +22507000000)",
  )
  .optional()
  .or(z.literal(""));

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #3B82F6)");

const socialLinksSchema = z.object({
  instagram: urlSchema,
  facebook: urlSchema,
  twitter: urlSchema,
  tiktok: urlSchema,
  youtube: urlSchema,
  whatsapp: phoneSchema,
  website: urlSchema,
}).optional();

// ---------------------------------------------------------------------------
// Create shop
// ---------------------------------------------------------------------------

export const createShopSchema = z.object({
  name: z
    .string()
    .min(2, "Shop name must be at least 2 characters")
    .max(80, "Shop name must be at most 80 characters")
    .trim(),
  slug: slugSchema,
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional(),
  currency: z.enum(CURRENCIES, {
    error: "Please select a supported currency",
  }),
  template_id: z.string().uuid("Invalid template").optional(),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;

// ---------------------------------------------------------------------------
// Update shop settings
// ---------------------------------------------------------------------------

export const updateShopGeneralSchema = z.object({
  name: z
    .string()
    .min(2, "Shop name must be at least 2 characters")
    .max(80, "Shop name must be at most 80 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional(),
  contact_email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  contact_phone: phoneSchema,
});

export type UpdateShopGeneralInput = z.infer<typeof updateShopGeneralSchema>;

export const updateShopAppearanceSchema = z.object({
  theme_color: hexColorSchema,
  template_id: z.string().uuid("Invalid template").optional(),
  logo_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  banner_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type UpdateShopAppearanceInput = z.infer<typeof updateShopAppearanceSchema>;

export const updateShopSocialLinksSchema = z.object({
  social_links: socialLinksSchema,
});

export type UpdateShopSocialLinksInput = z.infer<typeof updateShopSocialLinksSchema>;

export const updateShopSettingsSchema = z.object({
  currency: z.enum(CURRENCIES, {
    error: "Please select a supported currency",
  }),
  is_published: z.boolean(),
});

export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>;

// ---------------------------------------------------------------------------
// Full shop update (union of all sub-schemas — for server actions)
// ---------------------------------------------------------------------------

export const updateShopSchema = updateShopGeneralSchema
  .merge(updateShopAppearanceSchema)
  .merge(updateShopSocialLinksSchema)
  .merge(updateShopSettingsSchema)
  .partial();

export type UpdateShopInput = z.infer<typeof updateShopSchema>;

// ---------------------------------------------------------------------------
// Slug availability check
// ---------------------------------------------------------------------------

export const checkSlugSchema = z.object({
  slug: slugSchema,
  shop_id: z.string().uuid().optional(), // exclude current shop when updating
});

export type CheckSlugInput = z.infer<typeof checkSlugSchema>;

// Keep SHOP_THEME_COLORS in sync with constants.ts
export { SHOP_THEME_COLORS };
