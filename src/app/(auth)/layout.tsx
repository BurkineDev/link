import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ShoppingBag, BarChart3, Zap, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s | LinkBoutik",
    default: "Authentification | LinkBoutik",
  },
  description:
    "Créez votre boutique en ligne africaine en quelques minutes. Vendez partout, encaissez facilement.",
};

const features = [
  {
    icon: ShoppingBag,
    title: "Boutique en ligne en 5 minutes",
    description: "Créez votre vitrine professionnelle sans compétences techniques.",
  },
  {
    icon: BarChart3,
    title: "Tableau de bord complet",
    description: "Suivez vos ventes, stocks et clients en temps réel.",
  },
  {
    icon: Zap,
    title: "Optimisé pour le mobile",
    description: "Gérez votre boutique depuis votre téléphone, même en 3G.",
  },
  {
    icon: Globe,
    title: "Paiements locaux intégrés",
    description: "Mobile Money, Orange Money, Wave et plus encore.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel – brand / marketing (hidden on mobile) ── */}
      <aside className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col justify-between p-10 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, oklch(0.62 0.24 22) 0%, oklch(0.68 0.22 35) 40%, oklch(0.72 0.18 85) 100%)",
          }}
        />

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 bg-white/30" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full opacity-10 bg-white/40" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-10 bg-white/20 -translate-y-1/2" />

        {/* Kente-inspired pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.8) 10px,
              rgba(255,255,255,0.8) 11px
            ), repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.8) 10px,
              rgba(255,255,255,0.8) 11px
            )`,
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 transition-transform group-hover:scale-105">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              Link<span className="text-white/80">Boutik</span>
              <span className="ml-1.5 text-xs font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-md leading-none align-middle border border-white/30">
                AF
              </span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight">
              Vendez plus,
              <br />
              <span className="text-white/80">partout en Afrique.</span>
            </h1>
            <p className="text-lg text-white/70 max-w-sm leading-relaxed">
              La plateforme e-commerce pensée pour les entrepreneurs africains. Simple, rapide, et
              adapté à votre réalité.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{feature.title}</p>
                    <p className="text-white/60 text-xs mt-0.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="flex -space-x-2">
              {["🇸🇳", "🇨🇮", "🇨🇲", "🇬🇭"].map((flag, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-sm"
                >
                  {flag}
                </div>
              ))}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">+12 000 boutiques actives</p>
              <p className="text-white/60 text-xs">dans 15 pays africains</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right panel – form area ── */}
      <main className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Mobile logo (visible only on small screens) */}
        <div className="lg:hidden flex items-center justify-between px-5 pt-5 pb-2">
          <Logo size="md" />
        </div>

        {/* Form wrapper — vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <footer className="text-center text-xs text-muted-foreground pb-6 px-5">
          © {new Date().getFullYear()} LinkBoutik.{" "}
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
            Confidentialité
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
            CGU
          </Link>
        </footer>
      </main>
    </div>
  );
}
