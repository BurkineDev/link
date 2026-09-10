"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * Client Better Auth pour les composants navigateur.
 *
 * `inferAdditionalFields` reprend les champs déclarés côté serveur
 * (`username`, `referredBy`) pour que `signUp.email` les accepte et les
 * type ; l'import de `auth` est purement de type, rien du serveur ne finit
 * dans le bundle client.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
