/**
 * Supabase database type definitions for LinkBoutik.
 *
 * Keep this file in sync with supabase/migrations/*.sql.
 * Re-generate with: supabase gen types typescript --local > src/lib/types/database.ts
 */

// ---------------------------------------------------------------------------
// JSON / JSONB helpers
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export type Currency = "XOF" | "XAF" | "GHS" | "NGN" | "KES" | "MAD" | "USD";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentProvider = "flutterwave" | "manual" | "free" | "pawapay";

// ---------------------------------------------------------------------------
// JSONB object shapes
// ---------------------------------------------------------------------------

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  website?: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
  position: number;
}

export interface VariantOption {
  name: string;   // e.g. "Color", "Size"
  value: string;  // e.g. "Red", "XL"
}

export interface OrderItemSnapshot {
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
  unit_price: number;
  currency: Currency;
  image_url?: string;
}

export interface OrderItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_snapshot: OrderItemSnapshot;
}

export interface ShippingAddress {
  full_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  phone?: string;
}

export interface TemplateConfig {
  layout: "grid" | "list" | "masonry";
  hero?: {
    show: boolean;
    style: "banner" | "split" | "centered";
  };
  font?: string;
  borderRadius?: "none" | "sm" | "md" | "lg" | "full";
  showSocialLinks?: boolean;
  showReviews?: boolean;
  customCss?: string;
}

export interface ProductMetadata {
  weight_grams?: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  tags?: string[];
  download_url?: string;          // for digital products
  download_limit?: number;        // max downloads per order
  featured?: boolean;
  [key: string]: Json | undefined;
}

// ---------------------------------------------------------------------------
// Table row types — use `type` (not `interface`) so they satisfy
// Supabase's GenericTable.Row constraint: Record<string, unknown>
// ---------------------------------------------------------------------------

export type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type ShopRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  template_id: string | null;
  is_published: boolean;
  theme_color: string;
  currency: Currency;
  contact_email: string | null;
  contact_phone: string | null;
  social_links: SocialLinks | null;
  metadata: Record<string, Json>;
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  preview_image: string | null;
  config: TemplateConfig;
  is_active: boolean;
};

export type CategoryRow = {
  id: string;
  shop_id: string;
  name: string;
  slug: string;
  position: number;
};

export type ProductRow = {
  id: string;
  shop_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  currency: Currency;
  images: ProductImage[];
  category_id: string | null;
  is_published: boolean;
  is_digital: boolean;
  stock_quantity: number | null;
  has_variants: boolean;
  metadata: ProductMetadata | null;
  created_at: string;
  updated_at: string;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  name: string;
  options: VariantOption[];
  price: number | null;
  compare_price: number | null;
  stock_quantity: number | null;
  sku: string | null;
};

export type OrderRow = {
  id: string;
  shop_id: string;
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: PaymentProvider | null;
  payment_ref: string | null;
  flw_tx_id: string | null;
  total_amount: number;
  currency: Currency;
  items: OrderItem[];
  shipping_address: ShippingAddress | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_snapshot: OrderItemSnapshot;
};

// ---------------------------------------------------------------------------
// Insert types (omit server-generated fields)
// ---------------------------------------------------------------------------

export type ProfileInsert = Omit<ProfileRow, "created_at">;

export type ShopInsert = Omit<ShopRow, "id" | "created_at" | "updated_at">;

export type TemplateInsert = Omit<TemplateRow, "id">;

export type CategoryInsert = Omit<CategoryRow, "id">;

export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at">;

export type ProductVariantInsert = Omit<ProductVariantRow, "id">;

export type OrderInsert = Omit<OrderRow, "id" | "created_at" | "updated_at" | "flw_tx_id"> & {
  flw_tx_id?: string | null;
};

export type OrderItemInsert = Omit<OrderItemRow, "id">;

// ---------------------------------------------------------------------------
// Update types (all fields optional except primary key)
// ---------------------------------------------------------------------------

export type ShopUpdate = Partial<Omit<ShopRow, "id" | "owner_id" | "created_at">>;

export type ProductUpdate = Partial<Omit<ProductRow, "id" | "shop_id" | "created_at">>;

export type OrderUpdate = Partial<Omit<OrderRow, "id" | "shop_id" | "created_at">>;

export type CategoryUpdate = Partial<Omit<CategoryRow, "id" | "shop_id">>;

export type ProductVariantUpdate = Partial<Omit<ProductVariantRow, "id" | "product_id">>;

// ---------------------------------------------------------------------------
// Database manifest — matches Supabase generated shape
// ---------------------------------------------------------------------------

// Supabase requires each table to declare Relationships (can be empty array)
type NoRelationships = { Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileRow>;
      } & NoRelationships;
      shops: {
        Row: ShopRow;
        Insert: ShopInsert;
        Update: ShopUpdate;
      } & NoRelationships;
      templates: {
        Row: TemplateRow;
        Insert: TemplateInsert;
        Update: Partial<TemplateRow>;
      } & NoRelationships;
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      } & NoRelationships;
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
      } & NoRelationships;
      product_variants: {
        Row: ProductVariantRow;
        Insert: ProductVariantInsert;
        Update: ProductVariantUpdate;
      } & NoRelationships;
      orders: {
        Row: OrderRow;
        Insert: OrderInsert;
        Update: OrderUpdate;
      } & NoRelationships;
      order_items: {
        Row: OrderItemRow;
        Insert: OrderItemInsert;
        Update: Partial<OrderItemRow>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      currency: Currency;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_provider: PaymentProvider;
    };
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers — Row<T> and Insert<T>
// ---------------------------------------------------------------------------

export type Tables = Database["public"]["Tables"];

export type Row<T extends keyof Tables> = Tables[T]["Row"];

export type Insert<T extends keyof Tables> = Tables[T]["Insert"];

export type Update<T extends keyof Tables> = Tables[T]["Update"];
