import Link from "next/link";
import { ArrowRight, Sparkles, Store } from "lucide-react";
import type { ShopRow } from "@/lib/types/database";

interface ShopCardProps {
  shop: Pick<
    ShopRow,
    | "slug"
    | "name"
    | "description"
    | "logo_url"
    | "banner_url"
    | "theme_color"
    | "featured_until"
  >;
  featured?: boolean;
}

export function ShopCard({ shop, featured = false }: ShopCardProps) {
  return (
    <Link
      href={`/${shop.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={
        featured
          ? { borderColor: shop.theme_color, borderWidth: 2 }
          : undefined
      }
    >
      {/* Banner / gradient header */}
      <div
        className="relative h-24 w-full"
        style={{
          background: shop.banner_url
            ? `url(${shop.banner_url}) center/cover`
            : `linear-gradient(135deg, ${shop.theme_color}, ${shop.theme_color}cc)`,
        }}
      >
        {featured && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
            <Sparkles className="size-3" style={{ color: shop.theme_color }} />
            À la une
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3 -mt-10">
          <div
            className="size-12 rounded-xl border-2 border-card bg-background flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
            style={{ backgroundColor: shop.logo_url ? undefined : shop.theme_color }}
          >
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="size-full object-cover"
              />
            ) : (
              <Store className="size-5 text-white" />
            )}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-foreground truncate">{shop.name}</h3>
          {shop.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
              {shop.description}
            </p>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground">
            /{shop.slug}
          </span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-primary group-hover:gap-1.5 transition-all">
            Visiter
            <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
