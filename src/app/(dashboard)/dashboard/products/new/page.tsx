import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/dashboard/product-form";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Nouveau produit",
};

export default async function NewProductPage() {
  const user = await requireUser();

  const shop = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true, slug: true, currency: true },
  });
  if (!shop) redirect("/dashboard");

  const categories = await prisma.category.findMany({
    where: { shopId: shop.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

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
          Remplis les informations de ton produit en 3 étapes.
        </p>
      </div>

      <ProductForm
        shopId={shop.id}
        shopSlug={shop.slug}
        categories={categories}
        defaultValues={{ currency: shop.currency }}
      />
    </div>
  );
}
