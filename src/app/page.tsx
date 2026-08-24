"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Globe,
  Infinity as InfinityIcon,
  Layers,
  Link2,
  Mail,
  Menu,
  MessageCircle,
  MousePointerClick,
  Music2,
  Palette,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Timer,
  Type,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";

// ---------------------------------------------------------------------------
// Page d'accueil
// ---------------------------------------------------------------------------
//
// Un seul système de design, défini dans globals.css : orange en primaire,
// violet en secondaire, encre marine, blanc et brume. Deux accents, une
// échelle de rayons, une famille d'ombres. Rien n'est décidé ici.
//
// Les icônes viennent de lucide-react — un jeu vectoriel MIT déjà installé.
// Plus aucun émoji : un émoji se dessine différemment sur iOS, Android et
// Windows, ne se colore pas, et se voit tout de suite. C'était le premier
// signe que la page n'avait pas été dessinée.
//
// Aucune marque déposée n'est reproduite. Les plateformes sont nommées en
// toutes lettres — c'est l'usage nominatif normal pour un produit dont le
// métier est de pointer vers elles — mais leurs logos ne sont pas redessinés.

const SITE_URL = "https://www.bio-lien.com";

const NAV = [
  { label: "Explorer", href: "/explore" },
  { label: "Outils gratuits", href: "/outils" },
  { label: "Fonctionnalités", href: "#why" },
  { label: "Tarifs", href: "/pricing" },
];

// ---------------------------------------------------------------------------
// Éléments partagés
// ---------------------------------------------------------------------------

/** Le maillon du logotype, dessiné plutôt qu'importé. */
function LinkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 14.5 14.5 9.5M10 6.5 11.8 4.7a4 4 0 1 1 5.6 5.6l-1.8 1.8M14 17.5l-1.8 1.8a4 4 0 0 1-5.6-5.6l1.8-1.8"
        stroke="var(--b-orange)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LinkMark className="size-6" />
      <span
        className="font-extrabold tracking-[-0.03em]"
        style={{ color: dark ? "#fff" : "var(--b-ink)" }}
      >
        bio-lien
      </span>
    </span>
  );
}

/**
 * Masse de couleur floue qui dérive. Le fond « liquide » des sections
 * héroïques : c'est ce qui bouge derrière le verre et le rend vivant.
 */
function Blob({
  color,
  className,
  delay = "0s",
}: {
  color: string;
  className: string;
  delay?: string;
}) {
  return (
    <div
      aria-hidden
      className={`liquid-blob pointer-events-none ${className}`}
      style={{ background: color, animationDelay: delay }}
    />
  );
}

/** Titre de section : sur-titre, titre, chapeau. Toujours la même mécanique. */
function SectionHead({
  eyebrow,
  title,
  lead,
  accent = "var(--b-orange)",
  centered = false,
  dark = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  accent?: string;
  centered?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={centered ? "text-center" : undefined}>
      <p
        className="text-[11px] font-extrabold uppercase tracking-[.22em]"
        style={{ color: accent }}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-4 text-[clamp(30px,5.4vw,52px)] font-extrabold leading-[1.06] tracking-[-0.035em]"
        style={{ color: dark ? "#fff" : "var(--b-ink)", textWrap: "balance" }}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-5 text-[17px] leading-[1.65] ${centered ? "mx-auto" : ""} max-w-[520px]`}
          style={{ color: dark ? "rgba(255,255,255,.62)" : "var(--b-slate)" }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// En-tête
// ---------------------------------------------------------------------------

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="glass sticky top-0 z-50 rounded-none border-x-0 border-t-0"
      style={{ borderBottom: "1px solid var(--b-line)", boxShadow: "none" }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-6 px-6">
        <Link href="/" className="text-[22px]">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-[var(--b-orange)]"
              style={{ color: "var(--b-slate)" }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="px-4 py-2.5 text-sm font-bold"
            style={{ color: "var(--b-ink)" }}
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-5 py-[11px] text-sm font-extrabold text-white transition-colors hover:bg-[var(--b-orange-deep)]"
            style={{ background: "var(--b-orange)" }}
          >
            Créer ma page
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          className="touch-target grid place-items-center rounded-[var(--r-sm)] md:hidden"
          style={{ color: "var(--b-ink)" }}
        >
          {open ? (
            <X className="size-5" aria-hidden />
          ) : (
            <Menu className="size-5" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden"
          style={{
            borderTop: "1px solid var(--b-line)",
            background: "var(--b-paper)",
          }}
        >
          <nav className="flex flex-col gap-1 px-6 py-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold"
                style={{ color: "var(--b-ink)" }}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="py-2.5 text-sm font-bold"
              style={{ color: "var(--b-ink)" }}
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="mt-2 rounded-[var(--r-full)] py-3 text-center text-sm font-extrabold text-white"
              style={{ background: "var(--b-orange)" }}
            >
              Créer ma page
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Héros
// ---------------------------------------------------------------------------

const HERO_PILLS: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: Link2, title: "Centralise", sub: "tous tes liens" },
  { icon: Palette, title: "Personnalise", sub: "à ton image" },
  { icon: BarChart3, title: "Développe", sub: "ton audience" },
];

/**
 * La page de démonstration ne porte le nom de personne. Elle affiche
 * « @toi » : d'abord parce qu'aucun compte inscrit n'a demandé à servir de
 * vitrine, ensuite parce que c'est le message de la page — l'adresse est
 * la tienne.
 */
const PHONE_LINKS: { icon: LucideIcon; label: string; tint?: string }[] = [
  { icon: Globe, label: "Mon site" },
  { icon: ShoppingBag, label: "Ma boutique", tint: "var(--b-orange)" },
  { icon: MessageCircle, label: "WhatsApp", tint: "#25b34b" },
  { icon: Music2, label: "TikTok", tint: "var(--b-ink)" },
  { icon: Camera, label: "Instagram", tint: "#d63a7a" },
  { icon: Mail, label: "Me contacter" },
];

/** Vignette de verre flottante, façon icône d'application. */
function FloatingTile({
  icon: Icon,
  tint,
  className,
  delay,
}: {
  icon: LucideIcon;
  tint: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      aria-hidden
      className={`glass animate-bio-float absolute hidden place-items-center rounded-[28%] lg:grid ${className}`}
      style={{ animationDelay: delay }}
    >
      <Icon className="size-1/2" style={{ color: tint }} strokeWidth={2.2} />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      <div
        className="relative rounded-[42px] border-[10px]"
        style={{
          borderColor: "var(--b-ink)",
          background: "var(--b-paper)",
          boxShadow: "var(--sh-3)",
        }}
      >
        <div
          aria-hidden
          className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-[var(--r-full)]"
          style={{ background: "var(--b-ink)" }}
        />

        <div className="px-4 pb-5 pt-9">
          <div className="mb-4 flex items-center justify-center gap-1.5">
            <LinkMark className="size-4" />
            <span
              className="text-sm font-extrabold tracking-[-0.02em]"
              style={{ color: "var(--b-ink)" }}
            >
              bio-lien
            </span>
          </div>

          <div
            className="mx-auto grid size-[86px] place-items-center rounded-[var(--r-full)]"
            style={{ background: "var(--b-orange-soft)" }}
          >
            <Sparkles
              className="size-9"
              style={{ color: "var(--b-orange)" }}
              strokeWidth={2}
              aria-hidden
            />
          </div>
          <p
            className="mt-3 text-center text-lg font-extrabold"
            style={{ color: "var(--b-ink)" }}
          >
            @toi
          </p>
          <p
            className="mt-1 text-center text-[11.5px] leading-snug"
            style={{ color: "var(--b-slate)" }}
          >
            Ta bio, tes liens, ta boutique.
            <br />
            Une seule adresse à partager.
          </p>

          <div className="mt-4 space-y-2">
            {PHONE_LINKS.map(({ icon: Icon, label, tint }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5"
                style={{
                  background: "var(--b-paper)",
                  border: "1px solid var(--b-line)",
                  boxShadow: "var(--sh-1)",
                }}
              >
                <Icon
                  className="size-[17px] shrink-0"
                  style={{ color: tint ?? "var(--b-slate)" }}
                  strokeWidth={2.2}
                  aria-hidden
                />
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--b-ink)" }}
                >
                  {label}
                </span>
                <ChevronRight
                  className="ml-auto size-3.5 shrink-0"
                  style={{ color: "var(--b-line)" }}
                  aria-hidden
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <FloatingTile
        icon={Camera}
        tint="#d63a7a"
        className="-left-16 top-[34%] size-16"
        delay="0s"
      />
      <FloatingTile
        icon={Link2}
        tint="var(--b-violet)"
        className="-right-14 top-[4%] size-14"
        delay=".8s"
      />
      <FloatingTile
        icon={ShoppingBag}
        tint="var(--b-orange)"
        className="-right-[4.5rem] top-[42%] size-[68px]"
        delay="1.6s"
      />
      <FloatingTile
        icon={MessageCircle}
        tint="#25b34b"
        className="-right-16 bottom-[10%] size-16"
        delay="2.4s"
      />
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden px-6 pb-14 pt-12 sm:pt-16"
      style={{ background: "var(--b-paper)" }}
    >
      {/* Une seule masse, chaude, dans le coin vide à droite. Le violet a été
          retiré d'ici : il bavait derrière le titre et ramenait la troisième
          couleur qu'on venait justement de supprimer. Il reste la couleur du
          copilote et des modèles, plus bas. */}
      <Blob
        color="var(--b-orange)"
        className="-right-32 -top-44 size-[320px] opacity-[.13] sm:-right-56 sm:-top-56 sm:size-[680px] sm:opacity-[.16]"
      />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[1fr_.85fr]">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-[var(--r-full)] px-3.5 py-1.5 text-[12.5px] font-bold"
            style={{
              background: "var(--b-orange-soft)",
              color: "var(--b-orange-deep)",
            }}
          >
            <Sparkles className="size-3.5" aria-hidden strokeWidth={2.4} />
            Bio, liens et boutique au même endroit
          </span>

          <h1
            className="mt-6 text-[clamp(38px,7.2vw,62px)] font-black leading-[1.06] tracking-[-0.038em]"
            style={{ color: "var(--b-ink)", textWrap: "balance" }}
          >
            Tous tes liens,
            <br />
            <span style={{ color: "var(--b-orange)" }}>
              en un seul endroit.
            </span>
          </h1>

          <p
            className="mt-6 max-w-[460px] text-[17px] leading-[1.65]"
            style={{ color: "var(--b-slate)" }}
          >
            Crée ta page, partage tout ce qui compte, vends directement dessus.
            Ton adresse est à toi, et à personne d&apos;autre.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {HERO_PILLS.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-2.5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-[var(--r-full)]"
                  style={{ background: "var(--b-orange-soft)" }}
                >
                  <Icon
                    className="size-[18px]"
                    style={{ color: "var(--b-orange)" }}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
                <span className="text-[13.5px] leading-tight">
                  <span
                    className="block font-extrabold"
                    style={{ color: "var(--b-ink)" }}
                  >
                    {title}
                  </span>
                  <span style={{ color: "var(--b-slate)" }}>{sub}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--b-orange-deep)]"
              style={{
                background: "var(--b-orange)",
                boxShadow: "var(--sh-orange)",
              }}
            >
              Commencer gratuitement
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="#product"
              className="inline-flex items-center justify-center gap-2.5 rounded-[var(--r-sm)] px-6 py-4 text-[15px] font-bold"
              style={{
                background: "var(--b-paper)",
                border: "1px solid var(--b-line)",
                color: "var(--b-ink)",
              }}
            >
              <span
                className="grid size-6 place-items-center rounded-[var(--r-full)]"
                style={{ background: "var(--b-orange)" }}
                aria-hidden
              >
                <Play className="size-2.5 fill-white text-white" />
              </span>
              Voir comment ça marche
            </Link>
          </div>

          <div
            className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[13.5px] font-medium"
            style={{ color: "var(--b-slate)" }}
          >
            {["Gratuit à vie", "Sans carte bancaire", "Prêt en 2 minutes"].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check
                    className="size-4"
                    style={{ color: "var(--b-orange)" }}
                    strokeWidth={3}
                    aria-hidden
                  />
                  {t}
                </span>
              ),
            )}
          </div>
        </div>

        <PhoneMockup />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bandeau de chiffres
// ---------------------------------------------------------------------------
//
// Le design d'origine portait « 10K+ utilisateurs · 50K+ pages · 120+ pays ».
// Ces chiffres n'existent pas. Les quatre ci-dessous disent tous quelque chose
// de vrai et de vérifiable. À remplacer par les vrais nombres le jour où ils
// existent : il n'y a qu'ici à toucher.

const HERO_STATS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Timer, value: "2 min", label: "pour être en ligne" },
  { icon: InfinityIcon, value: "Illimité", label: "liens sur ta page" },
  { icon: Wallet, value: "Mobile Money", label: "ou carte bancaire" },
  { icon: MousePointerClick, value: "Clics suivis", label: "sur chaque lien" },
];

function StatsBar() {
  return (
    <section className="px-6 pb-16" style={{ background: "var(--b-paper)" }}>
      <div
        className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-8 rounded-[var(--r-lg)] px-6 py-8 lg:grid-cols-4 lg:divide-x"
        style={{
          background: "var(--b-paper)",
          border: "1px solid var(--b-line)",
          boxShadow: "var(--sh-2)",
        }}
      >
        {HERO_STATS.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-3.5 px-2"
            style={{ borderColor: "var(--b-line)" }}
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-[var(--r-full)]"
              style={{ background: "var(--b-orange-soft)" }}
            >
              <Icon
                className="size-5"
                style={{ color: "var(--b-orange)" }}
                strokeWidth={2.2}
                aria-hidden
              />
            </span>
            <span className="leading-tight">
              <span
                className="block text-[18px] font-black"
                style={{ color: "var(--b-ink)" }}
              >
                {value}
              </span>
              <span
                className="block text-[12.5px]"
                style={{ color: "var(--b-slate)" }}
              >
                {label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Plus qu'un arbre de liens
// ---------------------------------------------------------------------------

const PILLARS: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: "orange" | "ink" | "violet";
}[] = [
  {
    icon: Link2,
    title: "Tous tes liens. Enfin réunis.",
    body: "Réseaux, boutique, WhatsApp et contenus : une seule adresse simple à partager.",
    tone: "orange",
  },
  {
    icon: Sparkles,
    title: "Une page qui te ressemble",
    body: "Couleurs, typographies, blocs et bio assistée par IA. Aucun code à écrire.",
    tone: "ink",
  },
  {
    icon: BarChart3,
    title: "Comprends ton audience",
    body: "Découvre ce qui attire les clics et améliore ta page avec des données claires.",
    tone: "violet",
  },
];

const PILLAR_TONES = {
  orange: {
    bg: "var(--b-orange-soft)",
    icon: "var(--b-orange)",
    title: "var(--b-ink)",
    body: "var(--b-slate)",
    chip: "var(--b-paper)",
  },
  ink: {
    bg: "var(--b-ink)",
    icon: "var(--b-orange)",
    title: "#fff",
    body: "rgba(255,255,255,.62)",
    chip: "rgba(255,255,255,.1)",
  },
  violet: {
    bg: "var(--b-violet-soft)",
    icon: "var(--b-violet)",
    title: "var(--b-ink)",
    body: "var(--b-slate)",
    chip: "var(--b-paper)",
  },
} as const;

function Pillars() {
  return (
    <section
      id="why"
      className="px-6 py-20 sm:py-28"
      style={{ background: "var(--b-mist)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHead
            eyebrow="Plus qu'un arbre de liens"
            title={
              <>
                Ta présence en ligne,
                <br />
                sans la prise de tête.
              </>
            }
          />
          <p
            className="max-w-[300px] text-base leading-[1.6]"
            style={{ color: "var(--b-slate)" }}
          >
            Simple à créer. Beau à regarder. Fait pour grandir.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body, tone }) => {
            const t = PILLAR_TONES[tone];
            return (
              <article
                key={title}
                className="rounded-[var(--r-lg)] p-9 transition-transform duration-200 hover:-translate-y-1.5"
                style={{ background: t.bg, boxShadow: "var(--sh-1)" }}
              >
                <div
                  className="mb-12 grid size-[52px] place-items-center rounded-[var(--r-sm)]"
                  style={{ background: t.chip }}
                >
                  <Icon
                    className="size-6"
                    style={{ color: t.icon }}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </div>
                <h3
                  className="text-[24px] font-extrabold tracking-[-0.02em]"
                  style={{ color: t.title }}
                >
                  {title}
                </h3>
                <p className="mt-3 leading-[1.6]" style={{ color: t.body }}>
                  {body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ton copilote créatif
// ---------------------------------------------------------------------------
//
// L'illustration porte son propre fond lilas : la section prend le même
// dégradé, et un fondu de 8 % sur chaque bord de l'image efface la couture
// entre les deux. C'est ce qui donne l'impression que l'image n'a pas de
// cadre.

const COPILOT: { icon: LucideIcon; label: string }[] = [
  { icon: Sparkles, label: "Une bio brillante, écrite avec l'IA" },
  { icon: Palette, label: "Des thèmes vraiment personnalisables" },
  { icon: Type, label: "Tes polices, tes couleurs, tes blocs" },
  { icon: BarChart3, label: "Des statistiques lisibles, enfin" },
];

function Copilot() {
  return (
    <section
      id="product"
      className="overflow-hidden px-6 py-20 sm:py-28"
      style={{
        background:
          "linear-gradient(225deg, #d8c9f6 0%, #e2d8f8 45%, #f1eefc 100%)",
      }}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="-mx-6 sm:mx-0 lg:-ml-24">
          <Image
            src="/accueil-personnalisation.webp"
            alt="Une page Bio-Lien sur un téléphone, entourée de panneaux de couleurs, de choix de polices et de thèmes."
            width={1200}
            height={871}
            sizes="(min-width: 1024px) 700px, 100vw"
            className="h-auto w-full"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>

        <div>
          <SectionHead
            eyebrow="Ton copilote créatif"
            title={
              <>
                Tu imagines.
                <br />
                Bio-Lien fait le reste.
              </>
            }
            accent="var(--b-violet-deep)"
          />
          <div className="mt-10 flex flex-col gap-3">
            {COPILOT.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="glass flex items-center gap-4 rounded-[var(--r-md)] px-4 py-3.5"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-[var(--r-sm)]"
                  style={{ background: "var(--b-paper)" }}
                >
                  <Icon
                    className="size-[19px]"
                    style={{ color: "var(--b-violet)" }}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
                <p
                  className="text-[16px] font-bold"
                  style={{ color: "var(--b-ink)" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Modèles
// ---------------------------------------------------------------------------
//
// Les modèles portent des noms de style, pas des noms de personnes ni de
// boutiques. Un nom inventé finit toujours par ressembler à un compte réel —
// et une galerie de modèles vend un style, pas une vitrine imaginaire.

const TEMPLATES: {
  name: string;
  role: string;
  icon: LucideIcon;
  bg: string;
  accent: string;
  linkText: string;
  links: string[];
  rot: number;
}[] = [
  {
    name: "Solaire",
    role: "Chaud, direct, commerçant",
    icon: ShoppingBag,
    bg: "var(--b-orange-soft)",
    accent: "var(--b-orange)",
    linkText: "#fff",
    links: ["Ma nouvelle collection", "Commander sur WhatsApp"],
    rot: -1,
  },
  {
    name: "Encre",
    role: "Sobre, net, professionnel",
    icon: Layers,
    bg: "#eef0f4",
    accent: "var(--b-ink)",
    linkText: "#fff",
    links: ["Mon portfolio", "Prendre rendez-vous"],
    rot: 1,
  },
  {
    name: "Nébuleuse",
    role: "Créatif, artistique, musical",
    icon: Music2,
    bg: "var(--b-violet-soft)",
    accent: "var(--b-violet)",
    linkText: "#fff",
    links: ["Écouter le nouvel EP", "Mes dates de concert"],
    rot: -1,
  },
];

function Templates() {
  return (
    <section
      id="templates"
      className="px-6 py-20 sm:py-28"
      style={{ background: "var(--b-paper)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        <SectionHead
          centered
          eyebrow="Trouve ton style"
          title="Pas une page comme les autres."
          lead="Pars d'un modèle et rends-le totalement unique. Change tout, quand tu veux."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TEMPLATES.map(({ icon: Icon, ...t }) => (
            <div
              key={t.name}
              className="rounded-[var(--r-xl)] p-3 text-left transition-transform duration-200 hover:-translate-y-2 hover:rotate-0"
              style={{
                background: t.bg,
                boxShadow: "var(--sh-1)",
                transform: `rotate(${t.rot}deg)`,
              }}
            >
              <div className="glass rounded-[var(--r-lg)] px-6 py-7 text-center">
                <div
                  className="mx-auto grid size-16 place-items-center rounded-[var(--r-full)]"
                  style={{ background: t.accent }}
                >
                  <Icon
                    className="size-7 text-white"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <h3
                  className="mt-4 text-[21px] font-extrabold"
                  style={{ color: "var(--b-ink)" }}
                >
                  {t.name}
                </h3>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--b-slate)" }}
                >
                  {t.role}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {t.links.map((link) => (
                    <div
                      key={link}
                      className="rounded-[var(--r-sm)] px-4 py-3 text-xs font-extrabold"
                      style={{ background: t.accent, color: t.linkText }}
                    >
                      {link}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/explore"
            className="mt-11 inline-flex items-center gap-2 rounded-[var(--r-full)] px-6 py-3.5 text-sm font-extrabold transition-colors hover:bg-[var(--b-mist)]"
            style={{
              border: "1.5px solid var(--b-line)",
              background: "var(--b-paper)",
              color: "var(--b-ink)",
            }}
          >
            Voir tous les modèles
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chacun chez soi
// ---------------------------------------------------------------------------
//
// Section neuve. L'isolement des données n'est pas un détail d'ingénierie
// qu'on garde pour soi : un vendeur qui confie son chiffre d'affaires et les
// coordonnées de ses clients a le droit de savoir qui peut les lire. Les
// quatre affirmations ci-dessous décrivent des mécanismes réellement en place.

const SECURITY: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Ta boutique, ton coin",
    body: "Chaque ligne de la base est rattachée à un propriétaire, et la base elle-même refuse de la servir à quelqu'un d'autre. Ce n'est pas un filtre dans le code : c'est une règle en dessous.",
  },
  {
    icon: Wallet,
    title: "Les paiements passent ailleurs",
    body: "Numéros de carte et codes Mobile Money vont directement chez l'opérateur de paiement. Ils ne transitent jamais par nos serveurs, donc ils ne peuvent pas fuir de chez nous.",
  },
  {
    icon: Mail,
    title: "Les commandes de tes clients",
    body: "Nom, téléphone et adresse d'une commande ne sont lisibles que par toi. Aucun autre vendeur de la plateforme ne peut les retrouver.",
  },
  {
    icon: Globe,
    title: "Ta page publique reste publique",
    body: "Ce que tu publies est visible de tous, et rien d'autre. Tes brouillons, tes produits masqués et tes statistiques restent de ton côté.",
  },
];

function Security() {
  return (
    <section
      className="relative overflow-hidden px-6 py-20 sm:py-28"
      style={{ background: "var(--b-ink)" }}
    >
      <Blob
        color="var(--b-violet)"
        className="-left-32 -top-24 size-[460px] opacity-30"
      />
      <Blob
        color="var(--b-orange)"
        className="-bottom-40 -right-24 size-[420px] opacity-25"
        delay="-9s"
      />

      <div className="relative mx-auto max-w-[1100px]">
        <SectionHead
          centered
          dark
          eyebrow="Chacun chez soi"
          accent="var(--b-orange)"
          title="Tes données ne sont à personne d'autre."
          lead="Une boutique en ligne, c'est le chiffre d'affaires et le carnet d'adresses de quelqu'un. Voilà comment on les tient séparés."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {SECURITY.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="glass-dark glass-sheen rounded-[var(--r-lg)] p-7"
            >
              <div
                className="mb-5 grid size-12 place-items-center rounded-[var(--r-sm)]"
                style={{ background: "rgba(255,255,255,.1)" }}
              >
                <Icon
                  className="size-[22px]"
                  style={{ color: "var(--b-orange)" }}
                  strokeWidth={2.2}
                  aria-hidden
                />
              </div>
              <h3 className="text-[19px] font-extrabold text-white">{title}</h3>
              <p
                className="mt-2.5 text-[14.5px] leading-[1.65]"
                style={{ color: "rgba(255,255,255,.6)" }}
              >
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tarifs
// ---------------------------------------------------------------------------

const PLANS = [
  {
    name: "Découverte",
    price: "0 $CA",
    pitch: "Pour démarrer et tester ta boutique",
    features: [
      "Jusqu'à 5 produits",
      "Lien @username unique",
      "Paiement carte + Mobile Money",
      "Mode WhatsApp inclus",
      "Modèles inclus",
    ],
    cta: "Commencer gratuitement",
    href: "/register",
    note: "5 % de commission sur chaque vente.",
  },
  {
    name: "Starter",
    price: "4,99 $CA",
    pitch: "Pour les vendeurs qui dépassent 5 produits",
    features: [
      "Jusqu'à 20 produits",
      "Commission réduite à 3 %",
      "Suppression du badge Bio-Lien",
      "Statistiques standard",
    ],
    cta: "Voir les détails",
    href: "/pricing",
    note: "Sans engagement.",
  },
];

const PRO = {
  name: "Pro",
  price: "9,99 $CA",
  pitch: "Pour les créateurs sérieux qui veulent grandir",
  features: [
    "Produits illimités",
    "0 % de commission sur tes ventes",
    "Statistiques avancées",
    "Bio écrite avec l'IA",
    "Support prioritaire",
  ],
  cta: "Passer en Pro",
  href: "/pricing",
  note: "Sans engagement. Annule à tout moment.",
};

function Pricing() {
  return (
    <section
      id="pricing"
      className="px-6 py-20 sm:py-28"
      style={{ background: "var(--b-mist)" }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-14">
          <SectionHead
            centered
            eyebrow="Tarifs"
            title="Commence gratuitement."
            lead="Pas de frais cachés. Monte d'un palier le jour où ta boutique décolle."
          />
        </div>

        <div className="grid items-stretch gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-[var(--r-lg)] p-8"
              style={{
                background: "var(--b-paper)",
                border: "1px solid var(--b-line)",
                boxShadow: "var(--sh-1)",
              }}
            >
              <p
                className="text-[11px] font-extrabold uppercase tracking-[.2em]"
                style={{ color: "var(--b-slate)" }}
              >
                {plan.name}
              </p>
              <p
                className="mt-3 text-[42px] font-extrabold leading-none"
                style={{ color: "var(--b-ink)" }}
              >
                {plan.price}
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--b-slate)" }}
                >
                  {" "}
                  / mois
                </span>
              </p>
              <p
                className="mb-6 mt-1.5 text-[13.5px]"
                style={{ color: "var(--b-slate)" }}
              >
                {plan.pitch}
              </p>
              <div className="flex flex-1 flex-col gap-2.5 text-sm font-semibold">
                {plan.features.map((f) => (
                  <p
                    key={f}
                    className="flex items-start gap-2"
                    style={{ color: "var(--b-ink)" }}
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0"
                      style={{ color: "var(--b-orange)" }}
                      strokeWidth={3}
                      aria-hidden
                    />
                    {f}
                  </p>
                ))}
              </div>
              <Link
                href={plan.href}
                className="mt-7 block rounded-[var(--r-full)] py-3.5 text-center text-sm font-extrabold transition-colors hover:bg-[var(--b-mist)]"
                style={{
                  border: "1.5px solid var(--b-line)",
                  color: "var(--b-ink)",
                }}
              >
                {plan.cta}
              </Link>
              <p
                className="mt-3.5 text-center text-[11.5px]"
                style={{ color: "var(--b-slate)" }}
              >
                {plan.note}
              </p>
            </div>
          ))}

          <div
            className="relative flex flex-col rounded-[var(--r-lg)] p-8"
            style={{ background: "var(--b-ink)", boxShadow: "var(--sh-3)" }}
          >
            <span
              className="absolute right-6 top-6 rounded-[var(--r-full)] px-3 py-1.5 text-[11px] font-extrabold text-white"
              style={{ background: "var(--b-orange)" }}
            >
              Recommandé
            </span>
            <p
              className="text-[11px] font-extrabold uppercase tracking-[.2em]"
              style={{ color: "var(--b-orange)" }}
            >
              {PRO.name}
            </p>
            <p className="mt-3 text-[42px] font-extrabold leading-none text-white">
              {PRO.price}
              <span
                className="text-[15px] font-semibold"
                style={{ color: "rgba(255,255,255,.5)" }}
              >
                {" "}
                / mois
              </span>
            </p>
            <p
              className="mb-6 mt-1.5 text-[13.5px]"
              style={{ color: "rgba(255,255,255,.55)" }}
            >
              {PRO.pitch}
            </p>
            <div className="flex flex-1 flex-col gap-2.5 text-sm font-semibold">
              {PRO.features.map((f) => (
                <p key={f} className="flex items-start gap-2 text-white">
                  <Check
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: "var(--b-orange)" }}
                    strokeWidth={3}
                    aria-hidden
                  />
                  {f}
                </p>
              ))}
            </div>
            <Link
              href={PRO.href}
              className="mt-7 block rounded-[var(--r-full)] py-3.5 text-center text-sm font-extrabold text-white transition-colors hover:bg-[var(--b-orange-deep)]"
              style={{ background: "var(--b-orange)" }}
            >
              {PRO.cta}
            </Link>
            <p
              className="mt-3.5 text-center text-[11.5px]"
              style={{ color: "rgba(255,255,255,.45)" }}
            >
              {PRO.note}
            </p>
          </div>
        </div>

        <p
          className="mt-8 text-center text-[13px]"
          style={{ color: "var(--b-slate)" }}
        >
          Ces prix sont ceux du paiement par carte. En Mobile Money, la même
          durée s&apos;achète d&apos;avance en FCFA —{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            voir les tarifs
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Appel final
// ---------------------------------------------------------------------------

function FinalCta() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  // Le champ n'est pas décoratif : l'e-mail saisi ici voyage jusqu'au
  // formulaire d'inscription, qui le pré-remplit. Collecter une adresse pour
  // la jeter serait une petite malhonnêteté de plus qu'un visiteur remarque.
  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    router.push(
      value.includes("@")
        ? `/register?email=${encodeURIComponent(value)}`
        : "/register",
    );
  };

  return (
    <section className="px-6 py-20 sm:py-28" style={{ background: "var(--b-paper)" }}>
      <div
        className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[var(--r-xl)] px-6 py-16 text-center sm:py-24"
        style={{ background: "var(--b-orange)" }}
      >
        <Blob
          color="#ffc79c"
          className="-left-28 -top-32 size-[420px] opacity-50"
        />
        <Blob
          color="var(--b-orange-deep)"
          className="-bottom-36 -right-24 size-[400px] opacity-60"
          delay="-11s"
        />

        <div className="relative">
          <h2 className="text-[clamp(32px,6.4vw,58px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">
            Ta page, gratuitement.
          </h2>
          <p
            className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.6] sm:text-lg"
            style={{ color: "rgba(255,255,255,.85)" }}
          >
            Cinq minutes pour réunir tes liens, avoir ton adresse à toi, et la
            mettre dans ta bio. Pas de carte bancaire, pas d&apos;engagement.
          </p>

          <form
            onSubmit={start}
            className="glass mx-auto mt-9 flex max-w-[480px] flex-col gap-2.5 rounded-[var(--r-lg)] p-2.5 sm:flex-row"
          >
            <label htmlFor="cta-email" className="sr-only">
              Ton adresse e-mail
            </label>
            <input
              id="cta-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[50px] flex-1 rounded-[var(--r-sm)] px-4 text-sm font-semibold outline-none placeholder:text-[color:var(--b-slate)]"
              style={{ background: "var(--b-paper)", color: "var(--b-ink)" }}
            />
            <button
              type="submit"
              className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[var(--r-sm)] px-6 text-sm font-extrabold text-white transition-colors hover:bg-[var(--b-ink-soft)]"
              style={{ background: "var(--b-ink)" }}
            >
              Commencer
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </form>

          <p
            className="mt-5 text-[13px] font-semibold"
            style={{ color: "rgba(255,255,255,.85)" }}
          >
            bio-lien.com/<strong>@toi</strong>{" "}— ton adresse t&apos;attend.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pied de page
// ---------------------------------------------------------------------------

const FOOTER_COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "#why" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Explorer", href: "/explore" },
      { label: "Outils gratuits", href: "/outils" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Aide & support", href: "mailto:support@bio-lien.com" },
      { label: "Mentions légales", href: "/legal/mentions" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Confidentialité", href: "/legal/privacy" },
      { label: "Conditions d'utilisation", href: "/legal/terms" },
    ],
  },
];

function Footer() {
  return (
    <footer
      className="px-6 pb-10 pt-16"
      style={{ background: "var(--b-ink)", color: "rgba(255,255,255,.55)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        <div
          className="grid gap-10 pb-11 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
          style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}
        >
          <div>
            <p className="text-xl">
              <Wordmark dark />
            </p>
            <p className="mt-3.5 max-w-[260px] text-[13.5px] leading-[1.6]">
              La plateforme de boutique en ligne pensée pour les créateurs et
              entrepreneurs africains.
            </p>
            <a
              href="mailto:support@bio-lien.com"
              className="mt-4 inline-block text-[13.5px] transition-colors hover:text-white"
            >
              support@bio-lien.com
            </a>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p
                className="mb-4 text-[11px] font-extrabold uppercase tracking-[.2em]"
                style={{ color: "rgba(255,255,255,.8)" }}
              >
                {col.title}
              </p>
              <div className="flex flex-col gap-2.5 text-[13.5px]">
                {col.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    className="transition-colors hover:text-white"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p
          className="mt-7 text-[12.5px]"
          style={{ color: "rgba(255,255,255,.35)" }}
        >
          © 2026 Bio-Lien. Fait avec soin pour les vendeurs sociaux.
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div
      className="font-[family-name:var(--font-brand)]"
      style={{ background: "var(--b-paper)", color: "var(--b-ink)" }}
    >
      {/* Entités du site, déclarées ici et pas dans le layout racine : elles
          viendraient sinon concurrencer le nom du vendeur sur chaque
          boutique. */}
      <JsonLd data={organizationJsonLd(SITE_URL)} />
      <JsonLd data={websiteJsonLd(SITE_URL)} />

      <Header />
      <main>
        <Hero />
        <StatsBar />
        <Pillars />
        <Copilot />
        <Templates />
        <Security />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
