import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Poppins,
  Caveat,
  Playfair_Display,
  JetBrains_Mono,
  DM_Serif_Display,
  Space_Grotesk,
  Ojuju,
  Atkinson_Hyperlegible_Next,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Police de la marque, telle que définie dans les maquettes.
 *
 * Chargée ici pour que la variable existe sur tout le document, mais elle
 * n'est appliquée qu'aux surfaces de marque : les boutiques des vendeurs
 * gardent la police que chaque vendeur a choisie.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-brand",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Police du mot-symbole uniquement (planche de marque : Poppins).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
});

// Police manuscrite des accroches de l'accueil (« Plus qu'un lien, une histoire »).
const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Storefront theming fonts — opt-in per shop via shop.font_family.
// All loaded with display:swap so the dashboard stays snappy.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Polices optionnelles du vendeur : sans `preload: false`, chaque woff2
// déclaré dans le layout racine serait préchargé sur toutes les routes — trois
// fichiers de plus à la première visite en 3G, même pour une boutique en Inter.
// Le navigateur ne les télécharge que sur une page qui les utilise.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Paire des thèmes « Afrique de l'Ouest » (bogolan, wax, indigo, pagne).
// Ojuju (Ụdị Foundry, Lagos) en un seul poids, 700, pour le nom, les titres de
// groupe et les chiffres du prix ; Atkinson Hyperlegible Next (Braille
// Institute), variable, pour le corps — la plus lisible en plein soleil sur un
// LCD d'entrée de gamme, aussi proposée seule comme police « Hyperlisible ».
// latin-ext couvre ɛ ɔ ŋ ɓ des noms en mooré, dioula et fulfulde.
const ojuju = Ojuju({
  variable: "--font-ojuju",
  weight: "700",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

// Next ne connaît pas les métriques d'« Atkinson Hyperlegible Next » (seule
// l'ancienne « Atkinson Hyperlegible » est dans son catalogue) : il ne peut pas
// fabriquer la police de repli ajustée et le signale à chaque requête. On le
// lui dit explicitement, et on pose nous-mêmes une pile de repli sans-serif —
// sans elle, le temps que le woff2 arrive en 3G, `display: swap` afficherait
// le texte dans la police par défaut du navigateur, souvent une serif.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

// Les métadonnées sont figées au build : lire le drapeau ici est correct.
// Caisse masquée (le défaut), la promesse est « reçois tes commandes sur
// WhatsApp » et les mots-clés opérateurs disparaissent ; caisse allumée, les
// textes d'origine reviennent tels quels.
const ONLINE = isOnlineCheckoutEnabled();

const DESCRIPTION = ONLINE
  ? "Crée ta boutique en ligne en 5 minutes et vends en Afrique de l'Ouest — Côte d'Ivoire, Sénégal, Burkina Faso, Bénin, Mali, Togo. Partage ton lien sur TikTok et Instagram, encaisse en Mobile Money (Orange, MTN, Wave, Moov) ou par carte bancaire."
  : "Crée ta boutique en ligne en 5 minutes et vends en Afrique de l'Ouest — Côte d'Ivoire, Sénégal, Burkina Faso, Bénin, Mali, Togo. Partage ton lien sur TikTok et Instagram, reçois tes commandes sur WhatsApp.";

const OG_DESCRIPTION = ONLINE
  ? "Crée ta boutique en ligne en 5 minutes et vends partout en Afrique de l'Ouest. Mobile Money ou carte bancaire, depuis TikTok et Instagram."
  : "Crée ta boutique en ligne en 5 minutes et vends partout en Afrique de l'Ouest. Reçois tes commandes sur WhatsApp, depuis TikTok et Instagram.";

const TWITTER_DESCRIPTION = ONLINE
  ? "Crée ta boutique en ligne en 5 minutes. Accepte les paiements Mobile Money."
  : "Crée ta boutique en ligne en 5 minutes. Reçois tes commandes sur WhatsApp.";

// Les opérateurs ne sont un mot-clé que si on les propose aux acheteurs.
const OPERATOR_KEYWORDS = ONLINE
  ? ["Mobile Money", "Orange Money", "MTN MoMo", "Wave", "Moov Money"]
  : [];

export const metadata: Metadata = {
  // Un seul endroit décide de la forme d'un titre d'onglet. Les pages
  // fournissent leur nom, le gabarit ajoute la marque — sinon chacune recolle
  // le suffixe à sa façon et l'onglet mélange « | » et « — ».
  title: {
    default: "Bio-Lien | Crée ta boutique en ligne",
    template: "%s | Bio-Lien",
  },
  description: DESCRIPTION,
  // Google ne se sert plus de cette balise pour classer ; elle ne coûte rien
  // et reste lue par d'autres moteurs. Ce qui pèse vraiment, c'est le titre,
  // la description et le contenu des pages.
  keywords: [
    "boutique en ligne Afrique de l'Ouest",
    "boutique en ligne Côte d'Ivoire",
    "boutique en ligne Sénégal",
    "boutique en ligne Burkina Faso",
    "vendre sur TikTok Afrique",
    "vendre sur WhatsApp",
    ...OPERATOR_KEYWORDS,
    "lien bio boutique",
    "créateur africain",
  ],
  authors: [{ name: "Bio-Lien" }],
  creator: "Bio-Lien",
  metadataBase: new URL("https://www.bio-lien.com"),
  // Canonique par défaut. Chaque page publique déclare la sienne ; celle-ci
  // ne sert que pour l'accueil, seule page sans `generateMetadata`.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.bio-lien.com",
    title: "Bio-Lien | Crée ta boutique en ligne",
    description: OG_DESCRIPTION,
    siteName: "Bio-Lien",
    // OG image is generated dynamically from src/app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Bio-Lien | Crée ta boutique en ligne",
    description: TWITTER_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  // Les fichiers icon.svg / apple-icon.png / favicon.ico de src/app sont
  // détectés automatiquement ; seul le manifeste demande à être déclaré.
  manifest: "/manifest.webmanifest",
  // Nom affiché sous l'icône quand un vendeur ajoute Bio-Lien à son écran
  // d'accueil sur iOS, où le manifeste n'est pas lu.
  appleWebApp: {
    capable: true,
    title: "Bio-Lien",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${poppins.variable} ${caveat.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${dmSerifDisplay.variable} ${ojuju.variable} ${atkinson.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
