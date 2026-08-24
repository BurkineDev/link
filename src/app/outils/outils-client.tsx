"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BrandBackdrop,
  Wordmark,
} from "@/components/brand/brand-shell";
import {
  ArrowRight,
  Calculator,
  Clipboard,
  Loader2,
  MessageCircle,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tone = "pro" | "friendly" | "premium";
type FollowUpIntent = "question" | "payment" | "delivery";

const toneLabels: Record<Tone, string> = {
  pro: "Professionnel",
  friendly: "Chaleureux",
  premium: "Premium",
};

const followUpLabels: Record<FollowUpIntent, string> = {
  question: "Relancer un intéressé",
  payment: "Demander le paiement",
  delivery: "Confirmer la livraison",
};

const PRODUCT_DRAFT_KEY = "linkboutik:product-draft";

type ProductDraft = {
  name?: string;
  description?: string;
  price?: number;
};

// Stash a draft in localStorage then send the user to the product form, which
// reads and pre-fills it — bridges the free AI tools to shop creation.
function saveProductDraft(draft: ProductDraft) {
  let existing: ProductDraft = {};

  try {
    existing = JSON.parse(localStorage.getItem(PRODUCT_DRAFT_KEY) ?? "{}");
  } catch {
    existing = {};
  }

  localStorage.setItem(
    PRODUCT_DRAFT_KEY,
    JSON.stringify({ ...existing, ...draft }),
  );
  toast.success("Brouillon produit sauvegardé.");
  window.location.assign("/dashboard/products/new");
}

function copyToClipboard(value: string) {
  if (!value.trim()) return;
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success("Texte copié."))
    .catch(() => toast.error("Impossible de copier le texte."));
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
}

function DescriptionGenerator() {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [benefit, setBenefit] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!name.trim()) {
      toast.error("Entre le nom du produit.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/outils/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name,
          category: audience,
          keywords: benefit,
          tone: tone === "friendly" ? "chaleureux" : tone === "premium" ? "luxe" : "professionnel",
        }),
      });
      const data = await res.json() as { description?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setResult(data.description ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur. Réessaye.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolCard
      icon={PackagePlus}
      title="Description produit"
      description="Génère une description prête à coller sur ta fiche produit."
      accent="emerald"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du produit *">
          <Input placeholder="ex: Savon au karité" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Catégorie / cible">
          <Input placeholder="ex: Cosmétiques, femmes" value={audience} onChange={(e) => setAudience(e.target.value)} />
        </Field>
      </div>
      <Field label="Bénéfice principal">
        <Input placeholder="ex: naturel, hydratant, sent bon" value={benefit} onChange={(e) => setBenefit(e.target.value)} />
      </Field>
      <SegmentedControl
        label="Ton"
        value={tone}
        onChange={(value) => setTone(value as Tone)}
        options={Object.entries(toneLabels).map(([value, label]) => ({ value, label }))}
      />
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full gap-2 rounded-[var(--r-full)] bg-[var(--b-ink)] py-6 font-bold text-[var(--b-on-dark)] hover:bg-[var(--b-ink-hover)]"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Génération IA en cours…" : "Générer avec IA"}
      </Button>
      {result && (
        <>
          <Output value={result} />
          <Button
            type="button"
            className="w-full rounded-[var(--r-full)] bg-[var(--b-lime)] font-bold text-[var(--b-ink)] hover:bg-[var(--b-lime-deep)]"
            onClick={() => saveProductDraft({ name, description: result })}
          >
            Utiliser dans ma boutique
            <ArrowRight className="size-4" />
          </Button>
        </>
      )}
    </ToolCard>
  );
}

function WhatsAppGenerator() {
  const [shopName, setShopName] = useState("");
  const [product, setProduct] = useState("");
  const [intent, setIntent] = useState<FollowUpIntent>("question");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setResult("");
    try {
      const typeMap: Record<FollowUpIntent, string> = {
        question: "relance",
        payment: "confirmation",
        delivery: "livraison",
      };
      const res = await fetch("/api/outils/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeMap[intent], shopName, productName: product }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setResult(data.message ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur. Réessaye.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolCard
      icon={MessageCircle}
      title="Message WhatsApp"
      description="Crée une relance claire pour transformer une question en commande."
      accent="sky"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de ta boutique">
          <Input placeholder="ex : Ma boutique" value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </Field>
        <Field label="Produit (optionnel)">
          <Input placeholder="ex: Huile de coco" value={product} onChange={(e) => setProduct(e.target.value)} />
        </Field>
      </div>
      <SegmentedControl
        label="Objectif"
        value={intent}
        onChange={(value) => setIntent(value as FollowUpIntent)}
        options={Object.entries(followUpLabels).map(([value, label]) => ({ value, label }))}
      />
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full gap-2 rounded-[var(--r-full)] bg-[var(--b-ink)] py-6 font-bold text-[var(--b-on-dark)] hover:bg-[var(--b-ink-hover)]"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {loading ? "Génération IA en cours…" : "Générer avec IA"}
      </Button>
      {result && <Output value={result} />}
    </ToolCard>
  );
}

function MarginCalculator() {
  const [cost, setCost] = useState("3500");
  const [wantedMargin, setWantedMargin] = useState("45");
  const [fees, setFees] = useState("300");

  const numbers = useMemo(() => {
    const parsedCost = Math.max(0, Number(cost) || 0);
    const parsedMargin = Math.min(95, Math.max(0, Number(wantedMargin) || 0));
    const parsedFees = Math.max(0, Number(fees) || 0);
    const price =
      parsedMargin >= 95
        ? parsedCost + parsedFees
        : (parsedCost + parsedFees) / (1 - parsedMargin / 100);
    const profit = price - parsedCost - parsedFees;

    return {
      price,
      profit,
      totalCost: parsedCost + parsedFees,
      parsedMargin,
    };
  }, [cost, fees, wantedMargin]);

  const summary = `Prix conseillé: ${formatCurrency(numbers.price)}\nCoût total: ${formatCurrency(numbers.totalCost)}\nProfit estimé: ${formatCurrency(numbers.profit)}\nMarge cible: ${numbers.parsedMargin}%`;

  return (
    <ToolCard
      icon={Calculator}
      title="Prix avec marge"
      description="Calcule un prix de vente qui protège ta marge."
      accent="amber"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Coût produit">
          <Input
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
        <Field label="Marge voulue %">
          <Input
            inputMode="numeric"
            value={wantedMargin}
            onChange={(e) => setWantedMargin(e.target.value)}
          />
        </Field>
        <Field label="Frais estimés">
          <Input
            inputMode="numeric"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Le prix conseillé est la réponse à la question posée : la maquette
            le met en citron, les deux autres restent des appoints. */}
        {[
          ["Prix conseillé", formatCurrency(numbers.price), true],
          ["Coût total", formatCurrency(numbers.totalCost), false],
          ["Profit", formatCurrency(numbers.profit), false],
        ].map(([label, value, lead]) => (
          <div
            key={label as string}
            className="rounded-[var(--r-md)] p-4.5"
            style={
              lead
                ? { background: "var(--b-lime)" }
                : {
                    background: "var(--b-wash)",
                    border: "1px solid var(--b-line)",
                  }
            }
          >
            <p
              className="text-[12px] font-bold uppercase tracking-[0.06em]"
              style={{ color: lead ? "var(--b-olive)" : "var(--b-faint)" }}
            >
              {label}
            </p>
            <p className="mt-1.5 text-[24px] font-bold tracking-[-0.02em]">
              {value}
            </p>
          </div>
        ))}
      </div>
      <Output value={summary} />
      <Button
        type="button"
        className="w-full rounded-[var(--r-full)] bg-[var(--b-lime)] font-bold text-[var(--b-ink)] hover:bg-[var(--b-lime-deep)]"
        onClick={() => saveProductDraft({ price: Math.round(numbers.price) })}
      >
        Envoyer ce prix vers ma fiche produit
        <ArrowRight className="size-4" />
      </Button>
    </ToolCard>
  );
}

function ToolCard({
  icon: Icon,
  title,
  description,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: "emerald" | "sky" | "amber";
  children: React.ReactNode;
}) {
  // Les trois teintes d'étiquette de la maquette, une par outil.
  const accentStyle = {
    emerald: { background: "#EAF6D8", color: "#4E6B14" },
    sky: { background: "#E4EFFA", color: "#1D4E7A" },
    amber: { background: "#FAF0DC", color: "#7A5A14" },
  }[accent];

  return (
    <div
      className="flex h-full flex-col gap-4 rounded-[var(--r-xl)] p-7"
      style={{
        background: "var(--b-paper)",
        border: "1px solid var(--b-line)",
      }}
    >
      <div>
        <span
          className="inline-flex items-center gap-2 rounded-[var(--r-xs)] px-3 py-2 text-[12px] font-bold uppercase tracking-[.06em]"
          style={accentStyle}
        >
          <Icon className="size-3.5" />
          {title}
        </span>
        <p className="mt-3 text-[14px]" style={{ color: "var(--b-muted)" }}>
          {description}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[var(--r-full)] border px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
              value === option.value
                ? "border-[var(--b-ink)] bg-[var(--b-ink)] text-[var(--b-on-dark)]"
                : "border-[var(--b-line)] bg-white text-[var(--b-muted)] hover:border-[var(--b-ink)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Output({ value }: { value: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Résultat
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(value)}
        >
          <Clipboard className="size-3.5" />
          Copier
        </Button>
      </div>
      <Textarea value={value} readOnly rows={7} className="resize-none bg-muted/30" />
    </div>
  );
}

export function OutilsClient() {
  return (
    <div
      className="relative min-h-screen font-[family-name:var(--font-brand)]"
      style={{ background: "var(--b-canvas)", color: "var(--b-ink)" }}
    >
      <BrandBackdrop />

      <div className="relative z-10 mx-auto max-w-[1100px] px-5 sm:px-8 lg:px-12">
        <nav className="flex items-center justify-between gap-6 py-5.5">
          <Wordmark />
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
              Créer ma boutique
            </Link>
          </div>
        </nav>

        <main>
          <section className="grid items-end gap-7 py-10 lg:grid-cols-[1fr_360px] lg:gap-12">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-[var(--r-full)] px-4 py-2 text-[13.5px] font-medium"
                style={{
                  background: "var(--b-paper)",
                  border: "1px solid var(--b-line)",
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: "var(--b-green-bright)" }}
                  aria-hidden
                />
                Outils gratuits pour vendre plus vite
              </span>
              <h1
                className="mt-5.5 max-w-[18ch] text-[clamp(34px,4.4vw,54px)] font-bold leading-[1.06] tracking-[-0.03em]"
                style={{ textWrap: "balance" }}
              >
                Transforme tes idées, tes produits et tes DM en ventes.
              </h1>
              <p
                className="mt-4.5 max-w-[52ch] text-[16.5px] leading-[1.6]"
                style={{ color: "var(--b-muted)" }}
              >
                Génère des descriptions, des messages WhatsApp et des prix avec
                marge. Quand le produit est prêt, ajoute-le dans ta boutique
                Bio-Lien et partage ton lien.
              </p>
            </div>

            <div
              className="max-w-[360px] rounded-[var(--r-xl)] p-6"
              style={{
                background: "var(--b-paper)",
                border: "1px solid var(--b-line)",
                boxShadow: "var(--sh-2)",
              }}
            >
              <p className="text-[14.5px] font-bold">Prochaine étape</p>
              <p
                className="mt-2 text-[14px] leading-[1.6]"
                style={{ color: "var(--b-muted)" }}
              >
                Ces outils t&apos;aident à préparer la vente. Bio-Lien t&apos;aide
                à encaisser et suivre les commandes.
              </p>
              <Link
                href="/register"
                className="mt-4 flex items-center justify-center gap-2 rounded-[var(--r-full)] py-3.5 text-[14.5px] font-bold no-underline transition-colors hover:bg-[var(--b-lime-deep)]"
                style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
              >
                Créer ma boutique
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>

          <section className="grid gap-4.5 pb-4 lg:grid-cols-2">
            <DescriptionGenerator />
            <WhatsAppGenerator />
            <div className="lg:col-span-2">
              <MarginCalculator />
            </div>
          </section>

          <section className="py-6 pb-14">
            <div
              className="flex flex-col gap-5 rounded-[var(--r-2xl)] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-11"
              style={{ background: "var(--b-ink)", color: "var(--b-on-dark)" }}
            >
              <div>
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: "var(--b-on-dark-muted)" }}
                >
                  Prêt à vendre au lieu de juste répondre aux messages ?
                </p>
                <h2
                  className="mt-2 text-[clamp(22px,2.6vw,30px)] font-bold tracking-[-0.02em]"
                  style={{ color: "var(--b-lime)" }}
                >
                  Mets tes produits dans une boutique partageable.
                </h2>
              </div>
              <Link
                href="/register"
                className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-full)] px-6.5 py-3.5 text-[15px] font-bold no-underline transition-colors hover:bg-[var(--b-lime)]"
                style={{ background: "var(--b-on-dark)", color: "var(--b-ink)" }}
              >
                Lancer Bio-Lien
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        </main>

        <footer
          className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3 pb-10 text-[13.5px]"
          style={{ color: "var(--b-faint)" }}
        >
          <Wordmark className="text-[15px]" href={null} />
          <span>
            Outils gratuits — générations limitées à 30 par jour et par personne
          </span>
        </footer>
      </div>
    </div>
  );
}
