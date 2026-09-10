"use client";

/**
 * Les sections de l'accueil dessinées d'après la maquette de septembre 2026 :
 * héros clair fondu dans la photo de la créatrice, bandeau de six fonctions,
 * vitrine téléphone, bande « Crée. Partage. Monétise. Grandis. », exemples de
 * pages et bandeau final violet.
 *
 * Tout ce qui ressemble à une preuve sociale est vrai ou clairement présenté
 * comme un exemple : la base démarre à zéro, on ne prête pas de clients à la
 * plateforme.
 */

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MessageCircle,
  Music2,
  Store,
  type LucideIcon,
} from "lucide-react";
// lucide-react ne fournit plus les logos de marques : deux tracés maison.
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M23 12s0-3.5-.45-5.2a2.7 2.7 0 0 0-1.9-1.9C18.95 4.5 12 4.5 12 4.5s-6.95 0-8.65.4a2.7 2.7 0 0 0-1.9 1.9C1 8.5 1 12 1 12s0 3.5.45 5.2a2.7 2.7 0 0 0 1.9 1.9c1.7.4 8.65.4 8.65.4s6.95 0 8.65-.4a2.7 2.7 0 0 0 1.9-1.9C23 15.5 23 12 23 12Zm-13.2 3.2V8.8L15.5 12l-5.7 3.2Z" />
    </svg>
  );
}
type IconLike = LucideIcon | typeof InstagramIcon;

import { ClaimField } from "@/components/home/claim-field";

// ---------------------------------------------------------------------------
// Petits éléments partagés
// ---------------------------------------------------------------------------

/** Accroche manuscrite soulignée d'un trait citron, comme sur la maquette. */
export function Handwritten({
  children,
  className = "",
  dark = false,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`relative inline-block font-[family-name:var(--font-hand)] text-[clamp(26px,3vw,36px)] font-bold leading-[1.05] ${className}`}
      style={{ color: dark ? "var(--b-on-dark)" : "var(--b-ink)" }}
    >
      {children}
      <Image
        src="/brand/deco/underline.svg"
        alt=""
        width={400}
        height={110}
        unoptimized
        className="absolute -bottom-4 left-1 h-auto w-[70%]"
      />
    </span>
  );
}

function CtaButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-[var(--r-full)] px-7 py-4 text-[16px] font-bold no-underline transition-colors hover:bg-[var(--b-lime-deep)] ${className}`}
      style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
    >
      {children}
      <ArrowRight className="size-[18px]" aria-hidden />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Héros
// ---------------------------------------------------------------------------

const HERO_LINKS: { label: string; Icon: IconLike; color: string; bg: string }[] = [
  { label: "Instagram", Icon: InstagramIcon, color: "#E1306C", bg: "#FDE7EF" },
  { label: "TikTok", Icon: Music2, color: "#151020", bg: "#ECEAF1" },
  { label: "YouTube", Icon: YoutubeIcon, color: "#FF0000", bg: "#FFE5E5" },
  { label: "Boutique", Icon: Store, color: "#3F8F00", bg: "#EAF7D9" },
  { label: "Réservation", Icon: CalendarDays, color: "#3F8F00", bg: "#EAF7D9" },
  { label: "Contact", Icon: MessageCircle, color: "#25D366", bg: "#E3F8EA" },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-14">
        <div className="grid items-center gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-24 lg:pt-10">
          {/* Colonne texte */}
          <div className="relative z-10 text-center lg:text-left">
            <h1
              className="text-[clamp(38px,5.2vw,64px)] font-bold leading-[1.04] tracking-[-0.035em]"
              style={{ color: "var(--b-ink)", textWrap: "balance" }}
            >
              Un lien en bio,
              <br />
              toutes vos{" "}
              <span style={{ color: "var(--b-violet)" }}>possibilités.</span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-[1.6] lg:mx-0"
              style={{ color: "var(--b-muted)" }}
            >
              Regroupez vos liens, vendez vos produits, recevez vos paiements
              Mobile Money et développez votre audience — le tout sur une seule
              page, à votre image.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 lg:items-start">
              <CtaButton href="/register">Créer ma page gratuitement</CtaButton>
              <p className="text-[13.5px]" style={{ color: "var(--b-faint)" }}>
                Gratuit pour toujours · sans carte bancaire · en ligne en 3 minutes
              </p>
            </div>

            <div className="mt-10 hidden justify-center lg:flex lg:justify-start lg:pl-40">
              <Handwritten className="-rotate-6">
                Plus qu&apos;un lien,
                <br />
                une histoire
              </Handwritten>
            </div>
          </div>

          {/* Colonne visuelle : photo, cartes de liens, carte de commande */}
          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] sm:aspect-[5/4]">
              <Image
                src="/brand/hero.webp"
                alt="Une créatrice consulte sa page Bio-Lien sur son téléphone"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover object-[68%_center]"
              />
              {/* Fondu vers le fond clair, côté texte. */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, var(--b-paper) 0%, rgba(255,255,255,0.55) 22%, rgba(255,255,255,0) 48%)",
                }}
              />
            </div>

            {/* Cartes de liens flottantes */}
            <ul className="absolute left-3 top-6 flex w-[46%] max-w-[210px] flex-col gap-2.5 sm:left-5 sm:top-8">
              {HERO_LINKS.map(({ label, Icon, color, bg }, i) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[13px] font-semibold shadow-[0_10px_30px_-12px_rgba(21,16,32,0.35)]"
                  style={{
                    background: "var(--b-paper)",
                    color: "var(--b-ink)",
                    transform: `translateX(${i % 2 === 0 ? 0 : 6}px)`,
                  }}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-[8px]"
                    style={{ background: bg, color }}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            {/* Carte statistiques du pack (barres + flèche), titre posé en HTML */}
            <div className="absolute -bottom-4 right-3 hidden w-[200px] sm:right-5 sm:block sm:w-[220px]">
              <Image src="/brand/cards/stats.png" alt="" width={720} height={540} className="h-auto w-full drop-shadow-[0_18px_30px_rgba(21,16,32,0.25)]" />
              <div className="absolute left-[9%] top-[12%]">
                <p className="text-[11px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--b-faint)" }}>
                  Statistiques
                </p>
                <p className="mt-0.5 text-[15px] font-bold leading-tight" style={{ color: "var(--b-ink)" }}>
                  Visites, clics,
                  <br />
                  commandes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bandeau des six fonctions
// ---------------------------------------------------------------------------

const STRIP: { title: string; sub: string; icon: string }[] = [
  { title: "Un seul lien", sub: "Tous vos contenus", icon: "01-un-seul-lien" },
  { title: "Mobile Money", sub: "Paiements intégrés", icon: "02-mobile-money" },
  { title: "Boutique en ligne", sub: "Vendez facilement", icon: "03-boutique" },
  { title: "Pages personnalisées", sub: "À votre image", icon: "04-personnalisation" },
  { title: "Statistiques", sub: "Suivez vos performances", icon: "05-statistiques" },
  { title: "Sans carte bancaire", sub: "100 % accessible", icon: "06-carte-bancaire" },
];

export function FeatureStrip() {
  return (
    <section
      aria-label="Ce que Bio-Lien réunit"
      className="border-y"
      style={{ background: "var(--b-paper)", borderColor: "var(--b-line-soft)" }}
    >
      <ul className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-8 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:grid-cols-6 lg:px-14">
        {STRIP.map(({ title, sub, icon }) => (
          <li key={title} className="flex flex-col items-center text-center">
            <Image
              src={`/brand/icons/${icon}.svg`}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="size-16"
            />
            <p className="mt-3 text-[14.5px] font-bold" style={{ color: "var(--b-ink)" }}>
              {title}
            </p>
            <p className="text-[13px]" style={{ color: "var(--b-muted)" }}>
              {sub}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Vitrine : la page telle qu'elle apparaît sur un téléphone
// ---------------------------------------------------------------------------

export function Showcase() {
  return (
    <section id="vitrine" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="text-center lg:text-left">
          <p className="text-[12.5px] font-semibold uppercase tracking-[.12em]" style={{ color: "var(--b-faint)" }}>
            Pour les créateurs, entrepreneurs et marques
          </p>
          <h2
            className="mt-4 text-[clamp(32px,4.4vw,52px)] font-bold leading-[1.05] tracking-[-0.03em]"
            style={{ color: "var(--b-ink)", textWrap: "balance" }}
          >
            Tout ce dont vous avez besoin, en{" "}
            <span style={{ color: "var(--b-violet)" }}>un seul lien.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-[1.6] lg:mx-0" style={{ color: "var(--b-muted)" }}>
            Bio-Lien vous aide à centraliser vos liens, mettre en avant vos
            contenus, vendre vos produits et recevoir des paiements partout en
            Afrique.
          </p>
          <div className="mt-8 flex justify-center lg:justify-start">
            <CtaButton href="#fonctions">Découvrir toutes les fonctionnalités</CtaButton>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[600px] py-6 lg:py-10">
          <Image
            src="/brand/phones-duo.webp"
            alt="Une page Bio-Lien affichée sur un téléphone"
            width={900}
            height={970}
            sizes="(min-width: 1024px) 600px, 100vw"
            className="mx-auto h-auto w-[88%] max-w-[520px]"
          />

          {/* Carte personnalisation : visuel du pack, titre en HTML */}
          <div className="absolute -top-2 right-0 w-[230px] sm:right-2 sm:w-[260px]">
            <Image src="/brand/cards/perso.png" alt="" width={720} height={333} className="h-auto w-full drop-shadow-[0_18px_30px_rgba(21,16,32,0.22)]" />
            <p className="absolute left-[27%] top-[16%] text-[13px] font-bold leading-tight sm:text-[14px]" style={{ color: "var(--b-ink)" }}>
              Personnalise ta page
              <span className="block text-[11.5px] font-medium sm:text-[12px]" style={{ color: "var(--b-muted)" }}>
                comme tu l&apos;imagines
              </span>
            </p>
          </div>

          {/* Carte Mobile Money : visuel du pack, titre et opérateurs en HTML */}
          <div className="absolute -bottom-2 right-0 w-[240px] sm:right-2 sm:w-[270px]">
            <Image src="/brand/cards/momo.png" alt="" width={720} height={333} className="h-auto w-full drop-shadow-[0_18px_30px_rgba(21,16,32,0.22)]" />
            <p className="absolute left-[27%] top-[15%] text-[13px] font-bold leading-tight sm:text-[14px]" style={{ color: "var(--b-ink)" }}>
              Reçois tes paiements
              <span className="block text-[11.5px] font-medium sm:text-[12px]" style={{ color: "var(--b-muted)" }}>
                partout en Afrique
              </span>
            </p>
            <ul className="absolute inset-x-[7%] bottom-[14%] grid grid-cols-4 gap-[4%] text-center text-[9.5px] font-bold leading-none text-white sm:text-[10.5px]">
              {["Orange", "Wave", "MTN", "M-Pesa"].map((o) => (
                <li key={o} className="flex h-[26px] items-center justify-center sm:h-[30px]">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// « Crée. Partage. Monétise. Grandis. » + trois faits vrais + citation
// ---------------------------------------------------------------------------

export function Momentum({ facts }: { facts: { value: string; label: string }[] }) {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8 lg:px-14">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr_0.9fr]">
        <div className="relative min-h-[300px] overflow-hidden rounded-[26px]">
          <Image
            src="/brand/portrait.webp"
            alt="Un créateur sourit en consultant son téléphone"
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-cover object-[40%_center]"
          />
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(7,19,10,0.05), rgba(7,19,10,0.6))" }} />
          <p
            className="absolute right-6 top-1/2 -translate-y-1/2 text-right font-[family-name:var(--font-hand)] text-[34px] font-bold leading-[1.05]"
            style={{ color: "var(--b-on-dark)" }}
          >
            Crée.
            <br />
            Partage.
            <br />
            Monétise.
            <br />
            <span className="relative inline-block">
              Grandis.
              <svg aria-hidden viewBox="0 0 200 14" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none">
                <path d="M4 10 C 60 2, 130 2, 196 6" fill="none" stroke="var(--b-lime)" strokeWidth="7" strokeLinecap="round" />
              </svg>
            </span>
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-3 rounded-[26px] p-6 sm:p-8" style={{ background: "var(--b-paper)", border: "1px solid var(--b-line-soft)" }}>
          {facts.map(({ value, label }) => (
            <li key={label} className="flex flex-col items-center justify-center text-center">
              <p className="text-[clamp(26px,3vw,40px)] font-extrabold tracking-[-0.03em]" style={{ color: "var(--b-violet)" }}>
                {value}
              </p>
              <p className="mt-1 text-[13.5px] leading-tight" style={{ color: "var(--b-muted)" }}>
                {label}
              </p>
            </li>
          ))}
        </ul>

        <blockquote
          className="flex items-center rounded-[26px] p-7 font-[family-name:var(--font-hand)] text-[28px] font-bold leading-[1.15]"
          style={{ background: "var(--b-paper)", border: "1px solid var(--b-line-soft)", color: "var(--b-ink)" }}
        >
          « Une plateforme africaine, pensée pour les créateurs d&apos;ici et d&apos;ailleurs. »
        </blockquote>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Exemples de pages (présentés comme tels, pas comme des clients)
// ---------------------------------------------------------------------------

const EXAMPLES = [
  { handle: "aissatou.art", role: "Artiste", photo: "artiste" },
  { handle: "chefboubacar", role: "Chef cuisinier", photo: "chef" },
  { handle: "tech237", role: "Créateur tech", photo: "tech" },
  { handle: "style_amina", role: "Mode & beauté", photo: "mode" },
];

export function Examples() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8 lg:px-14">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-[clamp(26px,3vw,34px)] font-bold tracking-[-0.02em]" style={{ color: "var(--b-ink)" }}>
            Des pages pour tous les métiers
          </h2>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--b-muted)" }}>
            Quatre exemples de pages, un métier chacun. La tienne prend la palette que tu choisis.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EXAMPLES.map(({ handle, role, photo }) => (
              <li key={handle} className="overflow-hidden rounded-[16px]" style={{ background: "var(--b-paper)", border: "1px solid var(--b-line-soft)" }}>
                <div className="relative aspect-square">
                  <Image src={`/brand/creators/${photo}.webp`} alt={`Exemple de page : ${role}`} fill sizes="(min-width: 640px) 160px, 45vw" className="object-cover" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[13px] font-bold" style={{ color: "var(--b-ink)" }}>
                    @{handle}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--b-muted)" }}>
                    {role}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--r-full)] px-5 py-3 text-[14.5px] font-semibold no-underline transition-colors hover:bg-[var(--b-wash)]"
            style={{ border: "1px solid var(--b-line)", color: "var(--b-ink)" }}
          >
            Voir les boutiques en ligne
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {/* Scène « Votre univers » du pack, slogan manuscrit posé sur les panneaux lavande */}
        <div className="relative overflow-hidden rounded-[26px]">
          <Image
            src="/brand/univers.webp"
            alt="Un téléphone posé sur un bureau affiche une page Bio-Lien"
            width={1600}
            height={800}
            sizes="(min-width: 1024px) 620px, 100vw"
            className="h-auto w-full"
          />
          <div className="absolute left-[7%] top-[14%]">
            <Handwritten className="-rotate-6 text-[clamp(24px,3.2vw,40px)]">
              Votre univers.
              <br />
              Votre page.
              <br />
              Vos règles.
            </Handwritten>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bandeau final violet
// ---------------------------------------------------------------------------

export function FinalBand() {
  return (
    <section
      className="relative isolate overflow-hidden"
      style={{
        background: "url(/brand/deco/footer.svg) center / cover no-repeat, var(--b-violet-deep)",
      }}
    >
      <Image src="/brand/deco/chain.svg" alt="" width={120} height={120} unoptimized className="absolute -left-8 top-1/2 size-[240px] -translate-y-1/2 opacity-25" />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-14 lg:py-20">
        <div className="text-center lg:text-left">
          <h2 className="text-[clamp(30px,4vw,48px)] font-bold leading-[1.05] tracking-[-0.03em]" style={{ color: "var(--b-on-dark)" }}>
            Prêt à créer votre page ?
          </h2>
          <p className="mt-3 text-[16px]" style={{ color: "var(--b-violet-mid)" }}>
            C&apos;est gratuit, rapide et sans carte bancaire.
          </p>
          <div className="lg:[&>form]:mx-0 lg:[&>form]:justify-start">
            <ClaimField dark id="claim-final" />
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Handwritten dark className="rotate-[-5deg] text-right">
            Les créateurs
            <br />
            d&apos;aujourd&apos;hui
            <br />
            bâtissent demain
          </Handwritten>
        </div>
      </div>
    </section>
  );
}
