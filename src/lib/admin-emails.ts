/**
 * L'équipe Bio-Lien : les adresses listées dans `ADMIN_EMAILS` (séparées par
 * des virgules). Pas de rôle en base pour l'instant — une seule personne
 * exécute les reversements. Module sans dépendance serveur, importable
 * partout (e-mails, tests).
 */

export type AdminEnv = Partial<Record<"ADMIN_EMAILS", string | undefined>>;

export function adminEmails(env: AdminEnv = process.env as AdminEnv): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function isAdminEmail(
  email: string | null | undefined,
  env: AdminEnv = process.env as AdminEnv,
): boolean {
  return !!email && adminEmails(env).includes(email.toLowerCase());
}
