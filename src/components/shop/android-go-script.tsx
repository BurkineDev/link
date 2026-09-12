/**
 * Script inline de la BioPage, exécuté dès l'analyse du HTML, bien avant
 * que React (≈250 Ko) ne soit chargé sur un téléphone d'entrée de gamme.
 *
 * Sur Android, un tap sur un lien portant `data-go` est envoyé vers la
 * route serveur `/go/<id>` tant que la page n'est pas hydratée : le serveur
 * répond par le lien intent:// qui ouvre l'app (ou retombe sur le web).
 * Dès que React a pris la main (`data-hydrated` posé par SmartAppLink),
 * le script s'efface : c'est le composant qui intercepte.
 *
 * Jamais sur iOS : l'ancre directe est le seul déclencheur des Universal
 * Links. Jamais sur Opera Mini (rendu distant, pas d'intent possible).
 */

const SCRIPT =
  '(function(){var u=navigator.userAgent||"";if(!/Android/i.test(u)||/Opera Mini/i.test(u))return;' +
  'document.addEventListener("click",function(e){' +
  'if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;' +
  'var t=e.target;var a=t&&t.closest?t.closest("a[data-go]"):null;' +
  'if(!a||document.documentElement.hasAttribute("data-hydrated"))return;' +
  'e.preventDefault();location.assign(a.getAttribute("data-go"))},true)})();';

export function AndroidGoScript() {
  // Pas de nonce ni de CSP sur les pages : le script est une constante sans
  // donnée injectée.
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

/** Exporté pour les tests : le script ne doit contenir aucune donnée dynamique. */
export const ANDROID_GO_SCRIPT = SCRIPT;
