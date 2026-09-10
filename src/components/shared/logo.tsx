"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
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

/** Le logotype Bio-Lien : maillon, « Bio » en encre, « -Lien » dans le citron des boutons. */
export function Logo({ className, size = "md", href = "/" }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-[0.3em] font-logo font-extrabold tracking-[-0.03em]",
        sizes[size],
        className,
      )}
    >
      <LogoMark className="size-[1.25em] shrink-0" />
      {/* « Bio » hérite de la couleur du parent : lisible sur clair comme sur sombre. */}
      <span>
        Bio<span className="logo-outline text-[var(--b-lime)]">-Lien</span>
      </span>
    </Link>
  );
}
