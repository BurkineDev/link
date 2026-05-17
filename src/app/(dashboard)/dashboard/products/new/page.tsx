import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/dashboard/product-form";
import type { Row } from "@/lib/types/database";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Nouveau produit — LinkBoutik",
};

export default async function NewProductPage() {
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

  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name")
    .eq("shop_id", shop.id)
    .order("position");

  const categories = (categoriesRaw as Pick<Row<"categories">, "id" | "name">[] | null) ?? [];

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
        <h1 className="text-2xl font-bold tracking-tight">Nouveau produit</h1>
        <p className="text-sm text-muted-foreground">
          Remplissez les informations de votre produit en 3 étapes.
        </p>
      </div>

      <ProductForm
        shopId={shop.id}
        categories={categories}
        defaultValues={{ currency: shop.currency }}
      />
    </div>
  );
}
