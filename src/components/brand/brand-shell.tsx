/**
 * Le décor et le logotype partagés par les cinq écrans de marque.
 *
 * Les maquettes répètent exactement le même fond derrière l'accueil, la
 * connexion, le tableau de bord, les outils et la page bio. Le mettre ici
 * plutôt que de le recopier cinq fois, c'est la seule façon qu'il reste
 * identique le jour où on le retouche.
 */

import Link from "next/link";

/** Une sphère de décor : lumière en haut à gauche, ombre portée violette. */
export function Orb({
  className,
  from,
  via,
  to,
  glow = "0 40px 80px -30px rgb(96 70 180 / 35%)",
  delay = "0s",
}: {
  className: string;
  from: string;
  via: string;
  to: string;
  glow?: string;
  delay?: string;
}) {
  return (
    <div
      aria-hidden
      className={`brand-orb ${className}`}
      style={{
        background: `radial-gradient(circle at 32% 28%, ${from} 0%, ${via} 45%, ${to} 100%)`,
        boxShadow: glow,
        animationDelay: delay,
      }}
    />
  );
}

/**
 * Fond de marque, fixe et non cliquable.
 *
 * `variant="full"` ajoute la houle du bas de la page d'accueil ; les écrans
 * applicatifs s'en passent, elle n'a de sens que sous une page qui se lit
 * d'une traite.
 */
export function BrandBackdrop({
  variant = "simple",
}: {
  variant?: "simple" | "full";
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Orb
        className="-left-16 top-[7%] size-[190px] sm:size-[220px]"
        from="#F6F2FF"
        via="#D9CCF4"
        to="#B9A6E8"
      />
      <Orb
        className="-right-14 bottom-[20%] size-[160px] sm:size-[180px]"
        from="#EDE6FF"
        via="#C9B8F0"
        to="#9F86DE"
        glow="0 32px 64px -24px rgb(96 70 180 / 40%)"
        delay="-9s"
      />
      <div className="brand-dots right-[10%] top-[22%] size-[120px] opacity-50 sm:size-[130px]" />

      {variant === "full" && (
        <>
          <Orb
            className="right-[10%] top-[14%] size-14"
            from="#F1EBFF"
            via="#C4B2EF"
            to="#A28BE2"
            glow="0 18px 36px -18px rgb(96 70 180 / 40%)"
            delay="-14s"
          />
          <div className="brand-dots left-[6%] top-[30%] hidden size-[190px] opacity-[.55] lg:block" />
          {/* La houle : deux voiles qui montent du bas, à peine inclinées. */}
          <div
            className="absolute -bottom-40 -left-[10%] h-[380px] w-[70%] -rotate-4"
            style={{
              borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
              background:
                "linear-gradient(180deg, rgb(196 178 239 / 50%) 0%, rgb(196 178 239 / 0%) 80%)",
            }}
          />
          <div
            className="absolute -bottom-50 -right-[15%] h-[420px] w-[75%] rotate-3"
            style={{
              borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
              background:
                "linear-gradient(180deg, rgb(159 134 222 / 35%) 0%, rgb(159 134 222 / 0%) 80%)",
            }}
          />
        </>
      )}
    </div>
  );
}

/** `bio-lien` suivi du point vert. Le point est la marque, pas une décoration. */
export function Wordmark({
  className = "text-[22px]",
  href = "/",
  dark = false,
}: {
  className?: string;
  href?: string | null;
  dark?: boolean;
}) {
  const inner = (
    <span
      className={`font-extrabold tracking-[-0.02em] ${className}`}
      style={{ color: dark ? "var(--b-on-dark)" : "var(--b-ink)" }}
    >
      bio-lien<span style={{ color: "var(--b-green)" }}>.</span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  );
}
