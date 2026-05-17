"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopRow } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { badgeVariants } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store as StoreIcon, Eye } from "lucide-react";

interface ShopClientProps {
  shop: ShopRow;
}

export default function ShopClient({ shop }: ShopClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPublished, setIsPublished] = useState(shop.is_published);
  const [isSaving, setIsSaving] = useState(false);

  const handlePublish = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq("id", shop.id);

    setIsSaving(false);

    if (error) {
      toast.error(error.message ?? "Impossible de publier la boutique.");
      return;
    }

    toast.success("Boutique publiée !");
    setIsPublished(true);
    router.refresh();
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", shop.id);

    setIsSaving(false);

    if (error) {
      toast.error(error.message ?? "Impossible de dépublier la boutique.");
      return;
    }

    toast.success("Boutique dépubliée.");
    setIsPublished(false);
    router.refresh();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ma Boutique</p>
            <h1 className="text-3xl font-bold tracking-tight">{shop.name}</h1>
            <p className="text-sm text-muted-foreground">
              Statut :&nbsp;
              <span className="font-semibold text-foreground">
                {isPublished ? "Publiée" : "Hors ligne"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${shop.slug}`}
              className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Eye className="mr-2 h-4 w-4" /> Voir la boutique publique
            </Link>
            <Button
              onClick={isPublished ? handleUnpublish : handlePublish}
              disabled={isSaving}
            >
              {isSaving
                ? isPublished
                  ? "Dépublication..."
                  : "Publication..."
                : isPublished
                ? "Dépublier la boutique"
                : "Publier la boutique"}
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                URL de la boutique
              </p>
              <p className="mt-2 text-sm text-foreground">/{shop.slug}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Thème sélectionné
              </p>
              <p className="mt-2 text-sm text-foreground">
                {shop.template_id ?? "Aucun"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <StoreIcon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Publication</p>
              <p className="text-sm text-muted-foreground">
                Active la boutique pour que les clients puissent la consulter et
                passer commande.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <span
              className={badgeVariants({
                variant: isPublished ? "outline" : "secondary",
              })}
            >
              {isPublished ? "Boutique visible" : "Boutique invisible"}
            </span>
            {!isPublished && (
              <p className="text-sm text-muted-foreground">
                Une fois publiée, ton magasin sera visible pour tous.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
