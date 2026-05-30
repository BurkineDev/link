"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Cpu,
  Brain,
  Sparkles,
  Binary,
  Terminal,
  Shirt,
  Gem,
  Crown,
  Scissors,
  Coffee,
  Utensils,
  Soup,
  Cookie,
  Palette,
  Brush,
  Hammer,
  Feather,
  BookOpen,
  GraduationCap,
  Briefcase,
  TrendingUp,
  Home,
  Flower2,
  Leaf,
} from "lucide-react";
import { motion } from "framer-motion";

interface ProductVectorIllustrationProps {
  name: string;
  description?: string;
  className?: string;
}

interface Universe {
  icon: LucideIcon;
  gradientClass: string;
  glowColor: string;
  label: string;
}

const UNIVERSES: Record<string, Universe> = {
  ai_tech: {
    icon: Cpu,
    gradientClass: "from-indigo-600 via-indigo-500 to-cyan-400 dark:from-indigo-900 dark:via-indigo-800 dark:to-cyan-600",
    glowColor: "rgba(99, 102, 241, 0.4)",
    label: "IA & Tech",
  },
  fashion: {
    icon: Shirt,
    gradientClass: "from-rose-500 via-pink-500 to-orange-400 dark:from-rose-900 dark:via-pink-900 dark:to-orange-700",
    glowColor: "rgba(244, 63, 94, 0.4)",
    label: "Mode & Beauté",
  },
  food: {
    icon: Coffee,
    gradientClass: "from-amber-500 via-orange-500 to-rose-500 dark:from-amber-900 dark:via-orange-900 dark:to-rose-850",
    glowColor: "rgba(245, 158, 11, 0.4)",
    label: "Alimentation",
  },
  artisan: {
    icon: Palette,
    gradientClass: "from-emerald-500 via-teal-500 to-cyan-500 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-700",
    glowColor: "rgba(16, 185, 129, 0.4)",
    label: "Art & Déco",
  },
  business: {
    icon: BookOpen,
    gradientClass: "from-blue-600 via-indigo-600 to-violet-500 dark:from-blue-900 dark:via-indigo-900 dark:to-violet-750",
    glowColor: "rgba(37, 99, 235, 0.4)",
    label: "Savoir & Business",
  },
  home: {
    icon: Home,
    gradientClass: "from-teal-500 via-emerald-500 to-yellow-500 dark:from-teal-900 dark:via-emerald-900 dark:to-yellow-750",
    glowColor: "rgba(20, 184, 166, 0.4)",
    label: "Maison & Jardin",
  },
  generic: {
    icon: Sparkles,
    gradientClass: "from-violet-600 via-purple-600 to-fuchsia-500 dark:from-violet-950 dark:via-purple-950 dark:to-fuchsia-800",
    glowColor: "rgba(139, 92, 246, 0.4)",
    label: "Boutique",
  },
};

function determineUniverse(name: string, description: string = ""): Universe {
  const text = `${name} ${description}`.toLowerCase();

  // AI & Technology
  if (
    text.includes("ai") ||
    text.includes("ia") ||
    text.includes("tech") ||
    text.includes("logiciel") ||
    text.includes("software") ||
    text.includes("prompt") ||
    text.includes("code") ||
    text.includes("sais") ||
    text.includes("digital") ||
    text.includes("app") ||
    text.includes("ordinateur") ||
    text.includes("téléphone") ||
    text.includes("phone")
  ) {
    // Specific icon override based on name keywords
    if (text.includes("brain") || text.includes("cerveau") || text.includes("intelligence")) {
      return { ...UNIVERSES.ai_tech, icon: Brain };
    }
    if (text.includes("code") || text.includes("develop") || text.includes("dev")) {
      return { ...UNIVERSES.ai_tech, icon: Terminal };
    }
    if (text.includes("data") || text.includes("analytics")) {
      return { ...UNIVERSES.ai_tech, icon: Binary };
    }
    return UNIVERSES.ai_tech;
  }

  // Fashion & Style
  if (
    text.includes("wax") ||
    text.includes("tissu") ||
    text.includes("robe") ||
    text.includes("shirt") ||
    text.includes("t-shirt") ||
    text.includes("vetement") ||
    text.includes("vêtement") ||
    text.includes("mode") ||
    text.includes("couture") ||
    text.includes("bijou") ||
    text.includes("bague") ||
    text.includes("collier") ||
    text.includes("sac")
  ) {
    if (text.includes("bijou") || text.includes("gem") || text.includes("diamant")) {
      return { ...UNIVERSES.fashion, icon: Gem };
    }
    if (text.includes("couture") || text.includes("ciseaux")) {
      return { ...UNIVERSES.fashion, icon: Scissors };
    }
    if (text.includes("luxe") || text.includes("or") || text.includes("gold") || text.includes("royal")) {
      return { ...UNIVERSES.fashion, icon: Crown };
    }
    return UNIVERSES.fashion;
  }

  // Food & Gastronomy
  if (
    text.includes("cafe") ||
    text.includes("café") ||
    text.includes("boisson") ||
    text.includes("food") ||
    text.includes("nourriture") ||
    text.includes("épicerie") ||
    text.includes("epicerie") ||
    text.includes("miel") ||
    text.includes("chocolat") ||
    text.includes("pâtisserie") ||
    text.includes("gateau")
  ) {
    if (text.includes("resto") || text.includes("cuisine") || text.includes("repas")) {
      return { ...UNIVERSES.food, icon: Utensils };
    }
    if (text.includes("cookie") || text.includes("biscuit") || text.includes("pain")) {
      return { ...UNIVERSES.food, icon: Cookie };
    }
    if (text.includes("soupe") || text.includes("sauce") || text.includes("plat")) {
      return { ...UNIVERSES.food, icon: Soup };
    }
    return UNIVERSES.food;
  }

  // Art, Decor & Craft
  if (
    text.includes("art") ||
    text.includes("peinture") ||
    text.includes("tableau") ||
    text.includes("deco") ||
    text.includes("déco") ||
    text.includes("craft") ||
    text.includes("artisan") ||
    text.includes("poterie") ||
    text.includes("bois") ||
    text.includes("handmade")
  ) {
    if (text.includes("dessin") || text.includes("pinceau")) {
      return { ...UNIVERSES.artisan, icon: Brush };
    }
    if (text.includes("outil") || text.includes("marteau")) {
      return { ...UNIVERSES.artisan, icon: Hammer };
    }
    if (text.includes("plume") || text.includes("ecriture")) {
      return { ...UNIVERSES.artisan, icon: Feather };
    }
    return UNIVERSES.artisan;
  }

  // Business & Knowledge
  if (
    text.includes("livre") ||
    text.includes("book") ||
    text.includes("ebook") ||
    text.includes("formation") ||
    text.includes("cours") ||
    text.includes("audit") ||
    text.includes("consult") ||
    text.includes("coaching") ||
    text.includes("guide") ||
    text.includes("pdf")
  ) {
    if (text.includes("formation") || text.includes("diplome") || text.includes("academie")) {
      return { ...UNIVERSES.business, icon: GraduationCap };
    }
    if (text.includes("consult") || text.includes("business") || text.includes("finance")) {
      return { ...UNIVERSES.business, icon: Briefcase };
    }
    if (text.includes("growth") || text.includes("strategie") || text.includes("croissance")) {
      return { ...UNIVERSES.business, icon: TrendingUp };
    }
    return UNIVERSES.business;
  }

  // Home & Gardening
  if (
    text.includes("maison") ||
    text.includes("home") ||
    text.includes("plante") ||
    text.includes("fleur") ||
    text.includes("jardin") ||
    text.includes("meuble") ||
    text.includes("salon") ||
    text.includes("lampe")
  ) {
    if (text.includes("plante") || text.includes("feuille") || text.includes("nature")) {
      return { ...UNIVERSES.home, icon: Leaf };
    }
    if (text.includes("fleur") || text.includes("rose")) {
      return { ...UNIVERSES.home, icon: Flower2 };
    }
    return UNIVERSES.home;
  }

  return UNIVERSES.generic;
}

export function ProductVectorIllustration({
  name,
  description = "",
  className,
}: ProductVectorIllustrationProps) {
  const universe = determineUniverse(name, description);
  const IconComponent = universe.icon;

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${universe.gradientClass} ${className}`}
      style={{
        textShadow: "0 2px 10px rgba(0,0,0,0.2)",
      }}
    >
      {/* 🔮 Background Vector Graphics Grid */}
      <div className="absolute inset-0 opacity-20 dark:opacity-30">
        {/* Dot Matrix Pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)",
            backgroundSize: "20px 20px",
          }}
        />
        
        {/* Layered concentric vector circles */}
        <div className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        <div className="absolute left-1/2 top-1/2 h-[45%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
      </div>

      {/* 🌟 Glowing Orb Effect */}
      <div
        className="absolute h-36 w-36 rounded-full blur-2xl transition-all duration-300 group-hover:scale-125"
        style={{
          backgroundColor: universe.glowColor,
        }}
      />

      {/* 🚀 Main Card Container with Floating Animation */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [-4, 4, -4] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative z-10 flex flex-col items-center justify-center"
      >
        {/* Animated flat glassmorphic plate for the vector icon */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/15">
          {/* Subtle icon background shape */}
          <div className="absolute inset-2 rounded-xl bg-gradient-to-tr from-white/5 to-white/10 opacity-50" />
          
          <IconComponent
            className="h-12 w-12 text-white drop-shadow-[0_4px_12px_rgba(255,255,255,0.4)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
            strokeWidth={1.75}
          />

          {/* Sparkles on hover for high-end feel */}
          <div className="absolute -right-1 -top-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Sparkles className="h-4 w-4 text-yellow-200 animate-pulse" />
          </div>
        </div>

        {/* 🏷️ Smart Universe Badge */}
        <span className="mt-4 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white/90 backdrop-blur-sm transition-colors group-hover:bg-black/30">
          {universe.label}
        </span>
      </motion.div>

      {/* 📐 Abstract vector geometry lines */}
      <div className="absolute bottom-4 left-4 font-mono text-[8px] text-white/30 pointer-events-none select-none select-all">
        SYS.AI // {name.toUpperCase().slice(0, 12)}
      </div>
      <div className="absolute right-4 top-4 font-mono text-[8px] text-white/30 pointer-events-none select-none select-all">
        LAT: {name.length * 3}.{(name.charCodeAt(0) || 0) * 7}N
      </div>
    </div>
  );
}
