import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ShopCard } from "@/components/explore/shop-card";
import type { ShopRow } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Explorer les boutiques — Bio-Lien",
  description:
    "Découvre toutes les boutiques de créateurs et entrepreneurs sur Bio-Lien. Mode, beauté, artisanat, formations — directement depuis tes réseaux préférés.",
};

// Public marketplace surface — refresh hourly. The seller list changes
// constantly but doesn't need request-time freshness.
export const revalidate = 3600;

const PAGE_SIZE = 24;

type ExploreShop = Pick<
  ShopRow,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "logo_url"
  | "banner_url"
  | "theme_color"
  | "featured_until"
>;

export default async function ExplorePage() {
  const supabase = await createClient();

  // Featured shops first (boost still active), then by recent update.
  // `shops_explore_idx` covers this ordering on published rows.
  const { data: rawShops } = await supabase
    .from("shops")
    .select(
      "id, slug, name, description, logo_url, banner_url, theme_color, featured_until",
    )
    .eq("is_published", true)
    .order("featured_until", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(PAGE_SIZE);

  const shops = (rawShops ?? []) as ExploreShop[];
  const now = new Date();
  const featured = shops.filter(
    (s) => s.featured_until && new Date(s.featured_until) > now,
  );
  const others = shops.filter(
    (s) => !s.featured_until || new Date(s.featured_until) <= now,
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-black text-lg"
          >
            <span>Bio</span>
            <span className="text-primary">-Lien</span>
            <span className="bg-primary text-primary-foreground rounded-sm px-1 text-[0.6em] font-bold leading-none py-0.5">
              AF
            </span>
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
          >
            Créer ma boutique
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-4">
            <Store className="size-3" />
            Marketplace Bio-Lien
          </span>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3">
            Découvre les <span className="text-primary">boutiques</span> de
            créateurs
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Mode, beauté, artisanat, formations — soutiens directement les
            créateurs africains.
          </p>
        </div>

        {/* ── Featured ── */}
        {featured.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                Mises en avant
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((shop) => (
                <ShopCard key={shop.id} shop={shop} featured />
              ))}
            </div>
          </div>
        )}

        {/* ── All other shops ── */}
        <div>
          {featured.length > 0 && (
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground mb-4">
              Toutes les boutiques
            </h2>
          )}
          {others.length === 0 && featured.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {others.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">
            Toi aussi, mets ta boutique dans ta bio.
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Gratuit pour démarrer. Tu n&apos;as qu&apos;à ajouter tes produits
            et coller ton lien.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 h-11 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Créer ma boutique
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
        <Store className="size-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">Aucune boutique publiée pour le moment</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Sois le ou la première à publier ta boutique sur Bio-Lien — tu seras
        mis(e) en avant ici.
      </p>
      <Link
        href="/register"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 h-10 text-sm font-semibold hover:bg-muted transition-colors"
      >
        Créer ma boutique
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
