import { z } from "zod";
import { CURRENCIES, MOBILE_MONEY_PROVIDERS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters")
  .trim();

const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .toLowerCase();

const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(
    /^\+?[1-9]\d{6,14}$/,
    "Please enter a valid phone number (e.g. +22507000000)",
  );

const optionalPhone = z
  .string()
  .regex(
    /^\+?[1-9]\d{6,14}$/,
    "Please enter a valid phone number (e.g. +22507000000)",
  )
  .optional()
  .or(z.literal(""));

// ---------------------------------------------------------------------------
// Buyer details
// ---------------------------------------------------------------------------

export const buyerDetailsSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

export type BuyerDetailsInput = z.infer<typeof buyerDetailsSchema>;

// ---------------------------------------------------------------------------
// Shipping address
// ---------------------------------------------------------------------------

export const shippingAddressSchema = z.object({
  full_name: nameSchema,
  address_line1: z
    .string()
    .min(5, "Address is required")
    .max(200, "Address must be at most 200 characters")
    .trim(),
  address_line2: z
    .string()
    .max(200, "Address line 2 must be at most 200 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .min(2, "City is required")
    .max(100, "City must be at most 100 characters")
    .trim(),
  state: z
    .string()
    .max(100, "State/Region must be at most 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  postal_code: z
    .string()
    .max(20, "Postal code must be at most 20 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code")
    .toUpperCase(),
  phone: optionalPhone,
});

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

// ---------------------------------------------------------------------------
// Cart item (single line in the checkout)
// ---------------------------------------------------------------------------

export const cartItemSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  variant_id: z.string().uuid("Invalid variant ID").nullable().optional(),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1")
    .max(999, "Quantity cannot exceed 999"),
  unit_price: z
    .number({ error: "Price must be a number" })
    .nonnegative("Price cannot be negative"),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

// ---------------------------------------------------------------------------
// Payment method
// ---------------------------------------------------------------------------

export const paymentMethodSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("flutterwave"),
    channel: z
      .enum(["card", "bank_transfer", "ussd", "mpesa"])
      .optional(),
  }),
  z.object({
    provider: z.literal("mobile_money"),
    mobile_money_provider: z.enum(MOBILE_MONEY_PROVIDERS, {
      error: "Please select a valid mobile money provider",
    }),
    mobile_number: phoneSchema,
  }),
  z.object({
    provider: z.literal("manual"),
    instructions: z
      .string()
      .max(500, "Instructions must be at most 500 characters")
      .optional(),
  }),
]);

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

// ---------------------------------------------------------------------------
// Full checkout form
// ---------------------------------------------------------------------------

export const checkoutFormSchema = z.object({
  // Buyer info
  buyer: buyerDetailsSchema,

  // Whether the buyer wants items shipped (vs. pickup / digital)
  requires_shipping: z.boolean().default(true),

  // Shipping address — required only when requires_shipping is true
  shipping_address: shippingAddressSchema.optional(),

  // Order lines
  items: z
    .array(cartItemSchema)
    .min(1, "Your cart is empty")
    .max(100, "Too many items in the cart"),

  // Currency (must match the shop's currency)
  currency: z.enum(CURRENCIES, {
    error: "Please select a supported currency",
  }),

  // Optional note from the buyer
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .trim()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.requires_shipping && !data.shipping_address) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Shipping address is required for physical products",
      path: ["shipping_address"],
    });
  }
});

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;

// ---------------------------------------------------------------------------
// Initiate payment (sent to the API route)
// ---------------------------------------------------------------------------

export const initiatePaymentSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  redirect_url: z
    .string()
    .url("Redirect URL must be a valid URL")
    .optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

// ---------------------------------------------------------------------------
// Order status update (admin / seller)
// ---------------------------------------------------------------------------

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .trim()
    .optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
