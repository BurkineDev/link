import type { MetadataRoute } from "next";

/**
 * Manifeste PWA.
 *
 * Bio-Lien s'ouvre presque toujours depuis un téléphone, souvent depuis le
 * navigateur intégré de TikTok ou d'Instagram. « Ajouter à l'écran d'accueil »
 * est le seul moyen pour un vendeur de retrouver son tableau de bord sans
 * repasser par un lien — et pour ça il faut un manifeste, sinon Android
 * n'affiche pas la proposition d'installation et iOS invente une icône à
 * partir d'une capture de la page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bio-Lien — Ta boutique depuis ta bio",
    short_name: "Bio-Lien",
    description:
      "Crée ta page, vends tes produits et reçois tes commandes sur WhatsApp ou en Mobile Money.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    dir: "ltr",
    background_color: "#ffffff",
    // Peint la barre système au jaune de la marque une fois installée.
    theme_color: "#F1CB1C",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android rogne l'icône à sa propre forme : la version « maskable »
      // garde le B dans la zone sûre centrale pour ne pas se faire couper.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
