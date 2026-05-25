"use client";

import Image from "next/image";

/**
 * QR-code image rendered via api.qrserver.com — no client library, no
 * runtime JS cost. Perfect for a shareable shop link snapshot the seller
 * can save and post on social.
 */
export function QrCode({
  value,
  size = 240,
  alt = "QR code",
  className,
}: {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(value)}&size=${size}x${size}&margin=1&qzone=1&format=png&color=0F0F0F&bgcolor=FFFFFF`;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}
