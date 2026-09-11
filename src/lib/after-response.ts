import { after } from "next/server";

/**
 * Exécute un effet de bord (e-mail, WhatsApp) APRÈS l'envoi de la réponse.
 *
 * Sur Vercel, une promesse simplement détachée peut être gelée dès que la
 * réponse est renvoyée : l'e-mail de confirmation ne part jamais, sans
 * aucune trace. `after()` prolonge l'invocation jusqu'à la fin de la tâche.
 *
 * `after()` exige un contexte de requête (route, page ou action serveur) ;
 * hors de ce contexte — tests Jest, scripts — on exécute la tâche tout de
 * suite, sans bloquer l'appelant, avec la même gestion d'erreur.
 */
export function scheduleAfterResponse(
  task: () => Promise<unknown>,
  onError: (error: unknown) => void,
): void {
  const run = () => task().catch(onError);
  try {
    after(run);
  } catch {
    void run();
  }
}
