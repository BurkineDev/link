"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { browserDraftStorage, clearAllDrafts } from "@/lib/onboarding/draft";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    // Un brouillon d'onboarding (nom, numéro WhatsApp) n'a rien à faire
    // dans le navigateur d'un téléphone partagé une fois le vendeur parti.
    clearAllDrafts(browserDraftStorage());
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 w-full"
    >
      <LogOutIcon className="size-4" />
      Déconnexion
    </button>
  );
}
