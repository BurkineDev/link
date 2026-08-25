"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BIO_THEME_IDS } from "@/lib/bio-themes";
import { MOBILE_MONEY_PROVIDERS } from "@/lib/constants";
import { PREPAID_PRICES, prepaidSavingsPercent } from "@/lib/subscription";
import {
  BrandBackdrop,
  Wordmark,
} from "@/components/brand/brand-shell";
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";

// ---------------------------------------------------------------------------
// Page d'accueil — maquette « Landing v3 »
// ---------------------------------------------------------------------------
//
// Reprise de la maquette fournie : fond lilas, Space Grotesk, accent citron
// vert, cartes blanches bordées, panneaux encre. Les jetons sont dans
// globals.css, le décor dans components/brand.
//
// Trois écarts avec la maquette, tous assumés :
//
//   1. La bande de trois témoignages a été retirée. « Awa T., couturière à
//      Abidjan », « Moussa K. », « Kwame A. » n'existent pas, et une citation
//      inventée signée d'un nom et d'une ville est un faux avis. Rien ne l'a
//      remplacée : inventer un bloc pour combler le trou serait la même faute
//      avec plus d'étapes.
//   2. Les chiffres du bloc « Grandir » (1 248 visites, 27 commandes,
//      241 500 F) sont marqués « exemple ». La plateforme n'a pas encore ces
//      volumes ; les afficher sans mention, c'est fabriquer une preuve
//      sociale qu'un vendeur dément en trois clics.
//   3. Les prix, le nombre d'opérateurs et le nombre de palettes ne sont plus
//      écrits en dur : ils sont lus depuis le code qui les applique
//      réellement. Une grille tarifaire qui ment sur la page d'accueil est
//      une plainte au support par semaine.

const SITE_URL = "https://www.bio-lien.com";

/** Neuf palettes prêtes, plus `brand` qui dérive des couleurs du vendeur. */
const READY_THEMES = BIO_THEME_IDS.filter((id) => id !== "brand").length;
const OPERATOR_COUNT = MOBILE_MONEY_PROVIDERS.length;

const NUMBER_WORDS: Record<number, string> = {
  8: "Huit",
  9: "Neuf",
  10: "Dix",
  11: "Onze",
  12: "Douze",
};

const spell = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** Fonds des thèmes prêts, dans l'ordre de BIO_THEME_IDS. */
const THEME_SWATCHES = [
  "#FFFFFF",
  "#0B0B0F",
  "#2E7D7B",
  "#FB8C00",
  "#F4EADB",
  "#0E3B2E",
  "#E7F6EF",
  "#EDE9FE",
  "#1E1B4B",
];
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;

// ---------------------------------------------------------------------------
// Réservation d'adresse
// ---------------------------------------------------------------------------

/**
 * Le champ « bio-lien.com/… » du héros et de l'appel final.
 *
 * Il n'est pas décoratif : le pseudo saisi voyage jusqu'au formulaire
 * d'inscription, qui le pré-remplit. Le nettoyage reproduit la contrainte de
 * la base (`^[a-z0-9_-]{3,30}$`) pour qu'on ne propose jamais une adresse que
 * l'inscription refusera ensuite.
 */
function ClaimField({ dark = false }: { dark?: boolean }) {
  const [username, setUsername] = useState("");
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30);
    router.push(
      clean.length >= 3 ? `/register?username=${encodeURIComponent(clean)}` : "/register",
    );
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 flex max-w-[540px] flex-wrap items-stretch justify-center gap-2.5"
    >
      <div
        className="flex min-w-[250px] flex-1 items-center rounded-[var(--r-full)] py-1 pl-5 pr-1.5"
        style={{
          background: dark ? "var(--b-ink-2)" : "var(--b-paper)",
          border: `1px solid ${dark ? "var(--b-line-dark)" : "var(--b-line)"}`,
        }}
      >
        <span
          className="whitespace-nowrap text-[15.5px] font-semibold"
          style={{ color: dark ? "var(--b-on-dark-faint)" : "var(--b-faint)" }}
        >
          bio-lien.com/
        </span>
        <label htmlFor={dark ? "claim-bas" : "claim-haut"} className="sr-only">
          Ton adresse Bio-Lien
        </label>
        <input
          id={dark ? "claim-bas" : "claim-haut"}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="tonnom"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="min-w-[60px] flex-1 border-none bg-transparent px-1.5 py-3 text-[15.5px] outline-none"
          style={{ color: dark ? "var(--b-on-dark)" : "var(--b-ink)" }}
        />
      </div>
      <button
        type="submit"
        className="cursor-pointer rounded-[var(--r-full)] px-6.5 py-3.5 text-[15.5px] font-bold transition-colors hover:bg-[var(--b-lime-deep)]"
        style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
      >
        Réserver ma page
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAV = [
  { label: "Fonctions", href: "#fonctions" },
  { label: "Outils gratuits", href: "/outils" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "FAQ", href: "#faq" },
];

function Nav() {
  return (
    <nav className="flex items-center justify-between gap-6 py-5.5">
      <Wordmark />

      <div className="hidden gap-7 text-[15px] font-medium md:flex">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="no-underline transition-colors hover:text-[var(--b-muted)]"
            style={{ color: "var(--b-ink)" }}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          href="/login"
          className="px-3.5 py-2.5 text-[15px] font-medium no-underline transition-colors hover:text-[var(--b-muted)]"
          style={{ color: "var(--b-ink)" }}
        >
          Se connecter
        </Link>
        <Link
          href="/register"
          className="whitespace-nowrap rounded-[var(--r-full)] px-5.5 py-3 text-[15px] font-semibold no-underline transition-colors hover:bg-[var(--b-ink-hover)]"
          style={{ background: "var(--b-ink)", color: "var(--b-on-dark)" }}
        >
          S&apos;inscrire
        </Link>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Héros
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="pb-10 pt-16 text-center sm:pt-18">
      <span
        className="inline-flex items-center gap-2 rounded-[var(--r-full)] px-4 py-2 text-[13.5px] font-medium"
        style={{ background: "var(--b-paper)", border: "1px solid var(--b-line)" }}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: "var(--b-green-bright)" }}
          aria-hidden
        />
        Orange Money, Wave, MTN, M-Pesa — et la carte
      </span>

      <h1
        className="mx-auto mt-7 max-w-[15ch] text-[clamp(44px,6.4vw,84px)] font-bold leading-[1.02] tracking-[-0.035em]"
        style={{ color: "var(--b-ink)", textWrap: "balance" }}
      >
        Un lien en bio, toute une boutique.
      </h1>

      <p
        className="mx-auto mt-6 max-w-[52ch] text-[18px] leading-[1.6]"
        style={{ color: "var(--b-muted)" }}
      >
        Tes liens, ton catalogue et tes paiements Mobile Money sur une page à
        ton nom. Colle-la dans ta bio TikTok, Instagram ou WhatsApp — et vends
        pendant que tu crées.
      </p>

      <ClaimField />

      <p className="mt-4 text-[13.5px]" style={{ color: "var(--b-faint)" }}>
        Gratuit pour toujours · sans carte bancaire · en ligne en 3 minutes
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Opérateurs
// ---------------------------------------------------------------------------
//
// Les cinq nommés sont bien dans `MOBILE_MONEY_PROVIDERS` — vérifié, pas
// recopié depuis la maquette.

const OPERATORS = [
  "Orange Money",
  "Wave",
  "MTN MoMo",
  "Moov Money",
  "M-Pesa",
  "Carte bancaire",
];

function Operators() {
  return (
    <section aria-labelledby="ops" className="pb-18 text-center">
      <p
        id="ops"
        className="mb-5 text-[13px] font-semibold uppercase tracking-[.1em]"
        style={{ color: "var(--b-faint)" }}
      >
        Tes clients paient comme ils paient vraiment
      </p>
      <div className="flex flex-wrap justify-center gap-3 gap-y-3">
        {OPERATORS.map((name) => (
          <span
            key={name}
            className="rounded-[var(--r-full)] px-5 py-2.5 text-[14.5px] font-semibold"
            style={{
              background: "var(--b-paper)",
              border: "1px solid var(--b-line)",
            }}
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fonctions
// ---------------------------------------------------------------------------

function Features() {
  return (
    <section id="fonctions" className="pb-18">
      <h2
        className="max-w-[22ch] text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.03em]"
        style={{ color: "var(--b-ink)", textWrap: "balance" }}
      >
        Tout ce qu&apos;il faut pour vendre depuis ta bio
      </h2>

      <div className="mt-9 grid gap-4.5 md:grid-cols-3">
        {/* 01 — Créer */}
        <article
          className="flex flex-col gap-3 rounded-[var(--r-xl)] p-7.5"
          style={{ background: "var(--b-lime)" }}
        >
          <span className="text-[13px] font-bold uppercase tracking-[.08em]">
            01 — Créer
          </span>
          <h3 className="text-[24px] font-bold tracking-[-0.02em]">
            Ta page en 3 minutes
          </h3>
          <p
            className="text-[15.5px] leading-[1.6]"
            style={{ color: "var(--b-olive)" }}
          >
            Liens, réseaux, catalogue — tout sur une adresse.{" "}
            {spell(READY_THEMES)} palettes prêtes, ou une palette tirée de tes
            propres couleurs, toutes lisibles.
          </p>
          {/* Les vraies couleurs de fond des thèmes, lues dans bio-themes.ts —
              la carte montre donc ce qu'elle promet. */}
          <div className="mt-auto flex flex-wrap gap-2 pt-4" aria-hidden>
            {THEME_SWATCHES.map((c) => (
              <span
                key={c}
                className="size-7 rounded-[var(--r-full)]"
                style={{ background: c, border: "1.5px solid rgb(0 0 0 / 12%)" }}
              />
            ))}
          </div>
        </article>

        {/* 02 — Vendre */}
        <article
          className="flex flex-col gap-3 rounded-[var(--r-xl)] p-7.5"
          style={{ background: "var(--b-ink)", color: "var(--b-on-dark)" }}
        >
          <span
            className="text-[13px] font-bold uppercase tracking-[.08em]"
            style={{ color: "var(--b-lime)" }}
          >
            02 — Vendre
          </span>
          <h3 className="text-[24px] font-bold tracking-[-0.02em]">
            Encaisse en Mobile Money
          </h3>
          <p
            className="text-[15.5px] leading-[1.6]"
            style={{ color: "var(--b-on-dark-muted)" }}
          >
            {spell(OPERATOR_COUNT)} opérateurs plus la carte. Chaque commande
            payée arrive sur ton WhatsApp avec la référence et le total.
          </p>
          <div
            className="mt-1.5 rounded-[var(--r-sm)] px-4 py-3.5"
            style={{ background: "var(--b-ink-2)" }}
          >
            <div
              className="text-[12.5px]"
              style={{ color: "var(--b-on-dark-faint)" }}
            >
              WhatsApp · 21 h 47
            </div>
            <div className="mt-1 text-[14.5px] font-semibold">
              Nouvelle commande — 15 000 F
            </div>
            <div
              className="mt-0.5 text-[12.5px]"
              style={{ color: "var(--b-on-dark-faint)" }}
            >
              Pagne wax · Réf. BL-1042 · payée en Wave
            </div>
          </div>
        </article>

        {/* 03 — Grandir */}
        <article
          className="flex flex-col gap-3 rounded-[var(--r-xl)] p-7.5"
          style={{
            background: "var(--b-paper)",
            border: "1px solid var(--b-line)",
          }}
        >
          <span
            className="text-[13px] font-bold uppercase tracking-[.08em]"
            style={{ color: "var(--b-green)" }}
          >
            03 — Grandir
          </span>
          <h3 className="text-[24px] font-bold tracking-[-0.02em]">
            Tes chiffres, pour toi seul
          </h3>
          <p
            className="text-[15.5px] leading-[1.6]"
            style={{ color: "var(--b-muted)" }}
          >
            Visites, clics par lien, commandes, revenu. Pas de pixel tiers, pas
            de revente.
          </p>
          <div
            className="mt-1.5 rounded-[var(--r-sm)] px-4 py-3.5"
            style={{ background: "var(--b-wash)" }}
          >
            {/* Étiqueté « exemple » : ces montants ne sont pas ceux de la
                plateforme, et un visiteur a le droit de le savoir. */}
            <p
              className="mb-2.5 text-[11px] font-bold uppercase tracking-[.1em]"
              style={{ color: "var(--b-faint)" }}
            >
              Exemple
            </p>
            <div className="flex flex-col gap-2 text-[14px]">
              {[
                ["Visites", "1 248", false],
                ["Commandes payées", "27", false],
                ["Revenu", "241 500 F", true],
              ].map(([label, value, green]) => (
                <div key={label as string} className="flex justify-between gap-3">
                  <span style={{ color: "var(--b-faint)" }}>{label}</span>
                  <strong style={green ? { color: "var(--b-green)" } : undefined}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Partager partout
// ---------------------------------------------------------------------------
//
// La maquette posait ici trois emplacements photo. Nous n'avons pas de photos
// à y mettre, et une photo d'inconnu tirée d'une banque d'images pour figurer
// « une vendeuse » ne vaut pas mieux qu'un faux témoignage. Le collage est
// donc construit en CSS : un produit, l'adresse, le QR code.

function ShareEverywhere() {
  return (
    <section className="pb-18">
      <div
        className="grid items-center gap-10 overflow-hidden rounded-[var(--r-2xl)] p-9 sm:p-12 lg:grid-cols-2 lg:gap-16"
        style={{ background: "var(--b-ink)", color: "var(--b-on-dark)" }}
      >
        <div>
          <h2
            className="max-w-[14ch] text-[clamp(32px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.03em]"
            style={{ color: "var(--b-lime)" }}
          >
            Partage ton bio-lien partout.
          </h2>
          <p
            className="mt-5 max-w-[46ch] text-[16px] leading-[1.65]"
            style={{ color: "var(--b-on-dark-muted)" }}
          >
            Colle ton adresse unique dans toutes tes bios — TikTok, Instagram,
            WhatsApp, YouTube — et imprime son QR code sur tes affiches, tes
            cartes et tes emballages pour ramener le monde réel vers ta page.
          </p>
          <Link
            href="/register"
            className="mt-7 inline-block rounded-[var(--r-full)] px-6.5 py-3.5 text-[15.5px] font-bold no-underline transition-colors hover:bg-[var(--b-lime)]"
            style={{ background: "var(--b-on-dark)", color: "var(--b-ink)" }}
          >
            Commencer gratuitement
          </Link>
        </div>

        <div className="grid w-full max-w-[460px] justify-self-center grid-cols-3 items-start gap-3.5">
          {/* Fiche produit */}
          <div
            className="flex -rotate-2 flex-col gap-2.5 rounded-[var(--r-lg)] p-3"
            style={{ background: "#E8B434" }}
          >
            <div
              className="aspect-square w-full rounded-[var(--r-xs)]"
              style={{
                background:
                  "linear-gradient(140deg,#F6D89A 0%,#D98E2B 55%,#8C5410 100%)",
              }}
              aria-hidden
            />
            <span
              className="text-center text-[14px] font-bold"
              style={{ color: "var(--b-ink)" }}
            >
              15 000 F
            </span>
          </div>

          {/* L'adresse */}
          <div className="mt-7 flex flex-col gap-3.5">
            <div
              className="aspect-4/5 w-full rounded-[var(--r-lg)]"
              style={{
                background:
                  "linear-gradient(160deg,#C9B8F0 0%,#9F86DE 50%,#5B3FA8 100%)",
              }}
              aria-hidden
            />
            <span
              className="whitespace-nowrap rounded-[var(--r-full)] px-3.5 py-2.5 text-center text-[14px] font-bold"
              style={{ background: "var(--b-paper)", color: "var(--b-ink)" }}
            >
              /@toi
            </span>
          </div>

          {/* QR code */}
          <div className="mt-2 flex flex-col gap-3.5">
            <div
              className="grid aspect-3/4 w-full rotate-2 place-items-center rounded-[var(--r-lg)] p-4"
              style={{ background: "var(--b-paper)" }}
            >
              <QrGlyph />
            </div>
            <div
              className="rounded-[var(--r-lg)] px-3.5 py-4"
              style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
            >
              <div className="text-[12px] font-bold uppercase tracking-[.08em]">
                QR code
              </div>
              <div
                className="mt-1 text-[13.5px] font-medium"
                style={{ color: "var(--b-olive)" }}
              >
                Affiches &amp; emballages
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Un QR décoratif, dessiné — pas un vrai code, il ne mène nulle part. */
function QrGlyph() {
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="9" height="9" rx="2" fill="var(--b-ink)" />
      <rect x={x + 2} y={y + 2} width="5" height="5" rx="1" fill="#fff" />
      <rect x={x + 3} y={y + 3} width="3" height="3" fill="var(--b-ink)" />
    </g>
  );
  const cells = [
    [12, 2], [16, 4], [20, 2], [22, 6], [12, 6], [18, 8], [14, 10],
    [2, 12], [6, 14], [10, 12], [4, 18], [8, 20], [2, 22], [12, 14],
    [16, 12], [20, 16], [14, 18], [18, 20], [22, 14], [12, 22], [20, 22],
  ];
  return (
    <svg viewBox="0 0 31 31" className="size-full" aria-hidden>
      {eye(0, 0)}
      {eye(22, 0)}
      {eye(0, 22)}
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="3"
          height="3"
          rx="0.6"
          fill="var(--b-ink)"
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tarifs
// ---------------------------------------------------------------------------
//
// Les montants viennent de PREPAID_PRICES — la table que le paiement Mobile
// Money applique vraiment. La remise annuelle est recalculée, pas recopiée.

const PLANS = [
  {
    name: "Découverte",
    price: "0 F",
    unit: " / pour toujours",
    features: [
      "Page, liens et statistiques",
      "5 produits en boutique",
      "Commission 5 % par vente",
    ],
    cta: "Commencer",
    href: "/register",
    featured: false,
  },
  {
    name: "Pro",
    price: fcfa(PREPAID_PRICES.pro[1]),
    unit: " / mois",
    year: `${fcfa(PREPAID_PRICES.pro[12])} l'année — économise ${prepaidSavingsPercent("pro", 12)} %`,
    features: [
      "Produits illimités",
      "0 % de commission",
      "Rédaction assistée par IA",
      "Statistiques détaillées",
    ],
    cta: "Passer Pro",
    href: "/pricing",
    featured: true,
  },
  {
    name: "Starter",
    price: fcfa(PREPAID_PRICES.starter[1]),
    unit: " / mois",
    year: `${fcfa(PREPAID_PRICES.starter[12])} l'année — économise ${prepaidSavingsPercent("starter", 12)} %`,
    features: [
      "20 produits en boutique",
      "Commission réduite à 3 %",
      "Périodes prépayées 1 / 3 / 12 mois",
    ],
    cta: "Choisir Starter",
    href: "/pricing",
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="tarifs" className="pb-18">
      <h2
        className="text-center text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.03em]"
        style={{ color: "var(--b-ink)" }}
      >
        Des tarifs simples, en FCFA
      </h2>
      <p
        className="mx-auto mt-4 max-w-[48ch] text-center text-[16px]"
        style={{ color: "var(--b-muted)" }}
      >
        Payables en Mobile Money, d&apos;avance — un mois, trois mois ou
        l&apos;année. Jamais de prélèvement automatique.
      </p>

      <div className="mt-10 grid items-stretch gap-4.5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className="relative flex flex-col gap-3.5 rounded-[var(--r-xl)] p-8"
            style={
              plan.featured
                ? { background: "var(--b-ink)", color: "var(--b-on-dark)" }
                : {
                    background: "var(--b-paper)",
                    border: "1px solid var(--b-line)",
                  }
            }
          >
            {plan.featured && (
              <span
                className="absolute right-6 top-6 rounded-[var(--r-full)] px-3.5 py-1.5 text-[12.5px] font-bold"
                style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
              >
                Populaire
              </span>
            )}

            <h3 className="text-[20px] font-bold">{plan.name}</h3>
            <div className="text-[40px] font-bold tracking-[-0.03em]">
              {plan.price}
              <span
                className="text-[15px] font-medium"
                style={{
                  color: plan.featured
                    ? "var(--b-on-dark-faint)"
                    : "var(--b-faint)",
                }}
              >
                {plan.unit}
              </span>
            </div>
            {plan.year && (
              <div
                className="text-[13.5px] font-semibold"
                style={{
                  color: plan.featured ? "var(--b-lime)" : "var(--b-green)",
                }}
              >
                {plan.year}
              </div>
            )}

            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {plan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    color: plan.featured
                      ? "var(--b-on-dark-muted)"
                      : "var(--b-muted)",
                  }}
                >
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className="mt-auto rounded-[var(--r-full)] py-3.5 text-center text-[15px] font-semibold no-underline"
              style={
                plan.featured
                  ? { background: "var(--b-lime)", color: "var(--b-ink)" }
                  : {
                      background: "var(--b-wash)",
                      border: "1px solid var(--b-line)",
                      color: "var(--b-ink)",
                    }
              }
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Questions fréquentes
// ---------------------------------------------------------------------------

const FAQ = [
  {
    q: "Comment mes clients paient-ils ?",
    a: `En Mobile Money — Orange Money, Wave, MTN MoMo, Moov, M-Pesa et ${OPERATOR_COUNT - 5} autres — ou par carte bancaire. Le client choisit, paie, et tu reçois la confirmation sur WhatsApp.`,
  },
  {
    q: "Dois-je donner ma carte bancaire ?",
    a: "Non. Les plans payants s'achètent d'avance en Mobile Money : un mois, trois mois ou l'année. La période court, puis s'arrête — aucun prélèvement automatique.",
  },
  {
    q: "Que se passe-t-il si j'arrête de payer ?",
    a: "Ta page reste en ligne, entière, sur le plan Découverte : tes liens, cinq produits, tes statistiques. Tu repasses au plan payant quand tu veux.",
  },
  {
    q: "Puis-je changer l'apparence de ma page ?",
    a: `Oui — ${spell(READY_THEMES).toLowerCase()} palettes prêtes, ou une palette dérivée de tes propres couleurs, avec un aperçu en direct dans tes réglages.`,
  },
  {
    q: "Qui peut voir mes commandes et mes chiffres ?",
    a: "Toi seul. Les commandes, les coordonnées de tes clients et tes statistiques sont rattachées à ton compte, et la base de données refuse de les servir à quelqu'un d'autre. Ce n'est pas un filtre dans le code : c'est une règle en dessous.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[760px] pb-18">
      <h2
        className="mb-7 text-center text-[clamp(28px,3.2vw,42px)] font-bold tracking-[-0.03em]"
        style={{ color: "var(--b-ink)" }}
      >
        Questions fréquentes
      </h2>
      <div className="flex flex-col gap-3">
        {FAQ.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-[var(--r-lg)] px-6 py-5"
            style={{
              background: "var(--b-paper)",
              border: "1px solid var(--b-line)",
            }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <span
                className="shrink-0 text-[18px] transition-transform group-open:rotate-45"
                style={{ color: "var(--b-faint)" }}
                aria-hidden
              >
                +
              </span>
            </summary>
            <p
              className="mt-3 text-[15px] leading-[1.6]"
              style={{ color: "var(--b-muted)" }}
            >
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Appel final
// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="pb-14">
      <div
        className="rounded-[var(--r-2xl)] px-6 py-11 text-center sm:px-14 sm:py-18"
        style={{ background: "var(--b-ink)", color: "var(--b-on-dark)" }}
      >
        <h2
          className="text-[clamp(32px,4.4vw,56px)] font-bold leading-[1.05] tracking-[-0.03em]"
          style={{ color: "var(--b-lime)" }}
        >
          Ton adresse t&apos;attend.
        </h2>
        <p
          className="mx-auto mt-4.5 max-w-[44ch] text-[16px] leading-[1.6]"
          style={{ color: "var(--b-on-dark-muted)" }}
        >
          La page se monte en trois minutes. La première vente peut tomber ce
          soir.
        </p>
        <ClaimField dark />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pied de page
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3.5 pb-10 pt-2 text-[13.5px]"
      style={{ color: "var(--b-faint)" }}
    >
      <Wordmark className="text-[15px]" href={null} />
      <span>La vitrine tout-en-un des créateurs et entrepreneurs africains</span>
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/legal/privacy" className="no-underline hover:text-[var(--b-ink)]" style={{ color: "inherit" }}>
          Confidentialité
        </Link>
        <Link href="/legal/terms" className="no-underline hover:text-[var(--b-ink)]" style={{ color: "inherit" }}>
          Conditions
        </Link>
        <Link href="/legal/mentions" className="no-underline hover:text-[var(--b-ink)]" style={{ color: "inherit" }}>
          Mentions légales
        </Link>
      </span>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen font-[family-name:var(--font-brand)]"
      style={{ background: "var(--b-canvas)", color: "var(--b-ink)" }}
    >
      {/* Entités du site, déclarées ici et pas dans le layout racine : elles
          viendraient sinon concurrencer le nom du vendeur sur chaque
          boutique. */}
      <JsonLd data={organizationJsonLd(SITE_URL)} />
      <JsonLd data={websiteJsonLd(SITE_URL)} />

      <BrandBackdrop variant="full" />

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-14">
        <Nav />
        <main>
          <Hero />
          <Operators />
          <Features />
          <ShareEverywhere />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
