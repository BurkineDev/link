import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeProduct, serializeVariant } from "@/lib/db/serialize";
import { ProductForm } from "@/components/dashboard/product-form";
import type { CreateProductInput } from "@/lib/validations/product";
import type { Row } from "@/lib/types/database";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Modifier le produit",
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const user = await requireUser();

  const shop = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true, slug: true, currency: true },
  });
  if (!shop) redirect("/dashboard");

  // Fetch product and verify it belongs to this shop
  const productRow = await prisma.product.findFirst({
    where: { id, shopId: shop.id },
    include: { variants: { orderBy: { id: "asc" } } },
  });
  if (!productRow) notFound();

  // Le formulaire lit la forme Supabase (snake_case).
  const product = serializeProduct(productRow) as unknown as Row<"products">;
  const variants = productRow.variants.map(serializeVariant).map((v) => ({
    id: v.id,
    name: v.name,
    options: v.options,
    price: v.price,
    stock_quantity: v.stock_quantity,
    sku: v.sku,
  }));

  const categories = await prisma.category.findMany({
    where: { shopId: shop.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  const defaultValues: Partial<CreateProductInput> = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    price: product.price,
    compare_price: product.compare_price,
    currency: product.currency,
    images: product.images ?? [],
    category_id: product.category_id,
    is_published: product.is_published,
    is_digital: product.is_digital,
    stock_quantity: product.stock_quantity,
    has_variants: product.has_variants,
    variants: variants.length > 0 ? (variants as CreateProductInput["variants"]) : undefined,
    metadata: product.metadata ?? undefined,
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/dashboard/products">
            <ChevronLeft className="size-4" />
            Retour aux produits
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Modifier : {product.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Mettez à jour les informations de ce produit.
        </p>
      </div>

      <ProductForm
        shopId={shop.id}
        shopSlug={shop.slug}
        categories={categories}
        defaultValues={defaultValues}
        productId={product.id}
      />
    </div>
  );
}
