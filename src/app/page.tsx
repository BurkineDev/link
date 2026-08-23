"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Package,
  Link2,
  Headphones,
  Check,
  Camera,
  ChevronRight,
  Globe2,
  Link2,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Palette,
  Play,
  ShoppingBag,
  Sparkles,
  X,
  ChevronRight,
  Sparkles,
  Hammer,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";
import { cn } from "@/lib/utils";

const benefits = [
  { icon: Link2, title: "Tous tes liens. Enfin réunis.", text: "Réseaux, boutique, WhatsApp et contenus : une seule adresse simple à partager." },
  { icon: Sparkles, title: "Une page qui te ressemble", text: "Couleurs, typographies, blocs et bio assistée par IA. Aucun code à écrire." },
  { icon: BarChart3, title: "Comprends ton audience", text: "Découvre ce qui attire les clics et améliore ta page avec des données claires." },
];

const templates = [
  { name: "Soraya", role: "Mode & lifestyle", bg: "#f5d6c6", accent: "#ff5d35", avatar: "S", links: ["Ma nouvelle collection", "Shopper mes looks"] },
  { name: "Kader Beats", role: "Artiste · Producteur", bg: "#d8f83d", accent: "#111111", avatar: "K", links: ["Écouter le nouvel EP", "YouTube"] },
  { name: "Studio Noma", role: "Design & création", bg: "#c8b9ff", accent: "#5b36e8", avatar: "N", links: ["Voir nos projets", "Nous contacter"] },
];

function CreatorPhone({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto ${compact ? "w-[220px]" : "w-[286px] sm:w-[310px]"}`}>
      <div className="absolute -inset-10 rounded-full bg-[#ffda46]/25 blur-3xl" />
      <motion.div
        initial={{ y: 18, opacity: 0, rotate: 2 }}
        animate={{ y: 0, opacity: 1, rotate: -2 }}
        transition={{ duration: .7, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[2.8rem] border-[7px] border-[#171717] bg-[#f8efd7] p-3 shadow-[0_32px_80px_rgba(24,20,12,.22)]"
      >
        <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-[#171717]" />
        <div className="rounded-[2rem] bg-[#fffaf0] px-4 pb-5 pt-3 text-center">
          <div className="mb-3 flex justify-between text-[#1f1c16]"><Globe2 className="size-4" /><MoreHorizontal className="size-4" /></div>
          <div className="relative mx-auto mb-3 grid size-20 place-items-center overflow-hidden rounded-full bg-[#153c32] text-3xl font-black text-[#ffda46] ring-4 ring-white shadow-md">
            AS
            <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-white bg-[#65c38c]" />
          </div>
          <p className="text-lg font-black">Awa Studio</p>
          <p className="mt-1 text-xs leading-relaxed text-black/55">Créatrice, entrepreneure & amoureuse<br />des belles choses ✨</p>
          <div className="mt-3 flex justify-center gap-3"><Camera className="size-4" /><Music2 className="size-4" /><Video className="size-4" /></div>
          <div className="mt-4 space-y-2.5 text-left text-xs font-bold">
            <div className="flex items-center gap-3 rounded-2xl bg-[#ffda46] p-2.5 pr-3 shadow-[3px_3px_0_#171717]"><span className="grid size-9 place-items-center rounded-xl bg-white"><ShoppingBag className="size-4" /></span><span className="flex-1">Découvre ma boutique</span><ChevronRight className="size-4" /></div>
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-2.5 pr-3"><span className="grid size-9 place-items-center rounded-xl bg-[#f0e9ff]"><Play className="size-4" /></span><span className="flex-1">Ma dernière vidéo</span><ChevronRight className="size-4" /></div>
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-2.5 pr-3"><span className="grid size-9 place-items-center rounded-xl bg-[#dbf6e7]"><MessageCircle className="size-4" /></span><span className="flex-1">Discutons sur WhatsApp</span><ChevronRight className="size-4" /></div>
          </div>
          <p className="mt-5 text-[10px] font-black tracking-tight">Bio<span className="text-[#dc552f]">-Lien</span></p>
        </div>
      </motion.div>
      {!compact && <>
        <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -right-8 top-28 rounded-2xl border border-black/5 bg-white px-4 py-3 text-xs font-bold shadow-xl"><span className="mr-2 text-[#5c35e8]">↗</span> +48 clics aujourd’hui</motion.div>
        <motion.div animate={{ y: [0,7,0] }} transition={{ duration: 3.5, repeat: Infinity }} className="absolute -left-10 bottom-24 rounded-2xl bg-[#153c32] px-4 py-3 text-xs font-bold text-white shadow-xl">● En ligne</motion.div>
      </>}
    </div>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Logo size="sm" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Explorer", href: "/explore" },
            { label: "Outils gratuits", href: "/outils" },
            { label: "Fonctionnalités", href: "#features" },
            { label: "Tarifs", href: "/pricing" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Connexion</Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            asChild
          >
            <Link href="/register">
              Créer ma page
              <ChevronRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors touch-target"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t border-black/[0.06] bg-white"
        >
          <nav className="flex flex-col px-4 py-4 gap-1">
            {[
              { label: "Explorer", href: "/explore" },
              { label: "Outils gratuits", href: "/outils" },
              { label: "Fonctionnalités", href: "#features" },
              { label: "Tarifs", href: "/pricing" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-muted last:border-0"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Connexion</Link>
              </Button>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                asChild
              >
                <Link href="/register">Créer ma page gratuitement</Link>
              </Button>
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden bg-foreground">
      {/* Subtle dot pattern overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div className="text-white">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* « Plateforme #1 » a été retiré : invérifiable, et surtout
                  contre-productif. L'obstacle du visiteur n'est pas de savoir
                  si on est les meilleurs — c'est de croire que c'est
                  technique. Autant répondre à ça tout de suite. */}
              <Badge className="mb-6 bg-primary text-primary-foreground border-0 hover:bg-primary/90 text-sm px-3 py-1 font-semibold">
                Aucune compétence technique
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6"
            >
              Un seul lien dans ta bio.{" "}
              <span className="bg-primary text-primary-foreground rounded-lg px-2 inline-block">
                Et tu vends dessus.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="text-lg sm:text-xl text-white/85 mb-8 leading-relaxed max-w-lg"
            >
              Tes réseaux, tes produits, ton WhatsApp — réunis sur une page à
              toi, au lieu de liens qui traînent partout. Tu colles ton lien,
              on reconnaît TikTok, Instagram ou YouTube tout seuls. Et le jour
              où tu veux vendre, tu encaisses en Mobile Money ou par carte.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base h-12 px-7 border-0"
                asChild
              >
                <Link href="/register">
                  Créer ma page gratuite
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold text-base h-12 px-7"
                asChild
              >
                <Link href="/explore">Voir les boutiques</Link>
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-5 text-sm text-white/60 flex items-center gap-2"
            >
              <Check className="size-4 text-white/80" />
              Gratuit pour commencer · Sans carte bancaire · En ligne en 5 minutes
            </motion.p>
          </div>

          {/* Right: Phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center lg:justify-end"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar() {
  const stats = [
    { value: "5 min", label: "pour être en ligne" },
    // « Stripe » ne dit rien à quelqu'un qui paie en Mobile Money ; le nom du
    // prestataire n'est pas un argument, le moyen de paiement en est un.
    { value: "Mobile Money", label: "ou carte bancaire" },
    { value: "@toi", label: "ton lien à partager" },
    { value: "0 FCFA", label: "pour démarrer" },
  ];

  return (
    <section className="py-10 border-y border-muted bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-muted">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.08} className="text-center px-4">
              <p className="text-2xl sm:text-3xl font-black text-foreground mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Crée ton compte",
      subtitle: "30 secondes",
      description:
        "Inscris-toi gratuitement avec ton email ou ton compte Google. Aucune carte bancaire requise.",
      emoji: "🚀",
      bg: "bg-[var(--primary)]/10",
      border: "border-[var(--primary)]/30",
    },
    {
      number: "02",
      title: "Colle tes liens",
      subtitle: "Rien à configurer",
      description:
        "Ton TikTok, ton Instagram, ton WhatsApp. Tu colles l'adresse, on reconnaît la plateforme et on remplit le reste. Tes produits viennent après, si tu en vends.",
      emoji: "🔗",
      bg: "bg-muted",
      border: "border-border",
    },
    {
      number: "03",
      title: "Partage et encaisse",
      subtitle: "Ton lien bio-lien.com/@toi",
      description:
        "Mets-le dans ta bio TikTok, Instagram, WhatsApp. Et le jour où tu vends, tu es payé en Mobile Money ou par carte.",
      emoji: "💰",
      bg: "bg-[var(--success)]/10",
      border: "border-[var(--success)]/30",
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white" id="how-it-works">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Comment ça marche
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Simple comme{" "}
            <span className="text-primary">bonjour</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Trois étapes, et ta page est en ligne. Rien à installer, rien à
            paramétrer.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border" />

          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.12}>
              <Card className={cn("relative overflow-hidden border-2 h-full", step.border, step.bg)}>
                <CardContent className="p-6">
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl flex-shrink-0 border border-border">
                        {step.emoji}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Étape {step.number}
                        </span>
                        <h3 className="text-xl font-black mt-0.5">{step.title}</h3>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {step.subtitle}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

function Features() {
  const features = [
    {
      icon: Smartphone,
      title: "Paiement sécurisé",
      description:
        "Tes clients paient par carte bancaire via Stripe ou par Mobile Money (Wave, Orange, MTN, Moov) via Genius Pay — sécurisé et fiable.",
      color: "text-foreground",
      bg: "bg-[var(--primary)]/15",
    },
    {
      icon: Zap,
      title: "Templates professionnels",
      description:
        "Boutique prête en minutes. Choisis parmi des designs pensés pour les créateurs africains.",
      color: "text-foreground",
      bg: "bg-[var(--primary)]/15",
    },
    {
      icon: Package,
      title: "Suivi des stocks",
      // « Alertes automatiques quand le stock est bas » a été retiré : cette
      // fonctionnalité n'existe nulle part dans le code. Ce qui suit décrit
      // ce que `reserve_stock` fait réellement.
      description:
        "Le compteur baisse à chaque commande payée, et un article épuisé n'est plus commandable.",
      color: "text-[var(--success)]",
      bg: "bg-[var(--success)]/10",
    },
    {
      icon: BarChart3,
      title: "Analytics en temps réel",
      description:
        "Vues, conversions, revenus. Comprends ce qui se vend et optimise ta boutique.",
      color: "text-[var(--success)]",
      bg: "bg-[var(--success)]/10",
    },
    {
      icon: Link2,
      title: "Lien @username unique",
      description:
        "bio-lien.com/@ton-nom — facile à partager, à retenir et à promouvoir sur tous tes réseaux.",
      color: "text-foreground",
      bg: "bg-muted",
    },
    {
      icon: Headphones,
      title: "Un vrai humain te répond",
      // Disait « Support 24/7 — notre équipe basée en Afrique répond en
      // français, anglais et langues locales ». Rien de tout cela n'est vrai
      // aujourd'hui : ni l'astreinte permanente, ni l'équipe, ni les langues.
      // Une promesse de support invérifiable se paie au premier client déçu.
      description:
        "Écris à support@bio-lien.com et une personne te répond en français. Pas de robot, pas de formulaire à rallonge.",
      color: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-muted/30" id="features">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Fonctionnalités
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Tout ce qu&apos;il te faut pour{" "}
            <span className="text-primary">vendre en ligne</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Des outils puissants, conçus spécifiquement pour les réalités du
            marché africain.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 0.07}>
              <Card className="h-full border border-black/[0.06] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-white">
                <CardContent className="p-6">
                  <div
                    className={cn(
                      "size-12 rounded-2xl flex items-center justify-center mb-4",
                      feature.bg
                    )}
                  >
                    <feature.icon className={cn("size-6", feature.color)} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Templates showcase
// ---------------------------------------------------------------------------

function TemplateCard({
  name,
  tag,
  headerBg,
  headerText,
  products,
}: {
  name: string;
  tag: string;
  headerBg: string;
  headerText: string;
  products: { emoji: string; name: string; price: string }[];
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow duration-200 bg-card">
      {/* Header */}
      <div className={cn("h-24 flex items-center justify-center", headerBg)}>
        <div className={cn("text-center", headerText)}>
          <p className="text-xl font-black">{name}</p>
          <Badge className="mt-1 bg-white/15 border-white/25 text-[11px]" style={{ color: "inherit" }}>
            {tag}
          </Badge>
        </div>
      </div>

      {/* Product list */}
      <div className="p-4 space-y-2.5">
        {products.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-muted"
          >
            <span className="text-xl">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-xs text-foreground font-bold">{p.price}</p>
            </div>
            <button className="text-[10px] font-bold bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:opacity-90 transition-opacity">
              Acheter
            </button>
          </div>
        ))}
        <div className="pt-1">
          <div className="w-full h-8 rounded-xl bg-foreground text-background flex items-center justify-center text-xs font-bold">
            Voir la boutique
          </div>
        </div>
      </div>
    </div>
  );
}

function Templates() {
  const templates = [
    {
      name: "Vibrant",
      tag: "Mode & Beauté",
      headerBg: "bg-primary",
      headerText: "text-primary-foreground",
      products: [
        { emoji: "👗", name: "Robe Wax Ankara", price: "12 500 FCFA" },
        { emoji: "👒", name: "Chapeau Raphia", price: "4 200 FCFA" },
        { emoji: "💄", name: "Rouge à lèvres nat.", price: "2 800 FCFA" },
      ],
    },
    {
      name: "Minimaliste",
      tag: "Artisanat & Design",
      headerBg: "bg-foreground",
      headerText: "text-background",
      products: [
        { emoji: "🏺", name: "Vase en Terre cuite", price: "18 000 FCFA" },
        { emoji: "🖼️", name: "Tableau Batik", price: "35 000 FCFA" },
        { emoji: "🪑", name: "Tabouret Ashanti", price: "22 000 FCFA" },
      ],
    },
    {
      name: "Market",
      tag: "Alimentaire & Bio",
      headerBg: "bg-[var(--success)]",
      headerText: "text-[var(--success-foreground)]",
      products: [
        { emoji: "🧴", name: "Beurre de Karité pur", price: "5 500 FCFA" },
        { emoji: "🌿", name: "Tisane Moringa bio", price: "3 200 FCFA" },
        { emoji: "🍯", name: "Miel d'acacia", price: "7 800 FCFA" },
      ],
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white" id="templates">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Templates
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Des boutiques{" "}
            <span className="text-primary">qui vendent</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            3 templates professionnels, personnalisables à l&apos;infini. Lance ta
            boutique avec style.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1}>
              <TemplateCard {...t} />
            </FadeIn>
          ))}
        </div>

        <FadeIn className="text-center mt-10">
          <Button
            variant="outline"
            size="lg"
            className="border-primary text-foreground hover:bg-primary hover:text-primary-foreground"
            asChild
          >
            <Link href="/register">
              Voir tous les templates
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// "For whom it's built" — honest, pre-launch replacement for fake testimonials.
// Three real target personas instead of invented users.
// ---------------------------------------------------------------------------

function ForWhom() {
  const personas = [
    {
      icon: Sparkles,
      title: "Créateurs de contenu",
      tagline: "TikTok · Instagram · Snapchat",
      description:
        "Tu as une audience qui te demande où acheter tes produits. Bio-Lien te donne un lien propre à mettre dans ta bio.",
      iconBg: "bg-primary/10",
      iconText: "text-primary",
    },
    {
      icon: Hammer,
      title: "Artisans & makers",
      tagline: "Mode · Cosmétiques · Décoration",
      description:
        "Tu vends ce que tu crées toi-même. Présente ton catalogue proprement, sans avoir à coder une boutique complète.",
      iconBg: "bg-[var(--success)]/10",
      iconText: "text-[var(--success)]",
    },
    {
      icon: MessageCircle,
      title: "Vendeurs WhatsApp",
      tagline: "Mobile-first · Mode WhatsApp natif",
      description:
        "Tes clients commandent déjà en DM. Active le mode WhatsApp et chaque produit ouvre une discussion pré-remplie chez toi.",
      iconBg: "bg-foreground/10",
      iconText: "text-foreground",
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Pour qui c&apos;est fait
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Bio-Lien, c&apos;est pour{" "}
            <span className="text-primary">les vendeurs sociaux</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Si tu vends déjà via tes vidéos, tes stories ou tes statuts WhatsApp,
            tu es exactement la bonne personne pour démarrer.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {personas.map((p, i) => {
            const Icon = p.icon;
            return (
              <FadeIn key={p.title} delay={i * 0.08}>
                <Card className="h-full border border-black/[0.06] bg-white hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div
                      className={cn(
                        "size-12 rounded-2xl flex items-center justify-center mb-5",
                        p.iconBg,
                      )}
                    >
                      <Icon className={cn("size-6", p.iconText)} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      {p.tagline}
                    </p>
                    <h3 className="text-xl font-black mb-3">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-foreground/70 flex-1">
                      {p.description}
                    </p>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-12 max-w-xl mx-auto text-center rounded-2xl border border-primary/20 bg-primary/[0.04] px-6 py-5">
            <p className="text-sm font-semibold text-foreground">
              Bio-Lien démarre. Rejoins les premiers vendeurs.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tu peux explorer les boutiques déjà publiées sur{" "}
              <Link
                href="/explore"
                className="text-primary font-semibold hover:underline"
              >
                /explore
              </Link>
              .
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

function Pricing() {
  const tiers = [
    {
      id: "free",
      name: "Découverte",
      price: "0",
      currency: "$CA",
      tagline: "Pour démarrer et tester ta boutique",
      bullets: [
        "Jusqu'à 5 produits",
        "Lien @username unique",
        "Paiement carte + Mobile Money",
        "Mode WhatsApp inclus",
        "Templates inclus",
      ],
      cta: "Commencer gratuitement",
      ctaHref: "/register",
      footnote: "5 % de commission sur chaque vente.",
      highlight: false,
    },
    {
      id: "starter",
      name: "Starter",
      price: "4,99",
      currency: "$CA",
      tagline: "Pour les vendeurs qui dépassent 5 produits",
      bullets: [
        "Jusqu'à 20 produits",
        "Commission réduite à 3 %",
        "Suppression du badge Bio-Lien",
        "Analytics standard",
      ],
      cta: "Voir les détails",
      ctaHref: "/pricing",
      footnote: "Sans engagement.",
      highlight: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "9,99",
      currency: "$CA",
      tagline: "Pour les créateurs sérieux qui veulent grandir",
      bullets: [
        "Produits illimités",
        "0 % de commission sur tes ventes",
        "Analytics avancés",
        "Templates premium",
        "Support prioritaire",
      ],
      cta: "Passer en Pro",
      ctaHref: "/pricing",
      footnote: "Sans engagement. Annule à tout moment.",
      highlight: true,
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white" id="pricing">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Tarifs
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Commence <span className="text-primary">gratuitement</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Pas de frais cachés. Monte d&apos;un palier le jour où ta boutique
            décolle.
          </p>
        </FadeIn>

        <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
          {tiers.map((tier, i) => (
            <FadeIn key={tier.id} delay={0.05 + i * 0.05}>
              <Card
                className={cn(
                  "h-full relative overflow-hidden",
                  tier.highlight
                    ? "border-2 border-primary shadow-lg shadow-primary/10"
                    : "border-2 border-border/60",
                )}
              >
                {tier.highlight && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground">
                      Recommandé
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-6">
                    <p
                      className={cn(
                        "text-sm font-semibold uppercase tracking-widest mb-2",
                        tier.highlight ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {tier.name}
                    </p>
                    <p className="text-4xl font-black">
                      {tier.price} {tier.currency}
                      <span className="text-base font-normal text-muted-foreground ml-1">
                        / mois
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tier.tagline}
                    </p>
                  </div>

                  <Button
                    className={cn(
                      "w-full mb-6 h-11 font-semibold",
                      tier.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                        : "bg-foreground text-background hover:bg-foreground/90 border-0",
                    )}
                    asChild
                  >
                    <Link href={tier.ctaHref}>{tier.cta}</Link>
                  </Button>

                  <ul className="space-y-3">
                    {tier.bullets.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div
                          className={cn(
                            "size-5 rounded-full flex items-center justify-center flex-shrink-0",
                            tier.highlight ? "bg-primary" : "bg-primary/10",
                          )}
                        >
                          <Check
                            className={cn(
                              "size-3",
                              tier.highlight
                                ? "text-primary-foreground"
                                : "text-primary",
                            )}
                          />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/60">
                    {tier.footnote}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Facturation en dollars canadiens — ta carte convertit
          automatiquement.{" "}
          <Link href="/pricing" className="text-primary font-semibold hover:underline">
            Voir tous les détails
          </Link>
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCTA() {
  const [email, setEmail] = useState("");

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden bg-foreground">
      <div
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-3xl mx-auto px-4 text-center text-background">
        <FadeIn>
          <div className="text-5xl mb-6">🌍</div>
          <h2 className="text-3xl sm:text-5xl font-black mb-4 leading-tight">
            Ta page, gratuitement
          </h2>
          {/* Disait « trois minutes » quand l'accroche promet cinq. Une
              promesse qui varie d'un bout à l'autre de la page ne rassure
              personne. */}
          <p className="text-lg sm:text-xl text-background/80 mb-10 max-w-xl mx-auto">
            Cinq minutes pour réunir tes liens, avoir ton adresse à toi, et la
            mettre dans ta bio. Pas de carte bancaire, pas d&apos;engagement.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-background placeholder:text-background/50 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:bg-white/15 transition-colors text-sm"
            />
            <Button
              className="h-12 px-6 bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex-shrink-0 border-0"
              asChild
            >
              <Link
                href={`/register${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              >
                Commencer gratuitement
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-background/60">
            Tu peux explorer les boutiques déjà publiées sur{" "}
            <Link
              href="/explore"
              className="underline hover:text-background transition-colors"
            >
              /explore
            </Link>
            .
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Logo size="sm" href="/" />
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              La plateforme de boutique en ligne pensée pour les créateurs et
              entrepreneurs africains.
            </p>
            <a
              href="mailto:support@bio-lien.com"
              className="inline-block mt-5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              support@bio-lien.com
            </a>
          </div>

          {/* Produit */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-4">
              Produit
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Fonctionnalités", href: "#features" },
                { label: "Tarifs", href: "/pricing" },
                { label: "Explorer", href: "/explore" },
                { label: "Outils gratuits", href: "/outils" },
              ].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="hover:text-white transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

      <section id="why" className="px-5 py-24 sm:py-32"><div className="mx-auto max-w-7xl"><div className="mb-14 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-xs font-black uppercase tracking-[.2em] text-[#dc552f]">Plus qu’un arbre de liens</p><h2 className="max-w-2xl text-4xl font-black leading-tight tracking-[-.04em] sm:text-6xl">Ta présence digitale,<br />sans la prise de tête.</h2></div><p className="max-w-sm text-black/55">Simple à créer. Beau à regarder. Puissant pour grandir.</p></div><div className="grid gap-4 md:grid-cols-3">{benefits.map((item, i) => <motion.article key={item.title} whileHover={{ y: -6 }} className={`rounded-[2rem] border border-black/10 p-7 sm:p-9 ${i===1 ? "bg-[#153c32] text-white" : i===2 ? "bg-[#f3ecff]" : "bg-[#ffed9d]"}`}><div className={`mb-12 grid size-12 place-items-center rounded-2xl ${i===1 ? "bg-[#ffda46] text-black" : "bg-white"}`}><item.icon /></div><h3 className="text-2xl font-black tracking-tight">{item.title}</h3><p className={`mt-3 leading-relaxed ${i===1 ? "text-white/65" : "text-black/55"}`}>{item.text}</p></motion.article>)}</div></div></section>

      <section id="product" className="bg-[#f1ede4] px-5 py-24 sm:py-32"><div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2"><div className="relative min-h-[570px] overflow-hidden rounded-[3rem] bg-[#dc552f] p-10"><div className="absolute -bottom-20 -left-10 size-80 rounded-full bg-[#ffda46]" /><div className="absolute -right-14 top-12 size-52 rounded-full border-[35px] border-[#c8b9ff]" /><CreatorPhone compact /><div className="absolute bottom-7 right-7 rounded-2xl bg-white p-4 shadow-xl"><BarChart3 className="mb-3 text-[#5b36e8]" /><p className="text-2xl font-black">2 849</p><p className="text-xs text-black/50">vues ce mois</p></div></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#dc552f]">Ton copilote créatif</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-.04em] sm:text-6xl">Tu imagines.<br />Bio-Lien fait le reste.</h2><div className="mt-10 space-y-7">{[{icon:Sparkles,t:"Une bio brillante grâce à l’IA"},{icon:Palette,t:"Des thèmes vraiment personnalisables"},{icon:Zap,t:"Des liens détectés et habillés automatiquement"},{icon:BarChart3,t:"Des statistiques lisibles, enfin"}].map(({icon:Icon,t})=><div key={t} className="flex items-center gap-4 border-b border-black/10 pb-6"><span className="grid size-11 place-items-center rounded-xl bg-white"><Icon className="size-5" /></span><p className="font-bold">{t}</p></div>)}</div></div></div></section>

      <section id="templates" className="px-5 py-24 sm:py-32"><div className="mx-auto max-w-7xl text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-[#5b36e8]">Trouve ton style</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">Pas un profil comme les autres.</h2><p className="mx-auto mt-5 max-w-xl text-black/55">Pars d’un template et rends-le totalement unique. Change tout, quand tu veux.</p><div className="mt-14 grid gap-5 md:grid-cols-3">{templates.map((t, i)=><motion.div key={t.name} whileHover={{ y:-8, rotate: i===1 ? 1 : -1 }} className="rounded-[2.2rem] border border-black/10 p-3 text-left shadow-sm" style={{background:t.bg}}><div className="rounded-[1.7rem] bg-white/75 p-6 text-center backdrop-blur"><div className="mx-auto grid size-16 place-items-center rounded-full text-2xl font-black text-white" style={{background:t.accent}}>{t.avatar}</div><h3 className="mt-4 text-xl font-black">{t.name}</h3><p className="text-xs text-black/50">{t.role}</p><div className="mt-6 space-y-2">{t.links.map(link=><div key={link} className="rounded-xl px-4 py-3 text-xs font-bold text-white" style={{background:t.accent}}>{link}</div>)}</div></div></motion.div>)}</div><Link href="/register" className="mt-10 inline-flex items-center gap-2 rounded-full border-2 border-black px-6 py-3 text-sm font-black">Voir tous les templates <ArrowRight className="size-4" /></Link></div></section>

const SITE_URL = "https://www.bio-lien.com";

export default function LandingPage() {
  return (
    <>
      {/* Entités du site, déclarées une seule fois et ici : les mettre dans le
          layout racine les collerait aussi sur chaque boutique de vendeur, où
          « Bio-Lien » viendrait concurrencer le nom du vendeur. */}
      <JsonLd data={organizationJsonLd(SITE_URL)} />
      <JsonLd data={websiteJsonLd(SITE_URL)} />
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <HowItWorks />
        <Features />
        <Templates />
        <ForWhom />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
