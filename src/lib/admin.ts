import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-emails";

export { adminEmails, isAdminEmail } from "@/lib/admin-emails";

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
