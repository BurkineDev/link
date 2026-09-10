/**
 * Le pictogramme Bio-Lien : deux maillons entrelacés, dans le citron des boutons
 * (`--b-lime`), d'après la planche de marque de septembre 2026.
 *
 * Dessiné en SVG pour rester net du favicon 16 px au héros de l'accueil.
 * `tone="brand"` applique le dégradé ; `tone="mono"` prend la couleur du texte
 * courant (version monochrome de la planche) ; `tone="white"` sert sur les
 * fonds verts, comme l'icône d'application.
 */

const A = { x: 9.58, y: 28.92, cx: 24.58, cy: 39.42 };
const B = { x: 24.42, y: 14.08, cx: 39.42, cy: 24.58 };

function Link({ l, stroke }: { l: typeof A; stroke: string }) {
  return (
    <rect
      x={l.x}
      y={l.y}
      width="30"
      height="21"
      rx="10.5"
      transform={`rotate(-45 ${l.cx} ${l.cy})`}
      stroke={stroke}
      strokeWidth="8"
    />
  );
}

export function LogoMark({
  className,
  tone = "brand",
  title = "Bio-Lien",
}: {
  className?: string;
  tone?: "brand" | "mono" | "white";
  title?: string;
}) {
  const stroke =
    tone === "brand"
      ? "url(#biolien-mark-gradient)"
      : tone === "white"
        ? "#FFFFFF"
        : "currentColor";

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      <defs>
        {tone === "brand" && (
          <linearGradient
            id="biolien-mark-gradient"
            x1="6"
            y1="58"
            x2="58"
            y2="6"
            gradientUnits="userSpaceOnUse"
          >
            {/* Même citron que les boutons (--b-lime), assombri vers le bas pour le relief. */}
            <stop offset="0" stopColor="var(--b-green-bright, #a4d62a)" />
            <stop offset="0.45" stopColor="var(--b-lime-deep, #cbeb43)" />
            <stop offset="1" stopColor="var(--b-lime, #d9f55c)" />
          </linearGradient>
        )}
        {/* Aux deux croisements opposés, le maillon B repasse devant A. */}
        <clipPath id="biolien-mark-over">
          <circle cx="28.82" cy="20.34" r="6.4" />
          <circle cx="35.18" cy="43.66" r="6.4" />
        </clipPath>
      </defs>
      <Link l={B} stroke={stroke} />
      <Link l={A} stroke={stroke} />
      <g clipPath="url(#biolien-mark-over)">
        <Link l={B} stroke={stroke} />
      </g>
    </svg>
  );
}
