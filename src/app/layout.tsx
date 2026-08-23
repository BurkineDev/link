import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Playfair_Display,
  JetBrains_Mono,
  DM_Serif_Display,
  Bricolage_Grotesque,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Police de la marque, telle que définie dans le design.
 *
 * Chargée ici pour que la variable existe sur tout le document, mais elle
 * n'est appliquée qu'aux surfaces de marque : le tableau de bord et les
 * boutiques des vendeurs gardent leurs propres polices.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-brand",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
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

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Un seul endroit décide de la forme d'un titre d'onglet. Les pages
  // fournissent leur nom, le gabarit ajoute la marque — sinon chacune recolle
  // le suffixe à sa façon et l'onglet mélange « | » et « — ».
  title: {
    default: "Bio-Lien | Crée ta boutique en ligne",
    template: "%s | Bio-Lien",
  },
  description:
    "Crée ta boutique en ligne en 5 minutes et vends en Afrique de l'Ouest — Côte d'Ivoire, Sénégal, Burkina Faso, Bénin, Mali, Togo. Partage ton lien sur TikTok et Instagram, encaisse en Mobile Money (Orange, MTN, Wave, Moov) ou par carte bancaire.",
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
    "Mobile Money",
    "Orange Money",
    "MTN MoMo",
    "Wave",
    "Moov Money",
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
    description:
      "Crée ta boutique en ligne en 5 minutes et vends partout en Afrique de l'Ouest. Mobile Money ou carte bancaire, depuis TikTok et Instagram.",
    siteName: "Bio-Lien",
    // OG image is generated dynamically from src/app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Bio-Lien | Crée ta boutique en ligne",
    description:
      "Crée ta boutique en ligne en 5 minutes. Accepte les paiements Mobile Money.",
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
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${dmSerifDisplay.variable} h-full antialiased`}
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
