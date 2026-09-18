import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  bioAvatarInitialsStyle,
  bioButtonStyle,
  bioThemeCssVars,
  resolveBioTheme,
  type BioPalette,
  type BioThemeId,
} from "@/lib/bio-themes";

/**
 * Miniature d'un thème de page bio, partagée par les réglages et
 * l'onboarding : le fond, le ruban de tête (bande à motif pour Wax et Pagne
 * tissé, lavis pour Bogolan et Indigo), l'avatar avec son anneau, deux
 * barres de bouton peintes par bioButtonStyle(), puis — seulement avec un
 * décor — le trait de couture et le point de rehaut (la pastille prix).
 *
 * Une seule miniature pour les deux sélecteurs : quand ils divergeaient,
 * le vendeur voyait deux thèmes différents sous le même nom. Le ruban
 * réutilise les utilitaires .bio-wash / .bio-band de globals.css, qui ne
 * lisent que les variables --bio-* posées ici : les mêmes règles que la
 * page, à l'échelle d'une vignette. Sans décor, la vignette est celle des
 * dix thèmes historiques : fond, pastille, trait d'accent, deux barres.
 *
 * Pas de hook : rendable côté serveur comme dans une liste de 14 cartes.
 */

interface BioThemeSwatchProps {
  themeId: BioThemeId;
  /** Couleurs de la boutique, pour que « Mes couleurs » montre les siennes. */
  primaryColor: string;
  accentColor: string;
  className?: string;
}

/**
 * Hauteur du ruban en part de la vignette. La bande est basse pour que
 * l'avatar chevauche sa lisière comme sur la page ; le lavis descend plus
 * bas puisqu'il se fond avant les boutons.
 */
const RIBBON_HEIGHT: Record<"wash" | "band", string> = {
  wash: "58%",
  band: "30%",
};

function ribbonClass(palette: BioPalette): string | null {
  const header = palette.decor?.header;
  if (!header) return null;
  if (header.kind === "wash") return "bio-wash";
  return cn(
    "bio-band",
    header.edge === "scallop" && "bio-band-scallop",
    header.edge === "selvedge" && "bio-band-selvedge",
  );
}

export function BioThemeSwatch({
  themeId,
  primaryColor,
  accentColor,
  className,
}: BioThemeSwatchProps) {
  const palette = resolveBioTheme({
    bio_theme: themeId,
    theme_color: primaryColor,
    accent_color: accentColor,
  });
  const decor = palette.decor;
  const header = decor?.header;

  // Une lisière (inset 5 px à gauche) n'a de sens que sur un bord droit :
  // les barres deviennent des bandes pour ce thème, des pilules sinon.
  const pill = !decor?.selvedge;
  const barShape = pill ? "rounded-full" : "rounded-[3px]";
  const bar: CSSProperties = { ...bioButtonStyle(palette, { pill }) };
  // Un flou sur une barre de 14 px ne montre rien et coûte une couche de
  // composition par carte : la vignette s'en passe (seul Minuit en a un).
  delete bar.backdropFilter;
  // Les boutons pleins n'ont pas de filet sur la page (« 1px solid
  // transparent ») ; sur une vignette de 14 px, une barre Noir se fondrait
  // dans le fond. La vignette garde le filet `border` que les anciennes
  // miniatures peignaient sur toutes les barres.
  if (typeof bar.border === "string" && bar.border.endsWith("transparent")) {
    bar.border = `1px solid ${palette.border}`;
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden",
        decor ? "p-2" : "p-3",
        className,
      )}
      style={
        {
          background: palette.background,
          ...bioThemeCssVars(palette),
        } as CSSProperties
      }
    >
      {header && (
        <>
          <span
            aria-hidden
            className={ribbonClass(palette) ?? undefined}
            style={{ height: RIBBON_HEIGHT[header.kind] }}
          />
          {header.kind === "wash" && (
            <span
              aria-hidden
              className="bio-wash-fade"
              style={
                {
                  height: RIBBON_HEIGHT.wash,
                  ...(header.fade !== undefined
                    ? { "--bio-wash-fade": `${header.fade}%` }
                    : {}),
                } as CSSProperties
              }
            />
          )}
        </>
      )}

      {/* L'avatar : le disque d'initiales de la page, anneau compris. */}
      <span
        className="relative size-5 shrink-0 rounded-full"
        style={bioAvatarInitialsStyle(palette)}
      />
      <span
        className="relative h-1 w-8 shrink-0 rounded-full"
        style={{ backgroundColor: palette.accent }}
      />
      <span className={cn("relative h-3.5 w-full shrink-0", barShape)} style={bar} />
      <span className={cn("relative h-3.5 w-full shrink-0", barShape)} style={bar} />

      {decor && (
        <span className="relative flex w-full shrink-0 items-center gap-1.5">
          {/* Le trait de couture, en pointillé de la couleur du filet. */}
          <span
            aria-hidden
            className="h-0 flex-1"
            style={{ borderTop: `1px dashed ${palette.border}` }}
          />
          {/* Le point de rehaut : la couleur de la pastille prix. */}
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: decor.highlight?.bg ?? palette.accent,
              border: `1px solid ${decor.highlight?.text ?? palette.text}`,
            }}
          />
        </span>
      )}
    </div>
  );
}
