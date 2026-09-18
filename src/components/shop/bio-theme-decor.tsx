import type { CSSProperties } from "react";
import type { BioPalette } from "@/lib/bio-themes";
import { cn } from "@/lib/utils";

/**
 * Décor des thèmes « Afrique de l'Ouest » — la zone haute et la couture.
 *
 * Deux composants sans état ni hook, rendables côté serveur comme dans les
 * aperçus du tableau de bord : ils ne lisent que la palette et les variables
 * `--bio-*` posées sur la racine par bioThemeCssVars(). Les couleurs, la
 * tuile et son opacité viennent de ces variables via les utilitaires
 * .bio-wash / .bio-band / .bio-frieze… de globals.css ; ici on ne décide que
 * de la présence et de la hauteur. Sans `decor`, les deux ne rendent rien :
 * les dix thèmes historiques restent intacts.
 */

interface BioHeaderDecorProps {
  palette: BioPalette;
  /** Une bannière occupe la même zone : le lavis ou la bande s'effacent. */
  hasBanner: boolean;
}

/**
 * Zone haute sans bannière : un lavis (tuile fondue vers le fond, deux div
 * pour éviter mask-image, absent des stories) ou une bande pleine à motif
 * fermée par sa lisière. À poser en premier enfant de la racine `relative`.
 */
export function BioHeaderDecor({ palette, hasBanner }: BioHeaderDecorProps) {
  const header = palette.decor?.header;
  if (!header || hasBanner) return null;

  if (header.kind === "wash") {
    // Le début du fondu est une variable pour que le CSS reste sans chiffre
    // de thème ; absente, .bio-wash-fade retombe sur ses 35 %.
    const fadeStyle = {
      height: header.height,
      ...(header.fade !== undefined
        ? { "--bio-wash-fade": `${header.fade}%` }
        : {}),
    } as CSSProperties;
    return (
      <>
        <div aria-hidden className="bio-wash" style={{ height: header.height }} />
        <div aria-hidden className="bio-wash-fade" style={fadeStyle} />
      </>
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "bio-band",
        header.edge === "scallop" && "bio-band-scallop",
        header.edge === "selvedge" && "bio-band-selvedge",
      )}
      style={{ height: header.height }}
    />
  );
}

const DIVIDER_CLASS: Record<
  NonNullable<NonNullable<BioPalette["decor"]>["divider"]>,
  string
> = {
  // La frise court sur toute la largeur de la colonne, d'où le débord.
  frieze: "bio-frieze -mx-4",
  dots: "bio-dots",
  toron: "bio-toron",
  stitch: "bio-stitch",
};

interface BioDividerProps {
  palette: BioPalette;
  className?: string;
}

/**
 * La couture entre les réseaux et les onglets : frise bogolan, rangée de
 * points, rangée de toron ou point de piqûre. Rendue même sans réseaux —
 * c'est ce qui distingue un thème à décor de son voisin.
 */
export function BioDivider({ palette, className }: BioDividerProps) {
  const divider = palette.decor?.divider;
  if (!divider) return null;
  return <div aria-hidden className={cn(DIVIDER_CLASS[divider], className)} />;
}
