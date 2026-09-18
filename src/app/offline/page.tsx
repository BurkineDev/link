import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false },
};

/**
 * La page que le service worker montre quand une navigation n'a pas de
 * réseau. Elle ne dépend de rien (pas d'image, pas de police à charger)
 * pour s'afficher depuis le cache.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        📶
      </p>
      <h1 className="mt-4 text-2xl font-bold">Pas de réseau pour l&apos;instant</h1>
      <p className="mt-2 text-muted-foreground">
        Ta page et tes commandes n&apos;ont pas bougé. Dès que la connexion revient, recharge — ou reviens plus tard.
      </p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 font-semibold text-background">
        Réessayer
      </Link>
    </main>
  );
}
