"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/types/database";
import { CURRENCY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = Row<"products">;
type FilterTab = "all" | "published" | "draft" | "out_of_stock";

interface ProductsClientProps {
  products: Product[];
  shopId: string;
  currency: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number, currency: string): string {
  const meta = CURRENCY_META[currency as keyof typeof CURRENCY_META];
  if (!meta) return `${amount} ${currency}`;
  return `${amount.toLocaleString("fr-FR")} ${meta.symbol}`;
}

function getStatusBadge(product: Product) {
  if (
    product.stock_quantity !== null &&
    product.stock_quantity === 0 &&
    !product.has_variants
  ) {
    return (
      <Badge variant="destructive">Rupture de stock</Badge>
    );
  }
  if (product.is_published) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0">
        Publié
      </Badge>
    );
  }
  return <Badge variant="outline">Brouillon</Badge>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; desc: string }> = {
    all: {
      title: "Aucun produit pour l'instant",
      desc: "Ajoutez votre premier produit pour commencer à vendre.",
    },
    published: {
      title: "Aucun produit publié",
      desc: "Publiez un brouillon pour qu'il apparaisse dans votre boutique.",
    },
    draft: {
      title: "Aucun brouillon",
      desc: "Tous vos produits sont publiés. Bravo !",
    },
    out_of_stock: {
      title: "Aucune rupture de stock",
      desc: "Tous vos produits ont du stock disponible.",
    },
  };

  const { title, desc } = messages[filter];

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
      <div className="rounded-full bg-muted p-5">
        <Package className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{desc}</p>
      </div>
      {filter === "all" && (
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="size-4" />
            Ajouter un produit
          </Link>
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: Product;
  currency: string;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, published: boolean) => void;
}

function ProductCard({
  product,
  currency,
  onDelete,
  onTogglePublish,
}: ProductCardProps) {
  const firstImage = product.images?.[0];

  return (
    <Card className="group/card overflow-hidden">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {firstImage?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage.url}
            alt={firstImage.alt ?? product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="size-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">{getStatusBadge(product)}</div>

        {/* Actions dropdown */}
        <div className="absolute top-2 right-2">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="bg-background/90 backdrop-blur-sm"
                    aria-label="Actions"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    (window.location.href = `/dashboard/products/${product.id}/edit`)
                  }
                >
                  <Pencil className="size-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    onTogglePublish(product.id, !product.is_published)
                  }
                >
                  {product.is_published ? (
                    <>
                      <EyeOff className="size-4" />
                      Dépublier
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" />
                      Publier
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger
                  render={
                    <DropdownMenuItem className="text-destructive focus:text-destructive" />
                  }
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <Trash2 className="size-5 text-destructive" />
                </AlertDialogMedia>
                <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Le produit{" "}
                  <strong>{product.name}</strong> sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => onDelete(product.id)}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info */}
      <CardContent className="pt-3 pb-0">
        <h3 className="font-medium text-sm line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {formatPrice(product.price, product.currency ?? currency)}
          </span>
          {product.compare_price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_price, product.currency ?? currency)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {product.has_variants
            ? "Avec variantes"
            : product.stock_quantity === null
            ? "Stock illimité"
            : `${product.stock_quantity} en stock`}
        </p>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ProductsClient({
  products: initialProducts,
  shopId,
  currency,
}: ProductsClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = products;

    if (filter === "published") list = list.filter((p) => p.is_published);
    else if (filter === "draft") list = list.filter((p) => !p.is_published);
    else if (filter === "out_of_stock")
      list = list.filter(
        (p) => !p.has_variants && p.stock_quantity !== null && p.stock_quantity === 0
      );

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    return list;
  }, [products, filter, search]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: products.length },
    {
      key: "published",
      label: "Publiés",
      count: products.filter((p) => p.is_published).length,
    },
    {
      key: "draft",
      label: "Brouillons",
      count: products.filter((p) => !p.is_published).length,
    },
    {
      key: "out_of_stock",
      label: "Rupture de stock",
      count: products.filter(
        (p) =>
          !p.has_variants &&
          p.stock_quantity !== null &&
          p.stock_quantity === 0
      ).length,
    },
  ];

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Impossible de supprimer ce produit.");
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Produit supprimé.");
    router.refresh();
  };

  const handleTogglePublish = async (id: string, publish: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_published: publish, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Impossible de modifier le statut.");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_published: publish } : p))
    );
    toast.success(publish ? "Produit publié." : "Produit dépublié.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produits</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} produit{products.length !== 1 ? "s" : ""} dans
            votre boutique
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="size-4" />
            Ajouter un produit
          </Link>
        </Button>
      </div>

      {/* Search & filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                filter === tab.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs",
                  filter === tab.key
                    ? "bg-background/20 text-background"
                    : "bg-muted-foreground/20"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
              onDelete={handleDelete}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}
