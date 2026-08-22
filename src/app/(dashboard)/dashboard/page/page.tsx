import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageBuilder } from "./page-builder";
import { resolveBioPageBlocks, type LegacyLink } from "@/lib/blocks/resolve";
import type { PageBlockRow, ShopRow } from "@/lib/types/database";

export const metadata = { title: "Ma page — Bio-Lien" };

/**
 * « Ma page » — le Page Builder, cœur du produit.
 *
 * Charge les blocs enregistrés. S'il n'y en a aucun, prépare la composition
 * *proposée* à partir des liens et produits existants : le vendeur voit sa
 * page telle qu'elle est en ligne aujourd'hui et peut l'adopter d'un clic.
 * Rien n'est écrit en base tant qu'il n'a pas décidé.
 */
export default async function MyPageRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shopData } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  const shop = shopData as ShopRow | null;
  if (!shop) redirect("/dashboard/onboarding");

  const [blocksResult, linksResult, productsResult] = await Promise.all([
    supabase
      .from("page_blocks")
      .select("*")
      .eq("shop_id", shop.id)
      .order("position", { ascending: true }),
    supabase
      .from("shop_links")
      .select("id, label, url, icon, thumbnail_url, position")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .from("products")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("is_published", true)
      .limit(1),
  ]);

  const rows = (blocksResult.data ?? []) as PageBlockRow[];
  const links = (linksResult.data ?? []) as LegacyLink[];
  const hasProducts = (productsResult.data ?? []).length > 0;

  const { blocks, source } = resolveBioPageBlocks({
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      position: r.position,
      title: r.title,
      config: r.config,
      style: r.style,
      visible: r.visible,
    })),
    links,
    hasProducts,
    options: { includeHidden: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <PageBuilder
      shop={shop}
      initialBlocks={blocks}
      source={source}
      pageUrl={`${appUrl.replace(/\/$/, "")}/${shop.slug}`}
    />
  );
}
