"use client";

// ---------------------------------------------------------------------------
// LinkBoutik – Shop Theme Preview Cards
// Six minimalist themes displayed as Shopify-style preview cards.
// Each card: header (logo + nav) · 2×2 product grid · footer
// ---------------------------------------------------------------------------

import type { ComponentType } from "react";
import { ShoppingBag, Search, Heart, Star } from "lucide-react";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ProductCardProps {
  bg: string;
  label: string;
  price: string;
  badge?: string;
  heartColor?: string;
  starColor?: string;
  textPrimary?: string;
  textMuted?: string;
  priceFg?: string;
  badgeBg?: string;
  badgeFg?: string;
}

function ProductCard({
  bg,
  label,
  price,
  badge,
  heartColor = "text-gray-300",
  starColor = "text-yellow-400",
  textPrimary = "text-gray-900",
  textMuted = "text-gray-400",
  priceFg = "text-gray-900",
  badgeBg = "bg-gray-100",
  badgeFg = "text-gray-600",
}: ProductCardProps) {
  return (
    <div className="rounded-xl overflow-hidden">
      <div className={`${bg} relative aspect-square flex items-end justify-end p-2`}>
        {badge && (
          <span className={`absolute top-2 left-2 text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${badgeBg} ${badgeFg}`}>
            {badge}
          </span>
        )}
        <Heart className={`size-3 ${heartColor}`} />
      </div>
      <div className="pt-2 pb-1 px-0.5">
        <p className={`text-[9px] font-medium leading-tight truncate ${textPrimary}`}>{label}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[8px] flex items-center gap-0.5 ${textMuted}`}>
            <Star className={`size-2 fill-current ${starColor}`} />
            4.8
          </span>
          <span className={`text-[9px] font-bold ${priceFg}`}>{price}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. IVORY — warm white, serif, luxury
// ---------------------------------------------------------------------------

export function IvoryThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-stone-200 shadow-md bg-[#FDFBF7] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 bg-[#FDFBF7]">
        <span className="text-[10px] font-serif font-semibold tracking-widest text-stone-800 uppercase">Maison Élite</span>
        <nav className="flex items-center gap-3">
          {["Boutique", "Collections", "À propos"].map((item) => (
            <span key={item} className="text-[7px] text-stone-500 tracking-wide uppercase">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Search className="size-3 text-stone-400" />
          <ShoppingBag className="size-3 text-stone-800" />
        </div>
      </header>

      {/* Hero ribbon */}
      <div className="bg-stone-100 text-center py-1.5">
        <span className="text-[7px] tracking-[0.3em] text-stone-500 uppercase">Nouvelle Collection Printemps 2026</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <ProductCard bg="bg-[#EDE8DF]" label="Robe Lin Naturel" price="89 000 F" badge="Nouveau" badgeBg="bg-stone-800" badgeFg="text-stone-100" heartColor="text-stone-300" textPrimary="text-stone-800" textMuted="text-stone-400" priceFg="text-stone-800" />
        <ProductCard bg="bg-[#E5DDD3]" label="Sac Cuir Tressé" price="145 000 F" heartColor="text-stone-300" textPrimary="text-stone-800" textMuted="text-stone-400" priceFg="text-stone-800" />
        <ProductCard bg="bg-[#DDD5C9]" label="Collier Perles" price="42 000 F" heartColor="text-stone-300" textPrimary="text-stone-800" textMuted="text-stone-400" priceFg="text-stone-800" />
        <ProductCard bg="bg-[#E9E3DB]" label="Foulard Soie" price="28 000 F" badge="−20%" badgeBg="bg-amber-100" badgeFg="text-amber-800" heartColor="text-stone-300" textPrimary="text-stone-800" textMuted="text-stone-400" priceFg="text-stone-800" />
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 px-4 py-2 flex items-center justify-between bg-[#FDFBF7]">
        <span className="text-[7px] text-stone-400 tracking-wide">© 2026 Maison Élite</span>
        <span className="text-[7px] font-serif italic text-stone-500">Artisanat d'exception</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. OBSIDIAN — dark, charcoal, gold accents
// ---------------------------------------------------------------------------

export function ObsidianThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-stone-800 shadow-md bg-[#1C1917] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700 bg-[#1C1917]">
        <span className="text-[10px] font-bold tracking-widest text-[#CA8A04] uppercase">NOIR</span>
        <nav className="flex items-center gap-3">
          {["Store", "Look", "About"].map((item) => (
            <span key={item} className="text-[7px] text-stone-400 tracking-wide uppercase">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Search className="size-3 text-stone-500" />
          <ShoppingBag className="size-3 text-[#CA8A04]" />
        </div>
      </header>

      {/* Gold divider */}
      <div className="h-px bg-linear-to-r from-transparent via-[#CA8A04] to-transparent" />

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#1C1917]">
        <ProductCard bg="bg-[#292524]" label="Montre Automatique" price="320 000 F" badge="Edition limitée" badgeBg="bg-[#CA8A04]" badgeFg="text-stone-900" heartColor="text-stone-600" starColor="text-[#CA8A04]" textPrimary="text-stone-200" textMuted="text-stone-500" priceFg="text-[#CA8A04]" />
        <ProductCard bg="bg-[#312E2B]" label="Ceinture Croco" price="78 000 F" heartColor="text-stone-600" starColor="text-[#CA8A04]" textPrimary="text-stone-200" textMuted="text-stone-500" priceFg="text-[#CA8A04]" />
        <ProductCard bg="bg-[#2A2725]" label="Portefeuille Nappa" price="55 000 F" heartColor="text-stone-600" starColor="text-[#CA8A04]" textPrimary="text-stone-200" textMuted="text-stone-500" priceFg="text-[#CA8A04]" />
        <ProductCard bg="bg-[#302D2A]" label="Lunettes Noir Mat" price="48 000 F" badge="Top" badgeBg="bg-stone-700" badgeFg="text-[#CA8A04]" heartColor="text-stone-600" starColor="text-[#CA8A04]" textPrimary="text-stone-200" textMuted="text-stone-500" priceFg="text-[#CA8A04]" />
      </div>

      {/* Footer */}
      <div className="h-px bg-linear-to-r from-transparent via-[#CA8A04] to-transparent" />
      <footer className="px-4 py-2 flex items-center justify-between bg-[#1C1917]">
        <span className="text-[7px] text-stone-600 tracking-wide">© 2026 NOIR</span>
        <span className="text-[7px] text-[#CA8A04] tracking-widest uppercase">Luxe & Précision</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. SAGE — soft green, nature, eco
// ---------------------------------------------------------------------------

export function SageThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-green-200 shadow-md bg-[#F2F5F0] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-green-200 bg-white">
        <span className="text-[10px] font-semibold tracking-wider text-green-800">🌿 Verdure</span>
        <nav className="flex items-center gap-3">
          {["Plantes", "Soins", "Blog"].map((item) => (
            <span key={item} className="text-[7px] text-green-600 tracking-wide">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Search className="size-3 text-green-400" />
          <ShoppingBag className="size-3 text-green-700" />
        </div>
      </header>

      {/* Nature banner */}
      <div className="bg-green-50 text-center py-1.5 border-b border-green-100">
        <span className="text-[7px] tracking-wide text-green-700">Livraison offerte • 100% naturel • Emballage éco</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#F2F5F0]">
        <ProductCard bg="bg-[#D1E5C8]" label="Plante Monstera" price="18 500 F" badge="Eco" badgeBg="bg-green-700" badgeFg="text-white" heartColor="text-green-300" starColor="text-green-500" textPrimary="text-green-900" textMuted="text-green-500" priceFg="text-green-800" />
        <ProductCard bg="bg-[#C8DBBF]" label="Huile Karité Bio" price="9 800 F" heartColor="text-green-300" starColor="text-green-500" textPrimary="text-green-900" textMuted="text-green-500" priceFg="text-green-800" />
        <ProductCard bg="bg-[#D6E8CE]" label="Savon Aloe Vera" price="4 200 F" heartColor="text-green-300" starColor="text-green-500" textPrimary="text-green-900" textMuted="text-green-500" priceFg="text-green-800" />
        <ProductCard bg="bg-[#BDD4B4]" label="Diffuseur Bambou" price="22 000 F" badge="−15%" badgeBg="bg-lime-100" badgeFg="text-lime-800" heartColor="text-green-300" starColor="text-green-500" textPrimary="text-green-900" textMuted="text-green-500" priceFg="text-green-800" />
      </div>

      {/* Footer */}
      <footer className="border-t border-green-200 px-4 py-2 flex items-center justify-between bg-white">
        <span className="text-[7px] text-green-400">© 2026 Verdure</span>
        <span className="text-[7px] text-green-600 italic">Naturel · Durable · Éthique</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. BLUSH — soft pink, fashion-forward, feminine
// ---------------------------------------------------------------------------

export function BlushThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-pink-200 shadow-md bg-[#FFF5F7] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-pink-100 bg-white">
        <span className="text-[10px] font-light tracking-[0.2em] text-rose-800 uppercase">Rose & Co.</span>
        <nav className="flex items-center gap-3">
          {["Mode", "Beauté", "Lifestyle"].map((item) => (
            <span key={item} className="text-[7px] text-pink-400 tracking-wide">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Heart className="size-3 text-pink-300 fill-pink-200" />
          <ShoppingBag className="size-3 text-rose-500" />
        </div>
      </header>

      {/* Pink marquee */}
      <div className="bg-rose-400 text-center py-1">
        <span className="text-[7px] tracking-[0.2em] text-white uppercase">Nouvelle saison · Femme · Printemps 2026</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#FFF5F7]">
        <ProductCard bg="bg-[#FFD6DD]" label="Robe Midi Fleurie" price="34 900 F" badge="Tendance" badgeBg="bg-rose-400" badgeFg="text-white" heartColor="text-pink-300" starColor="text-rose-400" textPrimary="text-rose-900" textMuted="text-pink-400" priceFg="text-rose-700" />
        <ProductCard bg="bg-[#FFC8D2]" label="Crop Top Satin" price="18 500 F" heartColor="text-pink-300" starColor="text-rose-400" textPrimary="text-rose-900" textMuted="text-pink-400" priceFg="text-rose-700" />
        <ProductCard bg="bg-[#FFD0DA]" label="Sac Velours Rose" price="29 000 F" heartColor="text-pink-300" starColor="text-rose-400" textPrimary="text-rose-900" textMuted="text-pink-400" priceFg="text-rose-700" />
        <ProductCard bg="bg-[#FFBDCB]" label="Mules Pastel" price="22 500 F" badge="−25%" badgeBg="bg-pink-100" badgeFg="text-rose-600" heartColor="text-pink-300" starColor="text-rose-400" textPrimary="text-rose-900" textMuted="text-pink-400" priceFg="text-rose-700" />
      </div>

      {/* Footer */}
      <footer className="border-t border-pink-100 px-4 py-2 flex items-center justify-between bg-white">
        <span className="text-[7px] text-pink-300">© 2026 Rose & Co.</span>
        <span className="text-[7px] italic text-rose-400">Féminité · Élégance · Style</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. COBALT — bold blue, modern, tech, clean grid
// ---------------------------------------------------------------------------

export function CobaltThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-blue-200 shadow-md bg-white select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#1D4ED8]">
        <span className="text-[10px] font-bold tracking-tight text-white">COBALT</span>
        <nav className="flex items-center gap-3">
          {["Tech", "Audio", "Accès."].map((item) => (
            <span key={item} className="text-[7px] text-blue-200 tracking-wide">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Search className="size-3 text-blue-200" />
          <ShoppingBag className="size-3 text-white" />
        </div>
      </header>

      {/* Blue strip */}
      <div className="bg-[#DBEAFE] text-center py-1 border-b border-blue-100">
        <span className="text-[7px] tracking-wide text-blue-700 font-medium">Livraison express · Garantie 2 ans · Support 24/7</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-white">
        <ProductCard bg="bg-[#BFDBFE]" label="Écouteurs True" price="89 000 F" badge="Top vente" badgeBg="bg-blue-600" badgeFg="text-white" heartColor="text-blue-200" starColor="text-blue-500" textPrimary="text-blue-900" textMuted="text-blue-400" priceFg="text-blue-700" />
        <ProductCard bg="bg-[#93C5FD]" label="Montre Connect." price="145 000 F" heartColor="text-blue-200" starColor="text-blue-500" textPrimary="text-blue-900" textMuted="text-blue-400" priceFg="text-blue-700" />
        <ProductCard bg="bg-[#A5C8FB]" label="Chargeur USB-C" price="12 500 F" heartColor="text-blue-200" starColor="text-blue-500" textPrimary="text-blue-900" textMuted="text-blue-400" priceFg="text-blue-700" />
        <ProductCard bg="bg-[#BAD6FD]" label="Caméra HD Mini" price="68 000 F" badge="−10%" badgeBg="bg-sky-100" badgeFg="text-sky-700" heartColor="text-blue-200" starColor="text-blue-500" textPrimary="text-blue-900" textMuted="text-blue-400" priceFg="text-blue-700" />
      </div>

      {/* Footer */}
      <footer className="border-t border-blue-100 px-4 py-2 flex items-center justify-between bg-white">
        <span className="text-[7px] text-blue-300">© 2026 COBALT</span>
        <span className="text-[7px] font-medium text-blue-600 uppercase tracking-wide">Tech · Innovation</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. TERRACOTTA — warm earth tones, African artisan market
// ---------------------------------------------------------------------------

export function TerracottaThemePreview() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-orange-200 shadow-md bg-[#FDF6EE] select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-orange-200 bg-[#FDF6EE]">
        <span className="text-[10px] font-bold tracking-widest text-orange-900 uppercase">Afrikart</span>
        <nav className="flex items-center gap-3">
          {["Tissus", "Poterie", "Bijoux"].map((item) => (
            <span key={item} className="text-[7px] text-orange-700 tracking-wide">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Search className="size-3 text-orange-400" />
          <ShoppingBag className="size-3 text-orange-800" />
        </div>
      </header>

      {/* Warm banner */}
      <div className="bg-[#C2500E] text-center py-1">
        <span className="text-[7px] tracking-[0.15em] text-orange-100 uppercase">Artisans d'Afrique · Fait main · Commerce équitable</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#FDF6EE]">
        <ProductCard bg="bg-[#E8C4A0]" label="Wax Bogolan Trad." price="15 000 F" badge="Artisanal" badgeBg="bg-orange-700" badgeFg="text-orange-50" heartColor="text-orange-300" starColor="text-amber-500" textPrimary="text-orange-900" textMuted="text-orange-500" priceFg="text-orange-800" />
        <ProductCard bg="bg-[#D4A882]" label="Pot Terre Cuite" price="12 500 F" heartColor="text-orange-300" starColor="text-amber-500" textPrimary="text-orange-900" textMuted="text-orange-500" priceFg="text-orange-800" />
        <ProductCard bg="bg-[#DFB58F]" label="Bracelet Bronze" price="8 900 F" heartColor="text-orange-300" starColor="text-amber-500" textPrimary="text-orange-900" textMuted="text-orange-500" priceFg="text-orange-800" />
        <ProductCard bg="bg-[#CBA08B]" label="Panier Osier Tressé" price="6 500 F" badge="−30%" badgeBg="bg-amber-100" badgeFg="text-amber-900" heartColor="text-orange-300" starColor="text-amber-500" textPrimary="text-orange-900" textMuted="text-orange-500" priceFg="text-orange-800" />
      </div>

      {/* Footer */}
      <footer className="border-t border-orange-200 px-4 py-2 flex items-center justify-between bg-[#FDF6EE]">
        <span className="text-[7px] text-orange-400">© 2026 Afrikart</span>
        <span className="text-[7px] italic text-orange-700">Tradition · Authenticité · Afrique</span>
      </footer>
    </div>
  );
}

import { TEMPLATES, type TemplateId } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Gallery — templates available in the database
// ---------------------------------------------------------------------------

const TEMPLATE_PREVIEWS: Record<TemplateId, ComponentType> = {
  minimal: IvoryThemePreview,
  boutique: ObsidianThemePreview,
  market: SageThemePreview,
  artisan: BlushThemePreview,
};

export const THEMES = TEMPLATES.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.description,
  Preview: TEMPLATE_PREVIEWS[template.id],
}));

export type ThemeId = TemplateId;

interface ThemeGalleryProps {
  selected?: ThemeId;
  onSelect?: (id: ThemeId) => void;
}

export function ThemeGallery({ selected, onSelect }: ThemeGalleryProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map(({ id, name, description, Preview }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect?.(id)}
          className={[
            "group relative flex flex-col gap-3 rounded-2xl border-2 p-3 text-left transition-all duration-200 cursor-pointer",
            selected === id
              ? "border-primary ring-2 ring-primary/20 shadow-lg"
              : "border-border hover:border-primary/50 hover:shadow-md",
          ].join(" ")}
        >
          {/* Preview card */}
          <div className="overflow-hidden rounded-xl pointer-events-none">
            <Preview />
          </div>

          {/* Theme info */}
          <div className="px-1 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{name}</p>
              {selected === id && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Sélectionné
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
