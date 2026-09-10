import type { Prisma } from "../../../prisma/generated/client/client";

/**
 * Supabase renvoyait des lignes Postgres brutes : snake_case, nombres et dates
 * déjà sérialisés en JSON. Prisma renvoie du camelCase, des `Decimal` et des
 * `Date`. Tant que les 73 fichiers ne sont pas tous portés, le contrat des API
 * doit rester inchangé — sinon chaque route migrée casse ses composants.
 *
 * Ces fonctions sont donc la frontière : Prisma à l'intérieur, forme Supabase
 * à l'extérieur. Elles disparaîtront quand le front consommera du camelCase.
 */

/**
 * `Decimal | null` → `number | null`, sans perdre la précision monétaire.
 * La surcharge non nulle est déclarée en premier : TypeScript retient la
 * première qui correspond, et un `Decimal` sûr doit donner un `number` sûr.
 */
export function decimalToNumber(value: Prisma.Decimal): number;
export function decimalToNumber(value: Prisma.Decimal | null): number | null;
export function decimalToNumber(
  value: Prisma.Decimal | null,
): number | null {
  return value === null ? null : Number(value);
}

/** `Date | null` → ISO 8601, le format que renvoyait PostgREST. */
export function dateToIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

type VariantRow = {
  id: string;
  productId: string;
  name: string;
  options: Prisma.JsonValue;
  price: Prisma.Decimal | null;
  comparePrice: Prisma.Decimal | null;
  stockQuantity: number | null;
  sku: string | null;
};

export function serializeVariant(variant: VariantRow) {
  return {
    id: variant.id,
    product_id: variant.productId,
    name: variant.name,
    options: variant.options,
    price: decimalToNumber(variant.price),
    compare_price: decimalToNumber(variant.comparePrice),
    stock_quantity: variant.stockQuantity,
    sku: variant.sku,
  };
}

type CategoryRow = {
  id: string;
  name: string;
};

export function serializeCategoryRef(category: CategoryRow) {
  return { id: category.id, name: category.name };
}

type ProductRow = {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  description: string | null;
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  currency: string;
  images: Prisma.JsonValue;
  categoryId: string | null;
  isPublished: boolean;
  isDigital: boolean;
  stockQuantity: number | null;
  hasVariants: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  variants?: VariantRow[];
  category?: CategoryRow | null;
};

export function serializeProduct(product: ProductRow) {
  const base = {
    id: product.id,
    shop_id: product.shopId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: decimalToNumber(product.price),
    compare_price: decimalToNumber(product.comparePrice),
    currency: product.currency,
    images: product.images,
    category_id: product.categoryId,
    is_published: product.isPublished,
    is_digital: product.isDigital,
    stock_quantity: product.stockQuantity,
    has_variants: product.hasVariants,
    metadata: product.metadata,
    created_at: dateToIso(product.createdAt),
    updated_at: dateToIso(product.updatedAt),
  };

  // Les relations ne sont ajoutées que si la requête les a demandées : PostgREST
  // omettait la clé plutôt que de renvoyer null, et le front teste sa présence.
  return {
    ...base,
    ...(product.variants
      ? { product_variants: product.variants.map(serializeVariant) }
      : {}),
    ...(product.category !== undefined
      ? {
          categories: product.category
            ? serializeCategoryRef(product.category)
            : null,
        }
      : {}),
  };
}

type OrderRow = {
  id: string;
  shopId: string;
  customerId: string | null;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string | null;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  totalAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  currency: string;
  items: Prisma.JsonValue;
  shippingAddress: Prisma.JsonValue | null;
  notes: string | null;
  promoCode: string | null;
  discountAmount: Prisma.Decimal;
  trackingToken: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Forme d'une ligne `orders` telle que PostgREST la renvoyait (`select *`). */
export function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    shop_id: order.shopId,
    customer_id: order.customerId,
    buyer_email: order.buyerEmail,
    buyer_name: order.buyerName,
    buyer_phone: order.buyerPhone,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_provider: order.paymentProvider,
    payment_ref: order.paymentRef,
    total_amount: decimalToNumber(order.totalAmount),
    shipping_amount: decimalToNumber(order.shippingAmount),
    currency: order.currency,
    items: order.items,
    shipping_address: order.shippingAddress,
    notes: order.notes,
    promo_code: order.promoCode,
    discount_amount: decimalToNumber(order.discountAmount),
    tracking_token: order.trackingToken,
    created_at: dateToIso(order.createdAt),
    updated_at: dateToIso(order.updatedAt),
  };
}

type ShopRowInput = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  templateId: string | null;
  isPublished: boolean;
  themeColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
  cardStyle: string;
  ctaShape: string;
  ctaStyle: string;
  bioTheme: string;
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Prisma.JsonValue | null;
  tiktokPixelId: string | null;
  metaPixelId: string | null;
  whatsappNumber: string | null;
  checkoutMode: string;
  intentions: string[];
  featuredUntil: Date | null;
  customDomain: string | null;
  customDomainVerifiedAt: Date | null;
  showBioLienBadge: boolean;
  shippingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Forme d'une ligne `shops` telle que PostgREST la renvoyait (`select *`). */
export function serializeShop(shop: ShopRowInput) {
  return {
    id: shop.id,
    owner_id: shop.ownerId,
    name: shop.name,
    slug: shop.slug,
    description: shop.description,
    logo_url: shop.logoUrl,
    banner_url: shop.bannerUrl,
    template_id: shop.templateId,
    is_published: shop.isPublished,
    theme_color: shop.themeColor,
    accent_color: shop.accentColor,
    font_family: shop.fontFamily,
    border_radius: shop.borderRadius,
    card_style: shop.cardStyle,
    cta_shape: shop.ctaShape,
    cta_style: shop.ctaStyle,
    bio_theme: shop.bioTheme,
    currency: shop.currency,
    contact_email: shop.contactEmail,
    contact_phone: shop.contactPhone,
    social_links: shop.socialLinks,
    tiktok_pixel_id: shop.tiktokPixelId,
    meta_pixel_id: shop.metaPixelId,
    whatsapp_number: shop.whatsappNumber,
    checkout_mode: shop.checkoutMode,
    intentions: shop.intentions,
    featured_until: dateToIso(shop.featuredUntil),
    custom_domain: shop.customDomain,
    custom_domain_verified_at: dateToIso(shop.customDomainVerifiedAt),
    show_biolien_badge: shop.showBioLienBadge,
    shipping_enabled: shop.shippingEnabled,
    created_at: dateToIso(shop.createdAt),
    updated_at: dateToIso(shop.updatedAt),
  };
}

type ShopLinkRowInput = {
  id: string;
  shopId: string;
  label: string;
  url: string;
  icon: string;
  thumbnailUrl: string | null;
  clickCount: number;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeShopLink(link: ShopLinkRowInput) {
  return {
    id: link.id,
    shop_id: link.shopId,
    label: link.label,
    url: link.url,
    icon: link.icon,
    thumbnail_url: link.thumbnailUrl,
    click_count: link.clickCount,
    position: link.position,
    is_active: link.isActive,
    created_at: dateToIso(link.createdAt),
    updated_at: dateToIso(link.updatedAt),
  };
}

type PageBlockRowInput = {
  id: string;
  shopId: string;
  type: string;
  position: number;
  title: string | null;
  config: Prisma.JsonValue;
  style: Prisma.JsonValue;
  visible: boolean;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export function serializePageBlock(block: PageBlockRowInput) {
  return {
    id: block.id,
    shop_id: block.shopId,
    type: block.type,
    position: block.position,
    title: block.title,
    config: block.config,
    style: block.style,
    visible: block.visible,
    click_count: block.clickCount,
    created_at: dateToIso(block.createdAt),
    updated_at: dateToIso(block.updatedAt),
  };
}

type CategoryRowInput = {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  position: number;
};

export function serializeCategory(category: CategoryRowInput) {
  return {
    id: category.id,
    shop_id: category.shopId,
    name: category.name,
    slug: category.slug,
    position: category.position,
  };
}

type PromoCodeRowInput = {
  id: string;
  shopId: string;
  code: string;
  discountType: string;
  discountValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxUses: number | null;
  usesCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializePromoCode(promo: PromoCodeRowInput) {
  return {
    id: promo.id,
    shop_id: promo.shopId,
    code: promo.code,
    discount_type: promo.discountType,
    discount_value: decimalToNumber(promo.discountValue),
    min_order_amount: decimalToNumber(promo.minOrderAmount),
    max_uses: promo.maxUses,
    uses_count: promo.usesCount,
    expires_at: dateToIso(promo.expiresAt),
    is_active: promo.isActive,
    created_at: dateToIso(promo.createdAt),
    updated_at: dateToIso(promo.updatedAt),
  };
}
