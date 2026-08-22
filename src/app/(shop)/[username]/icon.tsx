import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { resolveBioTheme } from "@/lib/bio-themes";
import type { Database } from "@/lib/types/database";

/**
 * Icône d'onglet propre à chaque boutique.
 *
 * Une page bio partagée dans TikTok ou WhatsApp finit dans un onglet parmi
 * douze. Y afficher notre logo revient à dire au visiteur qu'il est chez
 * Bio-Lien ; y afficher l'initiale du vendeur, dans ses couleurs, lui dit
 * qu'il est chez ce vendeur — ce qui est le propos du produit.
 *
 * On dessine l'initiale plutôt que d'aller chercher le logo du vendeur : le
 * moteur de rendu de next/og ne décode pas le WebP (leçon des images de
 * story), et une icône de 32 px n'a de toute façon la place que d'une lettre.
 */

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

type Props = { params: Promise<{ username: string }> };

export default async function Icon({ params }: Props) {
  const { username } = await params;

  // Repli sur la marque : une boutique inconnue, non publiée, ou une base
  // injoignable ne doit pas laisser l'onglet sans icône.
  const fallback = { background: "#F1CB1C", color: "#111111", letter: "B" };
  let look = fallback;

  if (/^[a-z0-9_-]{3,50}$/.test(username)) {
    try {
      const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { data: shop } = await supabase
        .from("shops")
        .select("name, bio_theme, theme_color, accent_color")
        .eq("slug", username)
        .eq("is_published", true)
        .single();

      if (shop) {
        const palette = resolveBioTheme(shop);
        look = {
          // La surface, pas le fond : à 32 px il faut un aplat franc, et
          // certains thèmes ont un dégradé que satori ne rendrait pas net.
          background: palette.surface,
          color: palette.surfaceText,
          letter: (shop.name.trim()[0] ?? "B").toUpperCase(),
        };
      }
    } catch {
      // Voir plus haut : on garde le repli.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: look.background,
          color: look.color,
          // 32 px ne laissent la place qu'à une lettre : autant qu'elle
          // remplisse la tuile.
          fontSize: 25,
          fontWeight: 800,
          borderRadius: 7,
        }}
      >
        {look.letter}
      </div>
    ),
    size,
  );
}
