"use client";

import { useCallback } from "react";
import { authClient, useSession } from "@/lib/auth-client";

/**
 * État de session côté client, sur le modèle de l'ancien hook Supabase :
 * `user`, `session`, `loading`, `signOut`. Better Auth tient la session à
 * jour tout seul (cache de cookie + revalidation), il n'y a plus
 * d'abonnement à gérer.
 */
export function useAuth() {
  const { data, isPending } = useSession();

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    loading: isPending,
    signOut,
  };
}
