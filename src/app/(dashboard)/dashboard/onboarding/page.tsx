"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import {
  Store,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Palette,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────
type Template = {
  id: string;
  name: string;
  description: string;
  config: {
    primaryColor: string;
    secondaryColor: string;
    font: string;
    layout: string;
    heroStyle: string;
  };
};

const TEMPLATES: Template[] = [
  {
    id: "boutique",
    name: "Vibrant",
    description: "Coloré et énergique, parfait pour la mode",
    config: {
      primaryColor: "#FF6B35",
      secondaryColor: "#FFD700",
      font: "Inter",
      layout: "grid",
      heroStyle: "fullscreen",
    },
  },
  {
    id: "minimal",
    name: "Minimaliste",
    description: "Épuré et élégant pour un look premium",
    config: {
      primaryColor: "#1A1A2E",
      secondaryColor: "#E94560",
      font: "Playfair Display",
      layout: "masonry",
      heroStyle: "split",
    },
  },
  {
    id: "market",
    name: "Market",
    description: "Style marché africain, chaleureux et accessible",
    config: {
      primaryColor: "#2D6A4F",
      secondaryColor: "#74C69D",
      font: "Nunito",
      layout: "list",
      heroStyle: "banner",
    },
  },
];

const CURRENCIES = [
  { value: "XOF", label: "FCFA (Afrique de l'Ouest)" },
  { value: "XAF", label: "FCFA (Afrique Centrale)" },
  { value: "GHS", label: "GHS — Cedi Ghanéen" },
  { value: "NGN", label: "NGN — Naira Nigérian" },
  { value: "KES", label: "KES — Shilling Kényan" },
  { value: "MAD", label: "MAD — Dirham Marocain" },
  { value: "USD", label: "USD — Dollar US" },
];

// ─── Steps ───────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Profil", icon: "👤" },
  { id: 2, label: "Boutique", icon: "🏪" },
  { id: 3, label: "Thème", icon: "🎨" },
  { id: 4, label: "Terminé", icon: "🎉" },
];

// ─── Schemas ─────────────────────────────────────────────────
const step1Schema = z.object({
  fullName: z.string().min(2, "Minimum 2 caractères"),
  username: z.string()
    .min(3, "Minimum 3 caractères")
    .max(30, "Maximum 30 caractères")
    .regex(/^[a-z0-9_]+$/, "Lettres minuscules, chiffres et _ uniquement"),
});

const step2Schema = z.object({
  shopName: z.string().min(2, "Minimum 2 caractères"),
  shopSlug: z.string()
    .min(3, "Minimum 3 caractères")
    .regex(/^[a-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
  description: z.string().max(500, "Maximum 500 caractères").optional(),
  currency: z.string().min(1),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ─── Component ───────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);

  // Step 1 data
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Values | null>(null);

  // Slug availability
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { currency: "XOF" },
  });

  const watchedSlug = useWatch({ control: form2.control, name: "shopSlug" });
  const debouncedSlug = useDebounce(watchedSlug, 500);
  const watchedShopName = useWatch({ control: form2.control, name: "shopName" });

  // Auto-generate slug from shop name
  useEffect(() => {
    if (watchedShopName && !form2.formState.dirtyFields.shopSlug) {
      const slug = watchedShopName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 40);
      form2.setValue("shopSlug", slug);
    }
  }, [watchedShopName, form2]);

  // Check slug availability
  useEffect(() => {
    if (!debouncedSlug || debouncedSlug.length < 3) {
      queueMicrotask(() => setSlugAvailable(null));
      return;
    }
    let cancelled = false;
    const check = async () => {
      setCheckingSlug(true);
      const { data } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", debouncedSlug)
        .maybeSingle();
      if (!cancelled) {
        setSlugAvailable(!data);
        setCheckingSlug(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
    // supabase client is stable across renders — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSlug]);

  const handleStep1 = form1.handleSubmit((data) => {
    setStep1Data(data);
    setStep(2);
  });

  const handleStep2 = form2.handleSubmit((data: Step2Values) => {
    if (slugAvailable === false) {
      form2.setError("shopSlug", { message: "Ce slug est déjà pris" });
      return;
    }
    setStep2Data(data);
    setStep(3);
  });

  const handleFinish = async () => {
    if (!step1Data || !step2Data) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: step1Data.fullName, username: step1Data.username })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Look up matching template
      const { data: templateRecord } = await supabase
        .from("templates")
        .select("id")
        .eq("id", selectedTemplate.id)
        .maybeSingle();

      const { error: shopError } = await supabase
        .from("shops")
        .insert({
          owner_id: user.id,
          name: step2Data.shopName,
          slug: step2Data.shopSlug,
          description: step2Data.description ?? null,
          currency: step2Data.currency as "XOF" | "XAF" | "GHS" | "NGN" | "KES" | "MAD" | "USD",
          template_id: templateRecord?.id ?? null,
          theme_color: selectedTemplate.config.primaryColor,
          is_published: false,
          logo_url: null,
          banner_url: null,
          contact_email: null,
          contact_phone: null,
          social_links: null,
        });

      if (shopError) throw shopError;

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      toast.success("Ta boutique est créée ! 🎉");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="md" />
          <Badge variant="outline" className="text-xs">
            Configuration initiale
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                    ? "bg-primary/20 border-2 border-primary text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.id ? <Check className="h-5 w-5" /> : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 transition-all",
                    step > s.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* ─── STEP 1: Profile ─── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-bold">Bienvenue sur LinkBoutik 👋</h1>
                  <p className="text-muted-foreground">
                    Commençons par configurer ton profil
                  </p>
                </div>

                <form onSubmit={handleStep1} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Ton nom complet</Label>
                    <Input
                      id="fullName"
                      placeholder="Ex: Amara Diallo"
                      {...form1.register("fullName")}
                      className="h-12"
                    />
                    {form1.formState.errors.fullName && (
                      <p className="text-sm text-destructive">
                        {form1.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Ton nom d&apos;utilisateur</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">@</span>
                      <Input
                        id="username"
                        placeholder="amara_diallo"
                        {...form1.register("username", {
                          onChange: (e) => {
                            e.target.value = e.target.value.toLowerCase();
                          },
                        })}
                        className="h-12"
                      />
                    </div>
                    {form1.formState.errors.username && (
                      <p className="text-sm text-destructive">
                        {form1.formState.errors.username.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Lettres minuscules, chiffres et _ uniquement
                    </p>
                  </div>

                  <Button type="submit" className="w-full h-12 gap-2">
                    Continuer <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 2: Shop info ─── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <div className="flex justify-center text-4xl mb-2">
                    <Store className="h-10 w-10 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold">Crée ta boutique</h1>
                  <p className="text-muted-foreground">
                    Comment s&apos;appellera ta boutique ?
                  </p>
                </div>

                <form onSubmit={handleStep2} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shopName">Nom de ta boutique</Label>
                    <Input
                      id="shopName"
                      placeholder="Ex: Amara Fashion"
                      {...form2.register("shopName")}
                      className="h-12"
                    />
                    {form2.formState.errors.shopName && (
                      <p className="text-sm text-destructive">
                        {form2.formState.errors.shopName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shopSlug">Adresse de ta boutique</Label>
                    <div className="flex items-center gap-2 border rounded-md px-3 focus-within:ring-2 focus-within:ring-ring">
                      <span className="text-muted-foreground text-sm shrink-0">
                        linkboutik.com/
                      </span>
                      <input
                        id="shopSlug"
                        className="flex-1 h-12 bg-transparent outline-none text-sm"
                        placeholder="amara-fashion"
                        {...form2.register("shopSlug", {
                          onChange: (e) => {
                            e.target.value = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_-]/g, "");
                          },
                        })}
                      />
                      <div className="shrink-0">
                        {checkingSlug && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!checkingSlug && slugAvailable === true && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {!checkingSlug && slugAvailable === false && (
                          <span className="text-xs text-destructive">Pris</span>
                        )}
                      </div>
                    </div>
                    {form2.formState.errors.shopSlug && (
                      <p className="text-sm text-destructive">
                        {form2.formState.errors.shopSlug.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optionnelle)</Label>
                    <Textarea
                      id="description"
                      placeholder="Décris ta boutique en quelques mots..."
                      rows={3}
                      {...form2.register("description")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Devise principale</Label>
                    <select
                      id="currency"
                      {...form2.register("currency")}
                      className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12 gap-2"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4" /> Retour
                    </Button>
                    <Button type="submit" className="flex-1 h-12 gap-2">
                      Continuer <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 3: Template ─── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <div className="flex justify-center">
                    <Palette className="h-10 w-10 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold">Choisis ton thème</h1>
                  <p className="text-muted-foreground">
                    Tu pourras le modifier plus tard
                  </p>
                </div>

                <div className="grid gap-4">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "relative rounded-xl border-2 p-4 text-left transition-all",
                        selectedTemplate.id === template.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {/* Color preview */}
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div
                            className="h-8 w-8 rounded-full"
                            style={{ backgroundColor: template.config.primaryColor }}
                          />
                          <div
                            className="h-8 w-8 rounded-full"
                            style={{ backgroundColor: template.config.secondaryColor }}
                          />
                        </div>
                        <div>
                          <p className="font-semibold">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        </div>
                        {selectedTemplate.id === template.id && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 gap-2"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 gap-2"
                    onClick={handleFinish}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Créer ma boutique <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          En créant ta boutique, tu acceptes les{" "}
          <Link href="/terms" className="underline hover:text-primary">
            conditions d&apos;utilisation
          </Link>{" "}
          de LinkBoutik
        </p>
      </div>
    </div>
  );
}
