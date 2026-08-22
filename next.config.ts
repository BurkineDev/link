import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
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
