import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Playfair_Display,
  JetBrains_Mono,
  DM_Serif_Display,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
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
  title: "Bio-Lien | Crée ta boutique en ligne",
  description:
    "Bio-Lien te permet de créer ta boutique en ligne en 5 minutes. Partage ton lien sur TikTok et Instagram, accepte les paiements Mobile Money (Orange, MTN, Wave) et vends partout en Afrique.",
  keywords: [
    "boutique en ligne Afrique",
    "Mobile Money",
    "Orange Money",
    "MTN MoMo",
    "Wave",
    "vendre en ligne",
    "créateur africain",
    "lien bio shop",
  ],
  authors: [{ name: "Bio-Lien" }],
  creator: "Bio-Lien",
  metadataBase: new URL("https://www.bio-lien.com"),
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.bio-lien.com",
    title: "Bio-Lien | Crée ta boutique en ligne",
    description:
      "Crée ta boutique en ligne en 5 minutes. Accepte les paiements Mobile Money et vends via TikTok & Instagram.",
    siteName: "Bio-Lien",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bio-Lien — Ta boutique en ligne africaine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bio-Lien | Crée ta boutique en ligne",
    description:
      "Crée ta boutique en ligne en 5 minutes. Accepte les paiements Mobile Money.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${dmSerifDisplay.variable} h-full antialiased`}
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
