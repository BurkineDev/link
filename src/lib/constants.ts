/**
 * Application-wide constants for LinkBoutik.
 *
 * Centralises values that are referenced across multiple modules
 * (validations, UI, API handlers, etc.) so there is a single source of truth.
 */

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

export const CURRENCIES = [
  "XOF",
  "XAF",
  "GHS",
  "NGN",
  "KES",
  "MAD",
  "USD",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<
  Currency,
  { label: string; symbol: string; decimals: number; region: string }
> = {
  XOF: {
    label: "West African CFA Franc",
    symbol: "FCFA",
    decimals: 0,
    region: "West Africa",
  },
  XAF: {
    label: "Central African CFA Franc",
    symbol: "FCFA",
    decimals: 0,
    region: "Central Africa",
  },
  GHS: { label: "Ghanaian Cedi", symbol: "GH₵", decimals: 2, region: "Ghana" },
  NGN: {
    label: "Nigerian Naira",
    symbol: "₦",
    decimals: 2,
    region: "Nigeria",
  },
  KES: {
    label: "Kenyan Shilling",
    symbol: "KSh",
    decimals: 2,
    region: "Kenya",
  },
  MAD: {
    label: "Moroccan Dirham",
    symbol: "د.م.",
    decimals: 2,
    region: "Morocco",
  },
  USD: {
    label: "US Dollar",
    symbol: "$",
    decimals: 2,
    region: "International",
  },
};

// ---------------------------------------------------------------------------
// Mobile money providers
// ---------------------------------------------------------------------------

export const MOBILE_MONEY_PROVIDERS = [
  "orange_money",
  "mtn_momo",
  "moov_money",
  "wave",
  "mpesa",
  "airtel_money",
  "free_money",
  "zamtel_money",
] as const;

export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const MOBILE_MONEY_META: Record<
  MobileMoneyProvider,
  { label: string; countries: string[]; logo?: string }
> = {
  orange_money: {
    label: "Orange Money",
    countries: ["CI", "SN", "ML", "BF", "CM", "MG", "GN"],
  },
  mtn_momo: {
    label: "MTN Mobile Money",
    countries: ["GH", "NG", "UG", "CM", "CI", "BJ", "ZM"],
  },
  moov_money: {
    label: "Moov Money",
    countries: ["CI", "BJ", "BF", "TG", "ML", "NE"],
  },
  wave: { label: "Wave", countries: ["SN", "CI", "ML", "BF", "GN"] },
  mpesa: { label: "M-Pesa", countries: ["KE", "TZ", "GH", "EG", "MZ"] },
  airtel_money: {
    label: "Airtel Money",
    countries: ["KE", "UG", "TZ", "ZM", "GH", "MG"],
  },
  free_money: { label: "Free Money", countries: ["SN"] },
  zamtel_money: { label: "Zamtel Kwacha", countries: ["ZM"] },
};

// ---------------------------------------------------------------------------
// Shop templates
// ---------------------------------------------------------------------------

export const TEMPLATES = [
  {
    id: "minimal",
    name: "Minimal",
    description:
      "Clean, distraction-free layout that puts your products front and center.",
    preview_image: "/templates/minimal.jpg",
    is_active: true,
    config: {
      layout: "grid" as const,
      hero: { show: false, style: "centered" as const },
      font: "Inter",
      borderRadius: "md" as const,
      showSocialLinks: true,
      showReviews: false,
    },
  },
  {
    id: "boutique",
    name: "Boutique",
    description:
      "Elegant fashion-forward design with a bold hero banner and masonry grid.",
    preview_image: "/templates/boutique.jpg",
    is_active: true,
    config: {
      layout: "masonry" as const,
      hero: { show: true, style: "banner" as const },
      font: "Playfair Display",
      borderRadius: "sm" as const,
      showSocialLinks: true,
      showReviews: true,
    },
  },
  {
    id: "market",
    name: "Market",
    description:
      "High-density list view perfect for sellers with large catalogues.",
    preview_image: "/templates/market.jpg",
    is_active: true,
    config: {
      layout: "list" as const,
      hero: { show: true, style: "split" as const },
      font: "Inter",
      borderRadius: "none" as const,
      showSocialLinks: false,
      showReviews: true,
    },
  },
  {
    id: "artisan",
    name: "Artisan",
    description: "Warm, handcrafted aesthetic for makers and artisans.",
    preview_image: "/templates/artisan.jpg",
    is_active: true,
    config: {
      layout: "grid" as const,
      hero: { show: true, style: "centered" as const },
      font: "Lora",
      borderRadius: "lg" as const,
      showSocialLinks: true,
      showReviews: true,
    },
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

// ---------------------------------------------------------------------------
// Shop theme colours
// ---------------------------------------------------------------------------

export const SHOP_THEME_COLORS = [
  { label: "Indigo", value: "#6366F1" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Orange", value: "#F97316" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Emerald", value: "#10B981" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Sky", value: "#0EA5E9" },
  { label: "Slate", value: "#475569" },
  { label: "Black", value: "#0F172A" },
] as const;

export const DEFAULT_THEME_COLOR = "#6366F1";

// ---------------------------------------------------------------------------
// Shop theming — typography, radius, card style, CTA style
// ---------------------------------------------------------------------------

export const SHOP_FONTS = [
  {
    value: "sans",
    label: "Sans",
    sample: "Aa",
    description: "Inter — moderne et neutre",
    cssVar: "var(--font-inter)",
  },
  {
    value: "serif",
    label: "Serif",
    sample: "Aa",
    description: "Playfair — élégant, éditorial",
    cssVar: "var(--font-playfair)",
  },
  {
    value: "mono",
    label: "Mono",
    sample: "Aa",
    description: "JetBrains — technique, code",
    cssVar: "var(--font-jetbrains-mono)",
  },
  {
    value: "display",
    label: "Display",
    sample: "Aa",
    description: "DM Serif — luxe, mode",
    cssVar: "var(--font-dm-serif)",
  },
] as const;

export const SHOP_BORDER_RADIUS = [
  { value: "none", label: "Carré",     pxHint: "0px" },
  { value: "sm",   label: "Subtil",    pxHint: "4px" },
  { value: "md",   label: "Doux",      pxHint: "8px" },
  { value: "lg",   label: "Arrondi",   pxHint: "12px" },
  { value: "xl",   label: "Très rond", pxHint: "16px" },
  { value: "2xl",  label: "Pillow",    pxHint: "24px" },
] as const;

export const SHOP_CARD_STYLES = [
  { value: "flat",     label: "Plat",     description: "Aucune bordure, aucune ombre" },
  { value: "bordered", label: "Bordé",    description: "Fine bordure + ombre légère" },
  { value: "elevated", label: "Surélevé", description: "Sans bordure, ombre prononcée" },
  { value: "glass",    label: "Verre",    description: "Effet glassmorphism, fond translucide" },
] as const;

export const SHOP_CTA_SHAPES = [
  { value: "pill",    label: "Pilule",   description: "Boutons totalement arrondis" },
  { value: "rounded", label: "Arrondi",  description: "Bords légèrement arrondis" },
  { value: "square",  label: "Carré",    description: "Angles droits, brut" },
] as const;

export const SHOP_CTA_STYLES = [
  { value: "filled",  label: "Plein",    description: "Couleur primaire en fond" },
  { value: "outline", label: "Contour",  description: "Transparent avec bordure colorée" },
  { value: "soft",    label: "Doux",     description: "Couleur en arrière-plan atténué" },
] as const;

// Defaults — must match the database CHECK constraint defaults
export const DEFAULT_ACCENT_COLOR  = "#0F172A";
export const DEFAULT_FONT_FAMILY   = "sans"     as const;
export const DEFAULT_BORDER_RADIUS = "lg"       as const;
export const DEFAULT_CARD_STYLE    = "bordered" as const;
export const DEFAULT_CTA_SHAPE     = "rounded"  as const;
export const DEFAULT_CTA_STYLE     = "filled"   as const;

// Runtime maps — read at render time on the storefront

export const BORDER_RADIUS_CLASS: Record<string, string> = {
  none: "rounded-none",
  sm:   "rounded-sm",
  md:   "rounded-md",
  lg:   "rounded-lg",
  xl:   "rounded-xl",
  "2xl": "rounded-2xl",
};

export const CARD_STYLE_CLASS: Record<string, string> = {
  flat:     "bg-card",
  bordered: "bg-card border border-border/60 shadow-sm",
  elevated: "bg-card shadow-lg shadow-foreground/5",
  glass:    "bg-card/60 backdrop-blur-md border border-white/30 dark:border-white/10",
};

export const CTA_SHAPE_CLASS: Record<string, string> = {
  pill:    "rounded-full",
  rounded: "rounded-2xl",
  square:  "rounded-none",
};

export const FONT_FAMILY_CLASS: Record<string, string> = {
  sans:    "font-[family-name:var(--font-inter)]",
  serif:   "font-[family-name:var(--font-playfair)]",
  mono:    "font-[family-name:var(--font-jetbrains-mono)]",
  display: "font-[family-name:var(--font-dm-serif)]",
};

// ---------------------------------------------------------------------------
// Order statuses
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; description: string }
> = {
  pending: {
    label: "Pending",
    color: "yellow",
    description: "Order placed, awaiting payment confirmation.",
  },
  confirmed: {
    label: "Confirmed",
    color: "blue",
    description: "Payment confirmed, order accepted.",
  },
  processing: {
    label: "Processing",
    color: "indigo",
    description: "Order is being prepared.",
  },
  shipped: {
    label: "Shipped",
    color: "purple",
    description: "Order has been shipped to the buyer.",
  },
  delivered: {
    label: "Delivered",
    color: "green",
    description: "Order delivered successfully.",
  },
  cancelled: {
    label: "Cancelled",
    color: "red",
    description: "Order was cancelled.",
  },
  refunded: {
    label: "Refunded",
    color: "gray",
    description: "Payment has been refunded.",
  },
};

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ---------------------------------------------------------------------------
// African countries
// ---------------------------------------------------------------------------

export const AFRICAN_COUNTRIES = [
  { code: "DZ", name: "Algeria", currency: "DZD" as const },
  { code: "AO", name: "Angola", currency: "AOA" as const },
  { code: "BJ", name: "Benin", currency: "XOF" as const },
  { code: "BW", name: "Botswana", currency: "BWP" as const },
  { code: "BF", name: "Burkina Faso", currency: "XOF" as const },
  { code: "BI", name: "Burundi", currency: "BIF" as const },
  { code: "CV", name: "Cabo Verde", currency: "CVE" as const },
  { code: "CM", name: "Cameroon", currency: "XAF" as const },
  { code: "CF", name: "Central African Republic", currency: "XAF" as const },
  { code: "TD", name: "Chad", currency: "XAF" as const },
  { code: "KM", name: "Comoros", currency: "KMF" as const },
  { code: "CG", name: "Congo", currency: "XAF" as const },
  { code: "CD", name: "Congo, Democratic Republic", currency: "CDF" as const },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" as const },
  { code: "DJ", name: "Djibouti", currency: "DJF" as const },
  { code: "EG", name: "Egypt", currency: "EGP" as const },
  { code: "GQ", name: "Equatorial Guinea", currency: "XAF" as const },
  { code: "ER", name: "Eritrea", currency: "ERN" as const },
  { code: "SZ", name: "Eswatini", currency: "SZL" as const },
  { code: "ET", name: "Ethiopia", currency: "ETB" as const },
  { code: "GA", name: "Gabon", currency: "XAF" as const },
  { code: "GM", name: "Gambia", currency: "GMD" as const },
  { code: "GH", name: "Ghana", currency: "GHS" as const },
  { code: "GN", name: "Guinea", currency: "GNF" as const },
  { code: "GW", name: "Guinea-Bissau", currency: "XOF" as const },
  { code: "KE", name: "Kenya", currency: "KES" as const },
  { code: "LS", name: "Lesotho", currency: "LSL" as const },
  { code: "LR", name: "Liberia", currency: "LRD" as const },
  { code: "LY", name: "Libya", currency: "LYD" as const },
  { code: "MG", name: "Madagascar", currency: "MGA" as const },
  { code: "MW", name: "Malawi", currency: "MWK" as const },
  { code: "ML", name: "Mali", currency: "XOF" as const },
  { code: "MR", name: "Mauritania", currency: "MRU" as const },
  { code: "MU", name: "Mauritius", currency: "MUR" as const },
  { code: "MA", name: "Morocco", currency: "MAD" as const },
  { code: "MZ", name: "Mozambique", currency: "MZN" as const },
  { code: "NA", name: "Namibia", currency: "NAD" as const },
  { code: "NE", name: "Niger", currency: "XOF" as const },
  { code: "NG", name: "Nigeria", currency: "NGN" as const },
  { code: "RW", name: "Rwanda", currency: "RWF" as const },
  { code: "ST", name: "São Tomé and Príncipe", currency: "STN" as const },
  { code: "SN", name: "Senegal", currency: "XOF" as const },
  { code: "SC", name: "Seychelles", currency: "SCR" as const },
  { code: "SL", name: "Sierra Leone", currency: "SLL" as const },
  { code: "SO", name: "Somalia", currency: "SOS" as const },
  { code: "ZA", name: "South Africa", currency: "ZAR" as const },
  { code: "SS", name: "South Sudan", currency: "SSP" as const },
  { code: "SD", name: "Sudan", currency: "SDG" as const },
  { code: "TZ", name: "Tanzania", currency: "TZS" as const },
  { code: "TG", name: "Togo", currency: "XOF" as const },
  { code: "TN", name: "Tunisia", currency: "TND" as const },
  { code: "UG", name: "Uganda", currency: "UGX" as const },
  { code: "ZM", name: "Zambia", currency: "ZMW" as const },
  { code: "ZW", name: "Zimbabwe", currency: "ZWL" as const },
] as const;

export type AfricanCountryCode = (typeof AFRICAN_COUNTRIES)[number]["code"];

// ---------------------------------------------------------------------------
// App metadata
// ---------------------------------------------------------------------------

export const APP_NAME = "LinkBoutik";
export const APP_DESCRIPTION =
  "The all-in-one storefront platform built for African creators and entrepreneurs.";

/** Slug reserved words — cannot be used as shop slugs */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "checkout",
  "dashboard",
  "help",
  "home",
  "login",
  "logout",
  "me",
  "pricing",
  "privacy",
  "register",
  "settings",
  "shop",
  "signup",
  "status",
  "support",
  "terms",
  "www",
] as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// File upload limits
// ---------------------------------------------------------------------------

export const UPLOAD_LIMITS = {
  avatar: { maxSizeMB: 2, acceptedTypes: ["image/jpeg", "image/png", "image/webp"] },
  logo: { maxSizeMB: 2, acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  banner: { maxSizeMB: 5, acceptedTypes: ["image/jpeg", "image/png", "image/webp"] },
  product: { maxSizeMB: 10, acceptedTypes: ["image/jpeg", "image/png", "image/webp"] },
  digital: { maxSizeMB: 100, acceptedTypes: [] }, // all types accepted for digital products
} as const;

export const MAX_PRODUCT_IMAGES = 8;
export const MAX_PRODUCT_VARIANTS = 50;
export const MAX_SHOP_CATEGORIES = 20;
