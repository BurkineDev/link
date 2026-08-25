import type { Metadata } from "next";
import Link from "next/link";
import { BrandBackdrop, Wordmark } from "@/components/brand/brand-shell";

export const metadata: Metadata = {
  title: {
    template: "%s | Bio-Lien",
    default: "Authentification | Bio-Lien",
  },
  description:
    "Créez votre page Bio-Lien en quelques minutes : vos liens, votre boutique et vos paiements Mobile Money sur une seule adresse.",
};

/**
 * Coquille des écrans d'authentification — maquette « Connexion ».
 *
 * L'ancienne version posait un grand panneau de marque à gauche, qui portait
 * « +12 000 boutiques actives dans 15 pays africains ». Ce nombre n'existe
 * pas. Il était affiché juste à côté du formulaire d'inscription, c'est-à-dire
 * au moment précis où quelqu'un décide s'il nous fait confiance. Retiré avec
 * le panneau ; la maquette ne le prévoyait pas non plus.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10 font-[family-name:var(--font-brand)]"
      style={{ background: "var(--b-canvas)", color: "var(--b-ink)" }}
    >
      <BrandBackdrop />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-7">
          <Wordmark />
        </div>

        <div
          className="w-full max-w-[420px] rounded-[var(--r-xl)] p-7 sm:p-10"
          style={{
            background: "var(--b-paper)",
            border: "1px solid var(--b-line)",
            boxShadow: "var(--sh-3)",
          }}
        >
          {children}
        </div>

        <footer
          className="mt-6 text-center text-[13px]"
          style={{ color: "var(--b-muted)" }}
        >
          <Link
            href="/legal/privacy"
            className="no-underline hover:underline"
            style={{ color: "inherit" }}
          >
            Confidentialité
          </Link>{" "}
          ·{" "}
          <Link
            href="/legal/terms"
            className="no-underline hover:underline"
            style={{ color: "inherit" }}
          >
            Conditions
          </Link>
        </footer>
      </div>
    </div>
  );
}
