"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Check,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Génération IA en cours…" : "Générer avec IA"}
      </Button>
      {result && (
        <>
          <Output value={result} />
          <Button
            type="button"
            className="w-full gradient-brand text-white"
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
          <Input placeholder="ex: Awa Beauty" value={shopName} onChange={(e) => setShopName(e.target.value)} />
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
      <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
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
        {[
          ["Prix conseillé", formatCurrency(numbers.price)],
          ["Coût total", formatCurrency(numbers.totalCost)],
          ["Profit", formatCurrency(numbers.profit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>
      <Output value={summary} />
      <Button
        type="button"
        className="w-full gradient-brand text-white"
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
  const accentClass = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  }[accent];

  return (
    <Card className="overflow-hidden border-border/80 bg-white shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg border", accentClass)}>
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
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
              "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              value === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
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
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-muted/30 pt-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <Badge className="mb-5 border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="mr-1 size-3.5" />
              Outils gratuits pour vendre plus vite
            </Badge>
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Transforme tes idées, tes produits et tes DM en ventes.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Génère des descriptions, des messages WhatsApp et des prix avec
              marge. Quand le produit est prêt, ajoute-le dans une boutique Link
              et partage ton lien.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold">Prochaine étape</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ces outils t&apos;aident à préparer la vente. LinkBoutik t&apos;aide à
              encaisser et suivre les commandes.
            </p>
            <Button className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90 border-0" asChild>
              <Link href="/register">
                Créer ma boutique
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-8 lg:grid-cols-2">
        <DescriptionGenerator />
        <WhatsAppGenerator />
        <div className="lg:col-span-2">
          <MarginCalculator />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-foreground p-6 text-background sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-background/70">
              <Check className="size-4" />
              Prêt à vendre au lieu de juste répondre aux messages ?
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Mets tes produits dans une boutique partageable.
            </h2>
          </div>
          <Button className="bg-background text-foreground hover:bg-background/90" asChild>
            <Link href="/register">
              Lancer LinkBoutik
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
