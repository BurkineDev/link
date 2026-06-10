import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/dashboard/product-form";
import type { CreateProductInput } from "@/lib/validations/product";
import type { Row } from "@/lib/types/database";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Modifier le produit — Bio-Lien",
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shopRaw } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();

  const shop = shopRaw as Pick<Row<"shops">, "id" | "currency"> | null;
  if (!shop) redirect("/dashboard");

  // Fetch product and verify it belongs to this shop
  const { data: productRaw } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .single();

  const product = productRaw as Row<"products"> | null;
  if (!product) notFound();

  // Fetch variants
  const { data: variantsRaw } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", id)
    .order("id");

  const variantRows = (variantsRaw as Row<"product_variants">[] | null) ?? [];
  const variants = variantRows.map((v) => ({
    id: v.id,
    name: v.name,
    options: v.options,
    price: v.price,
    stock_quantity: v.stock_quantity,
    sku: v.sku,
  }));

  // Fetch categories
  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name")
    .eq("shop_id", shop.id)
    .order("position");

  const categories =
    (categoriesRaw as Pick<Row<"categories">, "id" | "name">[] | null) ?? [];

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
    variants: variants.length > 0 ? variants : undefined,
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
        categories={categories}
        defaultValues={defaultValues}
        productId={product.id}
      />
    </div>
  );
}
