"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
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
