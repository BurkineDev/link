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
    <span
      className="font-extrabold tracking-[-0.03em]"
      style={{ color: dark ? "#fff" : "var(--brand-ink)" }}
    >
      Bio
      <span style={{ color: dark ? "var(--brand-yellow)" : "var(--brand-clay)" }}>
        -Lien
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
        background: "rgba(250,246,236,.92)",
        borderBottom: "1px solid rgba(0,0,0,.07)",
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
              className="transition-colors hover:text-[var(--brand-clay)]"
              style={{ color: "rgba(23,23,23,.65)" }}
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
            style={{ background: "var(--brand-ink)", color: "var(--brand-yellow)" }}
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
            borderTop: "1px solid rgba(0,0,0,.07)",
            background: "var(--brand-cream)",
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
              style={{ background: "var(--brand-ink)", color: "var(--brand-yellow)" }}
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
// Visuel du héros
// ---------------------------------------------------------------------------
//
// Le design fourni plaçait ici l'illustration marketing de Linktree — leur
// photographie, et leur logo astérisque en bas à gauche. Impossible de la
// publier : c'est la marque d'un concurrent sur notre propre accueil.
//
// La composition est reconstruite en CSS, avec notre adresse dessus. Aucun
// fichier à charger, et ça s'adapte à la largeur.

const SOCIAL_CARDS = [
  { bg: "#e1306c", glyph: "◎", label: "Instagram", offset: 0 },
  { bg: "#1877f2", glyph: "f", label: "Facebook", offset: 1 },
  { bg: "#ff0000", glyph: "▶", label: "YouTube", offset: 2 },
  { bg: "#6b7280", glyph: "▤", label: "QR", offset: 3 },
  { bg: "#171717", glyph: "♪", label: "TikTok", offset: 4 },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* Halo jaune, comme dans le design. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-full blur-[70px]"
        style={{ background: "rgba(255,218,70,.35)" }}
      />

      <div className="relative aspect-square">
        {SOCIAL_CARDS.map((card) => {
          const i = card.offset;
          return (
            <div
              key={card.label}
              className="absolute rounded-[8%]"
              style={{
                background: card.bg,
                // La carte de devant (offset 0) occupe le bas-gauche ; les
                // suivantes s'échelonnent vers le haut-droit, comme dans le
                // design.
                inset: `${(4 - i) * 9}% ${(4 - i) * 9}% ${i * 9}% ${i * 9}%`,
                zIndex: 10 - i,
                boxShadow: "0 12px 30px rgba(0,0,0,.12)",
              }}
            >
              <div className="flex h-full flex-col justify-between p-[7%]">
                <div className="flex items-start justify-between">
                  <div
                    className="aspect-square w-[22%] rounded-full"
                    style={{ background: "var(--brand-lime)" }}
                  />
                  <span className="text-[clamp(14px,3vw,22px)] font-extrabold text-white">
                    {card.glyph}
                  </span>
                </div>
                <div className="space-y-[4%]">
                  <div className="h-[7%] min-h-[6px] w-[55%] rounded-full bg-white/35" />
                  <div className="h-[7%] min-h-[6px] w-[35%] rounded-full bg-white/25" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Notre adresse, à la place de celle du concurrent. */}
        <div
          className="absolute -left-2 bottom-[4%] z-20 rounded-full px-4 py-2 text-[clamp(11px,2.2vw,15px)] font-extrabold"
          style={{
            background: "#fff",
            color: "var(--brand-ink)",
            boxShadow: "var(--brand-shadow-sm)",
          }}
        >
          bio-lien.com/@toi
        </div>
      </div>

      {/* Pastilles flottantes. */}
      <div
        className="absolute -right-2 top-[14%] z-20 rounded-2xl px-4 py-3 text-[12.5px] font-extrabold"
        style={{
          background: "#fff",
          border: "1.5px solid rgba(0,0,0,.06)",
          boxShadow: "0 18px 40px rgba(0,0,0,.14)",
        }}
      >
        <span style={{ color: "var(--brand-violet)" }} className="mr-1.5">
          ↗
        </span>
        +48 clics aujourd&apos;hui
      </div>
      <div
        className="absolute left-0 top-[52%] z-20 rounded-2xl px-4 py-3 text-[12.5px] font-extrabold text-white"
        style={{
          background: "var(--brand-forest)",
          boxShadow: "0 18px 40px rgba(0,0,0,.2)",
        }}
      >
        ● En ligne
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Héros
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="overflow-hidden px-6 pb-16 pt-12 sm:pb-22 sm:pt-18">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold"
            style={{
              background: "#fff",
              border: "1.5px solid var(--brand-ink)",
              boxShadow: "var(--brand-shadow-sm)",
            }}
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: "var(--brand-clay)" }}
            />
            Aucune compétence technique
          </div>

          <h1
            className="mt-6 text-[clamp(40px,8vw,76px)] font-extrabold leading-[1.02] tracking-[-0.045em]"
            style={{ textWrap: "balance" }}
          >
            Un seul lien dans ta bio.{" "}
            <span
              className="inline-block rounded-[14px] px-3"
              style={{
                background: "var(--brand-yellow)",
                boxShadow: "var(--brand-shadow)",
              }}
            >
              Et tu vends dessus.
            </span>
          </h1>

          <p
            className="mt-7 max-w-[480px] text-[17px] leading-[1.6] sm:text-lg"
            style={{ color: "rgba(23,23,23,.6)", textWrap: "pretty" }}
          >
            Tes réseaux, tes produits, ton WhatsApp — réunis sur une page à toi.
            Tu colles ton lien, on reconnaît TikTok, Instagram ou YouTube tout
            seuls. Et le jour où tu veux vendre, tu encaisses en Mobile Money ou
            par carte.
          </p>

          <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="rounded-full px-7 py-[17px] text-center text-base font-extrabold text-white transition-colors"
              style={{
                background: "var(--brand-clay)",
                boxShadow: "var(--brand-shadow)",
              }}
            >
              Créer ma page gratuite →
            </Link>
            <Link
              href="/explore"
              className="rounded-full px-7 py-[17px] text-center text-base font-extrabold"
              style={{ border: "2px solid var(--brand-ink)", background: "#fff" }}
            >
              Voir les boutiques
            </Link>
          </div>

          <p
            className="mt-5.5 text-[13.5px] font-semibold"
            style={{ color: "rgba(23,23,23,.5)" }}
          >
            ✓ Gratuit pour commencer&nbsp;&nbsp;·&nbsp;&nbsp;Sans carte
            bancaire&nbsp;&nbsp;·&nbsp;&nbsp;En ligne en 5 minutes
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bandeau de chiffres
// ---------------------------------------------------------------------------

const STATS = [
  { value: "5 min", label: "pour être en ligne" },
  { value: "Mobile Money", label: "ou carte bancaire" },
  { value: "@toi", label: "ton lien à partager" },
  { value: "0 FCFA", label: "pour démarrer" },
];

function StatsBar() {
  return (
    <section
      className="px-6 py-6"
      style={{ background: "var(--brand-forest)", color: "var(--brand-cream-soft)" }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 text-center lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p
              className="text-[clamp(20px,4vw,28px)] font-extrabold"
              style={{ color: "var(--brand-yellow)" }}
            >
              {stat.value}
            </p>
            <p
              className="mt-0.5 text-[13px]"
              style={{ color: "rgba(248,239,215,.65)" }}
            >
              {stat.label}
            </p>
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
            style={{ background: "var(--brand-ink)", color: "var(--brand-yellow)" }}
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
              style={{ background: "var(--brand-ink)", color: "var(--brand-yellow)" }}
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
