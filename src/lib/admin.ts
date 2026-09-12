import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "@/lib/auth";

/**
 * L'équipe Bio-Lien : les adresses listées dans `ADMIN_EMAILS` (séparées par
 * des virgules). Pas de rôle en base pour l'instant — une seule personne
 * exécute les reversements.
 */
export type AdminEnv = Partial<Record<"ADMIN_EMAILS", string | undefined>>;

export function adminEmails(env: AdminEnv = process.env as AdminEnv): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function isAdminEmail(email: string | null | undefined, env: AdminEnv = process.env as AdminEnv): boolean {
  return !!email && adminEmails(env).includes(email.toLowerCase());
}

/** Page serveur : renvoie vers le tableau de bord si l'utilisateur n'est pas de l'équipe. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

/** Route API : null si non connecté ou pas de l'équipe. */
export async function getAdminUser() {
  const user = await getCurrentUser();
  return user && isAdminEmail(user.email) ? user : null;
}
