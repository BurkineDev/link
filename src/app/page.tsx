"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";

// ---------------------------------------------------------------------------
// Page d'accueil — système de design de la marque
// ---------------------------------------------------------------------------
//
// Les couleurs, ombres et rayons viennent des jetons `--brand-*` de
// globals.css. Rien n'est écrit en dur ici : changer une valeur là-bas
// change la page entière.
//
// Le design fourni est dessiné pour un écran large (min-width: 1100px). Nos
// visiteurs arrivent d'une bio TikTok, donc du téléphone. Chaque section a
// donc reçu son comportement mobile — c'est la seule chose que j'ai ajoutée
// au design, parce qu'une page illisible à 390 px ne sert à rien.
//
// La signature du système tient en trois choses : des ombres dures sans flou,
// des bordures de 1,5 px, et des pilules.

const SITE_URL = "https://www.bio-lien.com";

const NAV = [
  { label: "Explorer", href: "/explore" },
  { label: "Outils gratuits", href: "/outils" },
  { label: "Fonctionnalités", href: "#why" },
  { label: "Tarifs", href: "/pricing" },
];

// ---------------------------------------------------------------------------
// En-tête
// ---------------------------------------------------------------------------

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LinkMark className="size-6" />
      <span
        className="font-extrabold tracking-[-0.03em]"
        style={{ color: dark ? "#fff" : "var(--hero-navy)" }}
      >
        bio-lien
      </span>
    </span>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-[10px]"
      style={{
        background: "rgba(255,255,255,.92)",
        borderBottom: "1px solid var(--hero-line)",
      }}
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
              className="transition-colors hover:text-[var(--hero-orange)]"
              style={{ color: "var(--hero-slate)" }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-4 py-2.5 text-sm font-bold">
            Connexion
          </Link>
          <Link
            href="/register"
            className="rounded-full px-5 py-[11px] text-sm font-extrabold transition-colors"
            style={{ background: "var(--hero-orange)", color: "#fff" }}
          >
            Créer ma page →
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="rounded-lg p-2 md:hidden"
        >
          <span className="block h-0.5 w-5 bg-[var(--brand-ink)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--brand-ink)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--brand-ink)]" />
        </button>
      </div>

      {open && (
        <div
          className="md:hidden"
          style={{
            borderTop: "1px solid var(--hero-line)",
            background: "#fff",
          }}
        >
          <nav className="flex flex-col gap-1 px-6 py-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold"
              >
                {item.label}
              </a>
            ))}
            <Link href="/login" className="py-2.5 text-sm font-bold">
              Connexion
            </Link>
            <Link
              href="/register"
              className="mt-2 rounded-full py-3 text-center text-sm font-extrabold"
              style={{ background: "var(--hero-orange)", color: "#fff" }}
            >
              Créer ma page →
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
//
// Second système de marque : orange sur blanc, arrondis doux, ombres
// diffuses. Il ne partage rien avec le système crème/jaune du reste de la
// page — c'est assumé, les deux ont été dessinés séparément.
//
// Les icônes flottantes sont dessinées en CSS/SVG plutôt qu'importées : les
// logos Instagram, LinkedIn et GitHub appartiennent à leurs propriétaires, et
// une page d'accueil qui les affiche en gros comme des vignettes décoratives
// n'est pas la même chose qu'une icône de 16 px à côté d'un lien. Les formes
// gardent la silhouette et la couleur reconnaissables, sans reproduire les
// marques.

const HERO_PILLS = [
  { icon: "🔗", title: "Centralisez", sub: "tous vos liens" },
  { icon: "🎨", title: "Personnalisez", sub: "à votre image" },
  { icon: "📈", title: "Développez", sub: "votre audience" },
];

const PHONE_LINKS = [
  { icon: "🌐", label: "Mon site web" },
  { icon: "📁", label: "Mon portfolio" },
  { icon: "in", label: "LinkedIn", tint: "#0a66c2" },
  { icon: "◉", label: "GitHub", tint: "#171717" },
  { icon: "◎", label: "Instagram", tint: "#e1306c" },
  { icon: "✉", label: "Me contacter" },
];

/** Vignette flottante, façon icône d'application. */
function FloatingIcon({
  glyph,
  bg,
  className,
  delay,
}: {
  glyph: string;
  bg: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      aria-hidden
      className={`absolute grid place-items-center rounded-[26%] text-[0.5rem] text-white sm:text-[0.62rem] ${className}`}
      style={{
        background: bg,
        boxShadow: "0 18px 40px rgba(0,0,0,.18)",
        animation: `floaty 4s ease-in-out ${delay} infinite`,
      }}
    >
      <span className="text-[1.6em] font-black leading-none">{glyph}</span>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      <div
        className="relative rounded-[40px] border-[10px] p-0"
        style={{
          borderColor: "#1c1f26",
          background: "#fff",
          boxShadow: "0 40px 90px rgba(20,24,31,.28)",
        }}
      >
        {/* Encoche */}
        <div
          aria-hidden
          className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full"
          style={{ background: "#1c1f26" }}
        />

        <div className="px-4 pb-5 pt-9">
          <div
            className="mb-3 flex items-center justify-between px-1 text-[10px] font-bold"
            style={{ color: "var(--hero-navy)" }}
          >
            <span>9:41</span>
            <span aria-hidden className="tracking-tight">
              ▮▮▮ ᯤ ▰
            </span>
          </div>

          <div className="mb-4 flex items-center justify-center gap-1.5">
            <LinkMark className="size-4" />
            <span
              className="text-sm font-extrabold tracking-[-0.02em]"
              style={{ color: "var(--hero-navy)" }}
            >
              bio-lien
            </span>
          </div>

          <div
            className="mx-auto grid size-[86px] place-items-center rounded-full text-3xl font-black"
            style={{ background: "var(--hero-orange-soft)", color: "var(--hero-orange)" }}
          >
            W
          </div>
          <p
            className="mt-3 text-center text-lg font-extrabold"
            style={{ color: "var(--hero-navy)" }}
          >
            Wend&apos;so Pict
          </p>
          <p
            className="mt-1 text-center text-[11.5px] leading-snug"
            style={{ color: "var(--hero-slate)" }}
          >
            Développeur | Créateur de solutions
            <br />
            passionné par la technologie.
          </p>

          <div className="mt-4 space-y-2">
            {PHONE_LINKS.map((l) => (
              <div
                key={l.label}
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5"
                style={{
                  border: "1px solid var(--hero-line)",
                  boxShadow: "0 2px 6px rgba(20,24,31,.05)",
                }}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center text-[13px] font-bold"
                  style={{ color: l.tint ?? "var(--hero-slate)" }}
                >
                  {l.icon}
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--hero-navy)" }}
                >
                  {l.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Icônes flottantes — hors du téléphone, comme dans le design. */}
      <FloatingIcon
        glyph="◎"
        bg="linear-gradient(135deg,#f9ce34,#ee2a7b 45%,#6228d7)"
        className="-left-8 top-[38%] size-16 sm:-left-12 sm:size-20"
        delay="0s"
      />
      <FloatingIcon
        glyph="🔗"
        bg="linear-gradient(135deg,#7b5cf0,#5b36e8)"
        className="-right-6 top-[8%] size-14 sm:-right-12 sm:size-[72px]"
        delay=".6s"
      />
      <FloatingIcon
        glyph="in"
        bg="#0a66c2"
        className="-right-8 top-[42%] size-14 sm:-right-14 sm:size-[68px]"
        delay="1.2s"
      />
      <FloatingIcon
        glyph="◉"
        bg="#171717"
        className="-right-6 bottom-[14%] size-16 sm:-right-12 sm:size-[76px]"
        delay="1.8s"
      />
    </div>
  );
}

/** Le maillon du logotype, dessiné plutôt qu'importé. */
function LinkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 14.5 14.5 9.5M10 6.5 11.8 4.7a4 4 0 1 1 5.6 5.6l-1.8 1.8M14 17.5l-1.8 1.8a4 4 0 0 1-5.6-5.6l1.8-1.8"
        stroke="var(--hero-orange)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden px-6 pb-14 pt-10 sm:pt-14"
      style={{
        background:
          "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, var(--hero-peach) 100%)",
      }}
    >
      {/* Trame de points, en haut à droite. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 hidden h-64 w-64 lg:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(242 98 26 / 22%) 1.5px, transparent 1.5px)",
          backgroundSize: "14px 14px",
          maskImage: "radial-gradient(circle at top right, black, transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[1fr_.85fr]">
        <div>
          <h1
            className="text-[clamp(38px,7.5vw,64px)] font-black leading-[1.06] tracking-[-0.035em]"
            style={{ color: "var(--hero-navy)", textWrap: "balance" }}
          >
            Tous vos liens,
            <br />
            <span style={{ color: "var(--hero-orange)" }}>
              en un seul endroit.
            </span>
          </h1>

          <p
            className="mt-6 max-w-[460px] text-[17px] leading-[1.65]"
            style={{ color: "var(--hero-slate)" }}
          >
            Créez votre page personnalisée, partagez tout ce qui compte et
            développez votre présence en ligne.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {HERO_PILLS.map((p) => (
              <div key={p.title} className="flex items-center gap-2.5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full text-base"
                  style={{ background: "var(--hero-orange-soft)" }}
                >
                  {p.icon}
                </span>
                <span className="text-[13.5px] leading-tight">
                  <span
                    className="block font-extrabold"
                    style={{ color: "var(--hero-navy)" }}
                  >
                    {p.title}
                  </span>
                  <span style={{ color: "var(--hero-slate)" }}>{p.sub}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-[15px] font-bold text-white transition-colors"
              style={{
                background: "var(--hero-orange)",
                boxShadow: "0 10px 24px rgb(242 98 26 / 28%)",
              }}
            >
              Commencer gratuitement <span aria-hidden>→</span>
            </Link>
            <Link
              href="#product"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-4 text-[15px] font-bold"
              style={{
                border: "1px solid var(--hero-line)",
                color: "var(--hero-navy)",
              }}
            >
              <span
                className="grid size-6 place-items-center rounded-full text-[10px] text-white"
                style={{ background: "var(--hero-orange)" }}
                aria-hidden
              >
                ▶
              </span>
              Voir comment ça marche
            </Link>
          </div>

          <div
            className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[13.5px] font-medium"
            style={{ color: "var(--hero-slate)" }}
          >
            {["Gratuit à vie", "Sans carte bancaire", "Prêt en 2 minutes"].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span style={{ color: "var(--hero-orange)" }} aria-hidden>
                    ✓
                  </span>
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
// Le design portait « 10K+ utilisateurs · 50K+ pages · 120+ pays · 1M+ clics ».
// Ces chiffres n'existent pas : la plateforme compte une poignée de comptes et
// n'a encore encaissé aucune commande. Les publier, c'est fabriquer une preuve
// sociale qu'un vendeur peut démentir en trois clics — et il ne revient pas
// après.
//
// La mise en page est celle du design, au pixel près. Seuls les quatre
// contenus disent quelque chose de vrai. À remplacer par les vrais nombres le
// jour où ils existent : il n'y a qu'ici à toucher.

const HERO_STATS = [
  { icon: "⚡", value: "2 min", label: "pour être en ligne" },
  { icon: "🔗", value: "Illimité", label: "liens sur ta page" },
  { icon: "🌍", value: "Afrique de l'Ouest", label: "Mobile Money ou carte" },
  { icon: "📈", value: "Clics suivis", label: "sur chaque lien" },
];

function StatsBar() {
  return (
    <section
      className="px-6 pb-16"
      style={{
        background:
          "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, var(--hero-peach) 100%)",
      }}
    >
      <div
        className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-8 rounded-[22px] bg-white px-6 py-8 lg:grid-cols-4 lg:divide-x"
        style={{
          border: "1px solid var(--hero-line)",
          boxShadow: "0 18px 46px rgb(20 24 31 / 8%)",
        }}
      >
        {HERO_STATS.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-center gap-3.5 px-2"
            style={{ borderColor: "var(--hero-line)" }}
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-full text-lg"
              style={{ background: "var(--hero-orange-soft)" }}
              aria-hidden
            >
              {s.icon}
            </span>
            <span className="leading-tight">
              <span
                className="block text-[19px] font-black"
                style={{ color: "var(--hero-navy)" }}
              >
                {s.value}
              </span>
              <span
                className="block text-[12.5px]"
                style={{ color: "var(--hero-slate)" }}
              >
                {s.label}
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

const PILLARS = [
  {
    emoji: "🔗",
    title: "Tous tes liens. Enfin réunis.",
    body: "Réseaux, boutique, WhatsApp et contenus : une seule adresse simple à partager.",
    bg: "var(--brand-yellow-soft)",
    border: true,
    iconBg: "#fff",
    text: "rgba(0,0,0,.55)",
  },
  {
    emoji: "✦",
    title: "Une page qui te ressemble",
    body: "Couleurs, typographies, blocs et bio assistée par IA. Aucun code à écrire.",
    bg: "var(--brand-forest)",
    border: false,
    iconBg: "var(--brand-yellow)",
    text: "rgba(255,255,255,.65)",
    dark: true,
  },
  {
    emoji: "📊",
    title: "Comprends ton audience",
    body: "Découvre ce qui attire les clics et améliore ta page avec des données claires.",
    bg: "var(--brand-violet-soft)",
    border: true,
    iconBg: "#fff",
    text: "rgba(0,0,0,.55)",
  },
];

function Pillars() {
  return (
    <section id="why" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p
              className="mb-3 text-xs font-extrabold uppercase tracking-[.2em]"
              style={{ color: "var(--brand-clay)" }}
            >
              Plus qu&apos;un arbre de liens
            </p>
            <h2 className="text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.05] tracking-[-0.04em]">
              Ta présence digitale,
              <br />
              sans la prise de tête.
            </h2>
          </div>
          <p
            className="max-w-[340px] text-base leading-[1.6]"
            style={{ color: "rgba(0,0,0,.55)" }}
          >
            Simple à créer. Beau à regarder. Puissant pour grandir.
          </p>
        </div>

        <div className="grid gap-[18px] md:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.title}
              className="rounded-[var(--brand-radius-card)] p-9 transition-transform duration-200 hover:-translate-y-1.5"
              style={{
                background: p.bg,
                color: p.dark ? "#fff" : undefined,
                border: p.border ? "1.5px solid rgba(0,0,0,.1)" : undefined,
              }}
            >
              <div
                className="mb-12 grid size-[50px] place-items-center rounded-2xl text-xl"
                style={{ background: p.iconBg }}
              >
                {p.emoji}
              </div>
              <h3 className="text-[25px] font-extrabold tracking-[-0.02em]">
                {p.title}
              </h3>
              <p className="mt-3 leading-[1.6]" style={{ color: p.text }}>
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ton copilote créatif
// ---------------------------------------------------------------------------
//
// Le design plaçait ici le mockup « Studio Clay » de Linktree. Remplacé par
// une vraie page Bio-Lien : montrer notre produit vaut mieux que montrer
// celui d'un concurrent, en plus d'être le seul choix honnête.

function BioPageMockup() {
  return (
    <div
      className="relative w-full max-w-[420px] overflow-hidden rounded-[var(--brand-radius-card)]"
      style={{ background: "#fff", boxShadow: "0 26px 60px rgba(0,0,0,.3)" }}
    >
      <div
        className="px-7 pb-6 pt-9 text-center"
        style={{ background: "var(--brand-forest)" }}
      >
        <div
          className="mx-auto grid size-[72px] place-items-center rounded-full text-2xl font-extrabold"
          style={{ background: "var(--brand-yellow)", color: "var(--brand-ink)" }}
        >
          A
        </div>
        <p className="mt-3.5 text-lg font-extrabold text-white">Atelier Awa</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,.6)" }}>
          Pagnes &amp; prêt-à-porter · Abidjan
        </p>
      </div>

      <div className="space-y-2.5 p-5">
        <div className="flex gap-2">
          <span
            className="flex-1 rounded-full py-2 text-center text-xs font-extrabold"
            style={{ background: "var(--hero-orange)", color: "#fff" }}
          >
            Liens
          </span>
          <span
            className="flex-1 rounded-full py-2 text-center text-xs font-extrabold"
            style={{ background: "var(--brand-cream-deep)" }}
          >
            Boutique
          </span>
        </div>
        {["Ma nouvelle collection", "Commander sur WhatsApp", "Mon TikTok"].map(
          (label) => (
            <div
              key={label}
              className="rounded-[13px] px-4 py-3 text-xs font-extrabold"
              style={{
                background: "var(--brand-cream)",
                border: "1.5px solid rgba(0,0,0,.1)",
              }}
            >
              {label}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

const COPILOT = [
  { emoji: "✦", label: "Une bio brillante grâce à l'IA" },
  { emoji: "🎨", label: "Des thèmes vraiment personnalisables" },
  { emoji: "⚡", label: "Des liens détectés et habillés automatiquement" },
  { emoji: "📈", label: "Des statistiques lisibles, enfin" },
];

function Copilot() {
  return (
    <section
      id="product"
      className="px-6 py-20 sm:py-28"
      style={{ background: "var(--brand-cream-deep)" }}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div
          className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[var(--brand-radius-hero)] p-10 sm:min-h-[560px]"
          style={{ background: "var(--brand-clay)" }}
        >
          <div
            aria-hidden
            className="absolute -bottom-24 -left-14 size-80 rounded-full"
            style={{ background: "var(--brand-yellow)" }}
          />
          <div
            aria-hidden
            className="absolute -right-16 top-12 size-52 rounded-full"
            style={{ border: "35px solid var(--brand-lilac)" }}
          />
          <BioPageMockup />
          {/* Sur téléphone la maquette occupe presque tout le panneau : la
              pastille se replie dans le coin pour ne pas recouvrir un libellé
              de lien. */}
          <div
            className="absolute bottom-3 right-3 rounded-[18px] bg-white px-3.5 py-3 sm:bottom-7 sm:right-7 sm:px-4.5 sm:py-4"
            style={{ boxShadow: "0 20px 44px rgba(0,0,0,.25)" }}
          >
            <p
              className="mb-1.5 text-sm sm:mb-2 sm:text-base"
              style={{ color: "var(--brand-violet)" }}
            >
              ▮▮▮
            </p>
            <p className="text-xl font-extrabold sm:text-2xl">2 849</p>
            <p className="text-[11.5px]" style={{ color: "rgba(0,0,0,.5)" }}>
              vues ce mois
            </p>
          </div>
        </div>

        <div>
          <p
            className="text-xs font-extrabold uppercase tracking-[.2em]"
            style={{ color: "var(--brand-clay)" }}
          >
            Ton copilote créatif
          </p>
          <h2 className="mt-4 text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.05] tracking-[-0.04em]">
            Tu imagines.
            <br />
            Bio-Lien fait le reste.
          </h2>
          <div className="mt-10 flex flex-col gap-6.5">
            {COPILOT.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 pb-6"
                style={{ borderBottom: "1px solid rgba(0,0,0,.1)" }}
              >
                <span className="grid size-11 place-items-center rounded-[13px] bg-white text-lg">
                  {item.emoji}
                </span>
                <p className="text-[17px] font-bold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: "Soraya",
    role: "Mode & lifestyle",
    bg: "var(--brand-peach)",
    accent: "var(--brand-orange)",
    avatar: "S",
    linkText: "#fff",
    links: ["Ma nouvelle collection", "Shopper mes looks"],
    rot: -1,
  },
  {
    name: "Kader Beats",
    role: "Artiste · Producteur",
    bg: "var(--brand-lime)",
    accent: "#111111",
    avatar: "K",
    linkText: "var(--brand-lime)",
    links: ["Écouter le nouvel EP", "YouTube"],
    rot: 1,
  },
  {
    name: "Studio Noma",
    role: "Design & création",
    bg: "var(--brand-lilac)",
    accent: "var(--brand-violet)",
    avatar: "N",
    linkText: "#fff",
    links: ["Voir nos projets", "Nous contacter"],
    rot: -1,
  },
];

function Templates() {
  return (
    <section id="templates" className="px-6 py-20 text-center sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <p
          className="text-xs font-extrabold uppercase tracking-[.2em]"
          style={{ color: "var(--brand-violet)" }}
        >
          Trouve ton style
        </p>
        <h2 className="mt-4 text-[clamp(32px,6vw,56px)] font-extrabold tracking-[-0.04em]">
          Pas un profil comme les autres.
        </h2>
        <p
          className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.6]"
          style={{ color: "rgba(0,0,0,.55)" }}
        >
          Pars d&apos;un template et rends-le totalement unique. Change tout,
          quand tu veux.
        </p>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="rounded-[35px] p-3 text-left transition-transform duration-200 hover:-translate-y-2 hover:rotate-0"
              style={{
                background: t.bg,
                border: "1.5px solid rgba(0,0,0,.1)",
                transform: `rotate(${t.rot}deg)`,
              }}
            >
              <div
                className="rounded-[27px] px-6 py-7 text-center backdrop-blur-[6px]"
                style={{ background: "rgba(255,255,255,.75)" }}
              >
                <div
                  className="mx-auto grid size-16 place-items-center rounded-full text-2xl font-extrabold text-white"
                  style={{ background: t.accent }}
                >
                  {t.avatar}
                </div>
                <h3 className="mt-4 text-[21px] font-extrabold">{t.name}</h3>
                <p className="mt-1 text-xs" style={{ color: "rgba(0,0,0,.5)" }}>
                  {t.role}
                </p>
                <div className="mt-5.5 flex flex-col gap-2">
                  {t.links.map((link) => (
                    <div
                      key={link}
                      className="rounded-[13px] px-4 py-3 text-xs font-extrabold"
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

        <Link
          href="/explore"
          className="mt-11 inline-flex items-center gap-2 rounded-full px-6.5 py-3.5 text-sm font-extrabold"
          style={{ border: "2px solid var(--brand-ink)", background: "#fff" }}
        >
          Voir tous les templates →
        </Link>
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
      "Templates inclus",
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
      "Analytics standard",
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
    "Analytics avancés",
    "Templates premium",
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
      style={{ background: "var(--brand-cream-deep)" }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-14 text-center">
          <p
            className="text-xs font-extrabold uppercase tracking-[.2em]"
            style={{ color: "var(--brand-clay)" }}
          >
            Tarifs
          </p>
          <h2 className="mt-4 text-[clamp(32px,6vw,56px)] font-extrabold tracking-[-0.04em]">
            Commence gratuitement.
          </h2>
          <p
            className="mx-auto mt-4.5 max-w-[480px] text-[17px]"
            style={{ color: "rgba(0,0,0,.55)" }}
          >
            Pas de frais cachés. Monte d&apos;un palier le jour où ta boutique
            décolle.
          </p>
        </div>

        <div className="grid items-stretch gap-[18px] md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-[var(--brand-radius-card)] bg-white p-8"
              style={{ border: "1.5px solid rgba(0,0,0,.12)" }}
            >
              <p
                className="text-xs font-extrabold uppercase tracking-[.18em]"
                style={{ color: "rgba(0,0,0,.45)" }}
              >
                {plan.name}
              </p>
              <p className="mt-3 text-[44px] font-extrabold leading-none">
                {plan.price}
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: "rgba(0,0,0,.45)" }}
                >
                  {" "}
                  / mois
                </span>
              </p>
              <p
                className="mb-5.5 mt-1.5 text-[13.5px]"
                style={{ color: "rgba(0,0,0,.5)" }}
              >
                {plan.pitch}
              </p>
              <div className="flex flex-1 flex-col gap-2.5 text-sm font-semibold">
                {plan.features.map((f) => (
                  <p key={f}>✓ {f}</p>
                ))}
              </div>
              <Link
                href={plan.href}
                className="mt-6.5 block rounded-full py-3.5 text-center text-sm font-extrabold"
                style={{ border: "2px solid var(--brand-ink)" }}
              >
                {plan.cta}
              </Link>
              <p
                className="mt-3.5 text-center text-[11.5px]"
                style={{ color: "rgba(0,0,0,.45)" }}
              >
                {plan.note}
              </p>
            </div>
          ))}

          <div
            className="relative flex flex-col rounded-[var(--brand-radius-card)] p-8 text-white"
            style={{
              background: "var(--brand-forest)",
              boxShadow: "var(--brand-shadow-accent)",
            }}
          >
            <span
              className="absolute right-6 top-6 rounded-full px-3 py-1.5 text-[11px] font-extrabold"
              style={{ background: "var(--brand-yellow)", color: "var(--brand-ink)" }}
            >
              Recommandé
            </span>
            <p
              className="text-xs font-extrabold uppercase tracking-[.18em]"
              style={{ color: "var(--brand-yellow)" }}
            >
              {PRO.name}
            </p>
            <p className="mt-3 text-[44px] font-extrabold leading-none">
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
              className="mb-5.5 mt-1.5 text-[13.5px]"
              style={{ color: "rgba(255,255,255,.55)" }}
            >
              {PRO.pitch}
            </p>
            <div className="flex flex-1 flex-col gap-2.5 text-sm font-semibold">
              {PRO.features.map((f) => (
                <p key={f} style={{ color: "var(--brand-yellow)" }}>
                  ✓ <span className="text-white">{f}</span>
                </p>
              ))}
            </div>
            <Link
              href={PRO.href}
              className="mt-6.5 block rounded-full py-3.5 text-center text-sm font-extrabold"
              style={{ background: "var(--brand-yellow)", color: "var(--brand-ink)" }}
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
          style={{ color: "rgba(0,0,0,.5)" }}
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
    <section className="px-6 py-20 sm:py-28">
      <div
        className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[var(--brand-radius-hero)] px-6 py-16 text-center sm:py-22"
        style={{ background: "var(--brand-yellow)" }}
      >
        <div
          aria-hidden
          className="absolute -left-16 -top-16 size-60 rounded-full"
          style={{ border: "30px solid var(--brand-clay)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -right-14 size-64 rounded-full"
          style={{ background: "var(--brand-forest)" }}
        />

        <div className="relative">
          <h2 className="text-[clamp(32px,7vw,60px)] font-extrabold leading-[1.05] tracking-[-0.04em]">
            Ta page, gratuitement.
          </h2>
          <p
            className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.6] sm:text-lg"
            style={{ color: "rgba(23,23,23,.65)" }}
          >
            Cinq minutes pour réunir tes liens, avoir ton adresse à toi, et la
            mettre dans ta bio. Pas de carte bancaire, pas d&apos;engagement.
          </p>

          <form
            onSubmit={start}
            className="mx-auto mt-9 flex max-w-[460px] flex-col gap-2.5 sm:flex-row"
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
              className="h-[54px] flex-1 rounded-full px-5 text-sm font-semibold outline-none"
              style={{
                border: "2px solid var(--brand-ink)",
                background: "var(--brand-paper)",
              }}
            />
            <button
              type="submit"
              className="inline-flex h-[54px] items-center justify-center rounded-full px-6.5 text-sm font-extrabold"
              style={{ background: "var(--hero-orange)", color: "#fff" }}
            >
              Commencer →
            </button>
          </form>

          <p
            className="mt-4.5 text-[13px] font-semibold"
            style={{ color: "rgba(23,23,23,.55)" }}
          >
            bio-lien.com/<strong>@toi</strong>{" "}
            — ton adresse t&apos;attend.
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
      style={{ background: "var(--brand-ink)", color: "rgba(255,255,255,.55)" }}
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
                className="mb-4 text-[11px] font-extrabold uppercase tracking-[.18em]"
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

        <p className="mt-7 text-[12.5px]" style={{ color: "rgba(255,255,255,.35)" }}>
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
      style={{ background: "var(--brand-cream)", color: "var(--brand-ink)" }}
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
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
