import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 : le sous-domaine public du bucket Bio-Lien, puis le
      // domaine personnalisé. Uniquement nos hôtes : l'optimiseur d'images
      // est un proxy public, un joker (`*.r2.dev`) laisserait n'importe qui
      // faire transiter et mettre en cache ses images par www.bio-lien.com.
      // (Mettre à jour R2_PUBLIC_URL et cette liste ensemble.)
      {
        protocol: "https",
        hostname: "pub-f17605c4838541d783c2a15ab5d32472.r2.dev",
      },
      {
        protocol: "https",
        hostname: "assets.bio-lien.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Two quality tiers: 45 for grid thumbnails (2-up cards on a phone —
    // invisible loss, roughly half the bytes on 3G), 75 for hero images.
    qualities: [45, 75],
    // Optimize for slow African networks
    deviceSizes: [360, 414, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // Compress responses for 3G networks
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
