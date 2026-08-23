"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
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
  Video,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";

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
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#fffdf8]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Logo size="sm" className="text-[#171717]" />
      <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
        <a href="#product">Produit</a><a href="#templates">Templates</a><a href="#why">Pourquoi Bio-Lien ?</a><Link href="/pricing">Tarifs</Link>
      </nav>
      <div className="hidden items-center gap-3 md:flex"><Link href="/login" className="px-4 py-2 text-sm font-bold">Se connecter</Link><Link href="/register" className="rounded-full bg-[#171717] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#dc552f]">Créer mon Bio-Lien</Link></div>
      <button onClick={() => setOpen(!open)} className="grid size-11 place-items-center md:hidden" aria-label="Ouvrir le menu">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav className="border-t bg-[#fffdf8] px-5 py-5 md:hidden"><div className="flex flex-col gap-4 font-semibold"><a href="#product">Produit</a><a href="#templates">Templates</a><Link href="/pricing">Tarifs</Link><Link href="/register" className="rounded-full bg-[#171717] px-5 py-3 text-center text-white">Créer gratuitement</Link></div></nav>}
  </header>;
}

export default function LandingPage() {
  return <div className="min-h-screen overflow-hidden bg-[#fffdf8] text-[#171717]">
    <Navbar />
    <main>
      <section className="relative px-5 pb-24 pt-32 sm:pt-40">
        <div className="bio-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.12fr_.88fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold shadow-sm"><span className="size-2 rounded-full bg-[#65c38c]" /> Pensé pour les créateurs d’ici et d’ailleurs</div>
            <h1 className="max-w-3xl text-[3.25rem] font-black leading-[.95] tracking-[-.06em] sm:text-7xl lg:text-[5.7rem]">Un seul lien.<br /><span className="relative inline-block text-[#dc552f]">Tout ton univers.<svg className="absolute -bottom-3 left-0 h-4 w-full" viewBox="0 0 400 18" fill="none"><path d="M4 12C90 2 257 2 396 8" stroke="#ffda46" strokeWidth="9" strokeLinecap="round"/></svg></span></h1>
            <p className="mt-9 max-w-xl text-lg leading-relaxed text-black/60 sm:text-xl">Crée une page mémorable pour rassembler tes liens, vendre tes produits et transformer chaque visite en opportunité.</p>
            <form className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_15px_50px_rgba(32,28,18,.08)] sm:flex-row" onSubmit={(e) => e.preventDefault()}>
              <label className="flex flex-1 items-center px-4 text-sm"><span className="font-bold text-black/45">bio-lien.com/</span><input aria-label="Nom Bio-Lien" placeholder="tonnom" className="min-w-0 flex-1 bg-transparent py-3 font-bold outline-none" /></label>
              <Link href="/register" className="flex items-center justify-center gap-2 rounded-xl bg-[#ffda46] px-6 py-4 text-sm font-black shadow-[3px_3px_0_#171717] transition hover:-translate-y-0.5">Réserver mon lien <ArrowRight className="size-4" /></Link>
            </form>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-black/50"><span className="flex items-center gap-1"><Check className="size-4 text-[#258056]" /> Gratuit pour commencer</span><span className="flex items-center gap-1"><Check className="size-4 text-[#258056]" /> Prêt en 3 minutes</span><span className="flex items-center gap-1"><Check className="size-4 text-[#258056]" /> Sans carte bancaire</span></div>
          </div>
          <div className="relative py-8"><div className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8b9ff]" /><div className="absolute left-10 top-4 size-24 rounded-full bg-[#65c38c]" /><div className="absolute bottom-12 right-2 size-20 rotate-12 rounded-[1.8rem] bg-[#dc552f]" /><CreatorPhone /></div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#171717] py-5 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-3 px-5 text-sm font-bold"><span className="text-white/45">Tout ce qu’il te faut</span><span>Instagram</span><span>TikTok</span><span>YouTube</span><span>WhatsApp</span><span>Spotify</span><span>+ ta boutique</span></div></section>

      <section id="why" className="px-5 py-24 sm:py-32"><div className="mx-auto max-w-7xl"><div className="mb-14 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-xs font-black uppercase tracking-[.2em] text-[#dc552f]">Plus qu’un arbre de liens</p><h2 className="max-w-2xl text-4xl font-black leading-tight tracking-[-.04em] sm:text-6xl">Ta présence digitale,<br />sans la prise de tête.</h2></div><p className="max-w-sm text-black/55">Simple à créer. Beau à regarder. Puissant pour grandir.</p></div><div className="grid gap-4 md:grid-cols-3">{benefits.map((item, i) => <motion.article key={item.title} whileHover={{ y: -6 }} className={`rounded-[2rem] border border-black/10 p-7 sm:p-9 ${i===1 ? "bg-[#153c32] text-white" : i===2 ? "bg-[#f3ecff]" : "bg-[#ffed9d]"}`}><div className={`mb-12 grid size-12 place-items-center rounded-2xl ${i===1 ? "bg-[#ffda46] text-black" : "bg-white"}`}><item.icon /></div><h3 className="text-2xl font-black tracking-tight">{item.title}</h3><p className={`mt-3 leading-relaxed ${i===1 ? "text-white/65" : "text-black/55"}`}>{item.text}</p></motion.article>)}</div></div></section>

      <section id="product" className="bg-[#f1ede4] px-5 py-24 sm:py-32"><div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2"><div className="relative min-h-[570px] overflow-hidden rounded-[3rem] bg-[#dc552f] p-10"><div className="absolute -bottom-20 -left-10 size-80 rounded-full bg-[#ffda46]" /><div className="absolute -right-14 top-12 size-52 rounded-full border-[35px] border-[#c8b9ff]" /><CreatorPhone compact /><div className="absolute bottom-7 right-7 rounded-2xl bg-white p-4 shadow-xl"><BarChart3 className="mb-3 text-[#5b36e8]" /><p className="text-2xl font-black">2 849</p><p className="text-xs text-black/50">vues ce mois</p></div></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#dc552f]">Ton copilote créatif</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-.04em] sm:text-6xl">Tu imagines.<br />Bio-Lien fait le reste.</h2><div className="mt-10 space-y-7">{[{icon:Sparkles,t:"Une bio brillante grâce à l’IA"},{icon:Palette,t:"Des thèmes vraiment personnalisables"},{icon:Zap,t:"Des liens détectés et habillés automatiquement"},{icon:BarChart3,t:"Des statistiques lisibles, enfin"}].map(({icon:Icon,t})=><div key={t} className="flex items-center gap-4 border-b border-black/10 pb-6"><span className="grid size-11 place-items-center rounded-xl bg-white"><Icon className="size-5" /></span><p className="font-bold">{t}</p></div>)}</div></div></div></section>

      <section id="templates" className="px-5 py-24 sm:py-32"><div className="mx-auto max-w-7xl text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-[#5b36e8]">Trouve ton style</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">Pas un profil comme les autres.</h2><p className="mx-auto mt-5 max-w-xl text-black/55">Pars d’un template et rends-le totalement unique. Change tout, quand tu veux.</p><div className="mt-14 grid gap-5 md:grid-cols-3">{templates.map((t, i)=><motion.div key={t.name} whileHover={{ y:-8, rotate: i===1 ? 1 : -1 }} className="rounded-[2.2rem] border border-black/10 p-3 text-left shadow-sm" style={{background:t.bg}}><div className="rounded-[1.7rem] bg-white/75 p-6 text-center backdrop-blur"><div className="mx-auto grid size-16 place-items-center rounded-full text-2xl font-black text-white" style={{background:t.accent}}>{t.avatar}</div><h3 className="mt-4 text-xl font-black">{t.name}</h3><p className="text-xs text-black/50">{t.role}</p><div className="mt-6 space-y-2">{t.links.map(link=><div key={link} className="rounded-xl px-4 py-3 text-xs font-bold text-white" style={{background:t.accent}}>{link}</div>)}</div></div></motion.div>)}</div><Link href="/register" className="mt-10 inline-flex items-center gap-2 rounded-full border-2 border-black px-6 py-3 text-sm font-black">Voir tous les templates <ArrowRight className="size-4" /></Link></div></section>

      <section className="px-5 pb-24"><div className="mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-[#ffda46] px-7 py-16 text-center sm:px-16 sm:py-20"><div className="mx-auto mb-7 grid size-14 place-items-center rounded-2xl bg-[#171717] text-white"><Link2 /></div><h2 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-[-.05em] sm:text-6xl">Ton audience est déjà là.<br />Donne-lui le bon lien.</h2><p className="mx-auto mt-5 max-w-xl text-black/60">Crée gratuitement la page qui rassemble tout ce que tu fais — et tout ce que tu vas devenir.</p><Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#171717] px-7 py-4 font-black text-white">Créer mon Bio-Lien <ArrowRight className="size-5" /></Link></div></section>
    </main>
    <footer className="border-t border-black/10 px-5 py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row"><Logo size="sm" /><p className="text-xs text-black/45">© {new Date().getFullYear()} Bio-Lien. Créé avec ambition en Afrique.</p><div className="flex gap-5 text-xs font-bold"><Link href="/legal/privacy">Confidentialité</Link><Link href="/legal/terms">Conditions</Link></div></div></footer>
  </div>;
}
