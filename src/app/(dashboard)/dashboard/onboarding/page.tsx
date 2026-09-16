import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validations/auth";
import { safeNextPath } from "@/lib/validations/next-path";
import { isOnlineCheckoutEnabled } from "@/lib/payments/online-checkout";
import OnboardingClient from "./onboarding-client";

/**
 * Le serveur connaît déjà le vendeur (le layout vient de vérifier sa
 * session) : il fournit l'identifiant et le profil à l'assistant, qui n'a
 * plus à refaire un aller-retour de session avant d'afficher le premier
 * écran — ni à rester sur un chargeur si cet aller-retour échoue.
 *
 * `?next=` (plan choisi avant l'inscription) est re-validé ici : il a
 * transité par une URL.
 *
 * Le drapeau de la caisse (voir src/lib/payments/online-checkout.ts) est lu
 * ici et passé en prop : masquée, l'assistant ne propose pas le paiement en
 * ligne et exige le numéro WhatsApp.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [user, { next }] = await Promise.all([requireUser(), searchParams]);
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, username: true },
  });
  const username = profile?.username ?? null;

  return (
    <OnboardingClient
      userId={user.id}
      profile={{
        fullName: profile?.fullName?.trim() || user.name?.trim() || null,
        username: username && usernameSchema.safeParse(username).success ? username : null,
      }}
      nextPath={safeNextPath(Array.isArray(next) ? next[0] : next)}
      onlineCheckout={isOnlineCheckoutEnabled()}
    />
  );
}
