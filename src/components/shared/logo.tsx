"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
}

const sizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Logo({ className, size = "md", href = "/" }: LogoProps) {
  return (
    <Link href={href} className={cn("flex items-center gap-1.5 font-black", sizes[size], className)}>
      <span className="gradient-brand-text">Link</span>
      <span className="text-foreground">Boutik</span>
      <span className="gradient-brand text-transparent rounded-sm px-1 text-[0.6em] font-bold leading-none py-0.5">
        AF
      </span>
    </Link>
  );
}
