"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Smartphone,
  Zap,
  BarChart3,
  Package,
  Link2,
  Headphones,
  Star,
  Check,
  ArrowRight,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Animation helper
// ---------------------------------------------------------------------------

function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const initialY = direction === "up" ? 32 : 0;
  const initialX =
    direction === "left" ? -32 : direction === "right" ? 32 : 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: initialY, x: initialX }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Phone mockup
// ---------------------------------------------------------------------------

function PhoneMockup() {
  const products = [
    { name: "Robe Wax Ankara", price: "12 500 FCFA", bg: "bg-[var(--primary)]", emoji: "👗" },
    { name: "Sac en Raphia", price: "8 000 FCFA", bg: "bg-[var(--success)]", emoji: "👜" },
    { name: "Bijoux Artisanaux", price: "5 500 FCFA", bg: "bg-foreground", emoji: "💍" },
    { name: "Huile de Karité", price: "3 200 FCFA", bg: "bg-[var(--primary)]", emoji: "🧴" },
  ];

  return (
    <div className="relative mx-auto w-[240px] sm:w-[260px]">
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-white/20 blur-2xl scale-110" />

      {/* Phone shell */}
      <div className="relative bg-gray-900 rounded-[2.5rem] p-[3px] shadow-2xl">
        <div className="bg-white rounded-[2.3rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[9px] font-semibold text-gray-600">
            <span>9:41</span>
            <div className="w-20 h-4 bg-gray-900 rounded-full" />
            <span>●●●</span>
          </div>

          {/* Shop header */}
          <div className="px-3 pb-3">
            <div className="bg-foreground rounded-2xl p-3 text-background text-center">
              <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg mx-auto mb-1">
                🛍️
              </div>
              <p className="font-bold text-sm">Awa Style</p>
              <p className="text-[10px] opacity-80">@awa.style · Dakar, SN</p>
              <div className="flex justify-center gap-1 mt-2">
                <span className="bg-white/15 text-[9px] rounded-full px-2 py-0.5">Mode</span>
                <span className="bg-white/15 text-[9px] rounded-full px-2 py-0.5">Artisanat</span>
              </div>
            </div>
          </div>

          {/* Products grid */}
          <div className="px-2 pb-3 grid grid-cols-2 gap-1.5">
            {products.map((p) => (
              <div key={p.name} className="rounded-xl overflow-hidden bg-gray-50 border border-black/[0.04]">
                <div className={`h-16 ${p.bg} flex items-center justify-center text-2xl`}>
                  {p.emoji}
                </div>
                <div className="p-1.5">
                  <p className="text-[9px] font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[9px] text-foreground font-bold">{p.price}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payments bar */}
          <div className="mx-2 mb-3 bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-sm">💳</span>
            <div>
              <p className="text-[9px] font-semibold text-gray-700">Paiement sécurisé</p>
              <p className="text-[8px] text-muted-foreground">
                Carte bancaire · Mobile Money
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        className="absolute -right-4 top-16 bg-white rounded-2xl shadow-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border border-black/5"
      >
        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        Nouvelle vente! 🎉
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 }}
        className="absolute -left-6 bottom-24 bg-white rounded-2xl shadow-xl px-3 py-2 text-xs font-semibold border border-black/5"
      >
        💰 +12 500 FCFA
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

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
              Créer ma boutique
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
                <Link href="/register">Créer ma boutique gratuitement</Link>
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
              <Badge className="mb-6 bg-primary text-primary-foreground border-0 hover:bg-primary/90 text-sm px-3 py-1 font-semibold">
                🌍 Plateforme #1 pour les créateurs africains
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6"
            >
              Crée ta boutique en ligne en{" "}
              <span className="bg-primary text-primary-foreground rounded-lg px-2 inline-block">
                5 minutes
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="text-lg sm:text-xl text-white/85 mb-8 leading-relaxed max-w-lg"
            >
              Partage ton lien unique sur TikTok et Instagram. Encaisse par
              carte bancaire et Mobile Money (Wave, Orange, MTN, Moov).
              Vends partout en Afrique.
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
                  Créer ma boutique gratuite
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
              Gratuit pour commencer · Pas de carte bancaire requise
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
    { value: "5 min", label: "pour lancer ta boutique" },
    { value: "Stripe", label: "paiement sécurisé" },
    { value: "@username", label: "ton lien unique" },
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
      title: "Personnalise ta boutique",
      subtitle: "Templates pro inclus",
      description:
        "Choisis parmi nos templates conçus pour l'Afrique. Ajoute tes produits avec photos, prix et stocks.",
      emoji: "🎨",
      bg: "bg-muted",
      border: "border-border",
    },
    {
      number: "03",
      title: "Partage et encaisse",
      subtitle: "Lien @username unique",
      description:
        "Copie ton lien bio-lien.com/@toi et partage-le sur TikTok, Instagram, WhatsApp. Encaisse par carte bancaire dès aujourd'hui.",
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
            En 3 étapes, tu as une boutique professionnelle prête à vendre.
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
      title: "Gestion des stocks",
      description:
        "Suis tes inventaires en temps réel. Alertes automatiques quand le stock est bas.",
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
      title: "Support 24/7",
      description:
        "Notre équipe basée en Afrique répond en français, anglais et langues locales. Toujours là pour toi.",
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
// Testimonials
// ---------------------------------------------------------------------------

function Testimonials() {
  const testimonials = [
    {
      name: "Aminata Diallo",
      handle: "@aminata.fashion",
      country: "🇸🇳 Sénégal",
      avatar: "AD",
      avatarBg: "bg-primary",
      avatarText: "text-primary-foreground",
      quote:
        "En 10 minutes j'avais ma boutique en ligne. Le premier mois j'ai fait 380 000 FCFA de chiffre d'affaires. Bio-Lien a transformé mon business !",
      stars: 5,
      product: "Mode & Accessoires",
    },
    {
      name: "Kwame Asante",
      handle: "@kwame.craft",
      country: "🇬🇭 Ghana",
      avatar: "KA",
      avatarBg: "bg-[var(--success)]",
      avatarText: "text-[var(--success-foreground)]",
      quote:
        "The checkout is smooth and the dashboard is clear — I set up my shop in one evening and got my first sale the next day. Sales are up 200% in 3 months.",
      stars: 5,
      product: "Artisanat",
    },
    {
      name: "Fatou Konaté",
      handle: "@fatou.beaute",
      country: "🇨🇮 Côte d'Ivoire",
      avatar: "FK",
      avatarBg: "bg-foreground",
      avatarText: "text-background",
      quote:
        "Je poste sur Instagram, mes clientes cliquent sur mon lien Bio-Lien et finalisent leur commande en quelques secondes. C'est trop simple ! Je recommande à toutes les entrepreneures.",
      stars: 5,
      product: "Cosmétiques naturels",
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            Témoignages
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Ils vendent déjà avec{" "}
            <span className="text-primary">Bio-Lien</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Des milliers de créateurs africains font confiance à Bio-Lien
            pour leur boutique en ligne.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <FadeIn key={t.handle} delay={i * 0.1}>
              <Card className="h-full border border-black/[0.06] bg-white hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6 flex flex-col h-full">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-sm leading-relaxed text-foreground/80 flex-1 mb-6 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0",
                        t.avatarBg,
                        t.avatarText,
                      )}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.handle} · {t.country}
                      </p>
                      <Badge variant="secondary" className="mt-1 text-[10px] py-0">
                        {t.product}
                      </Badge>
                    </div>
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
            Lance ta boutique gratuitement
          </h2>
          <p className="text-lg sm:text-xl text-background/80 mb-10 max-w-xl mx-auto">
            Trois minutes pour créer ta boutique, ton lien, et le partager dans
            ta bio. Pas de carte bancaire, pas d&apos;engagement.
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

          {/* Entreprise */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-4">
              Entreprise
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Tarifs", href: "/pricing" },
                { label: "Conditions d'utilisation", href: "/legal/terms" },
                { label: "Confidentialité", href: "/legal/privacy" },
                { label: "Mentions légales", href: "/legal/mentions" },
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
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>© {currentYear} Bio-Lien. Tous droits réservés.</p>
          <div className="flex items-center gap-2 font-semibold text-gray-500">
            <span>🌍</span>
            <span>Made in Africa, for Africa</span>
            <span>❤️</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page entry point
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <HowItWorks />
        <Features />
        <Templates />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
