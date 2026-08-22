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
import {
  BIO_THEME_LIST,
  DEFAULT_BIO_THEME,
  resolveBioTheme,
  type BioThemeId,
} from "@/lib/bio-themes";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_CTA_SHAPE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_THEME_COLOR,
} from "@/lib/constants";
import { ThemePreview } from "@/components/dashboard/theme-preview";
import { usernameSchema } from "@/lib/validations/auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────

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
  // Same rule as the register page and the DB constraint — the seller must
  // never see their signup username rejected here.
  username: usernameSchema,
});

const step2Schema = z
  .object({
    shopName: z.string().min(2, "Minimum 2 caractères"),
    shopSlug: z
      .string()
      .min(3, "Minimum 3 caractères")
      .regex(/^[a-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
    description: z.string().max(500, "Maximum 500 caractères").optional(),
    currency: z.string().min(1),
    checkoutMode: z.enum(["whatsapp", "online"]),
    whatsappNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.checkoutMode === "whatsapp") {
      const digits = (data.whatsappNumber ?? "").replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappNumber"],
          message: "Numéro WhatsApp invalide (avec indicatif pays)",
        });
      }
    }
  });

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ─── Live preview ────────────────────────────────────────────
// The page the seller is building, rendered while they type. Same resolver
// and component as the settings preview, so what they see here is what a
// visitor gets after publishing.
function OnboardingPreview({
  shopName,
  slug,
  bioTheme,
}: {
  shopName: string;
  slug: string;
  bioTheme: BioThemeId;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Aperçu en direct
      </p>
      <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
        <div className="h-[420px]">
          <ThemePreview
            shopName={shopName || "Ma boutique"}
            slug={slug}
            bioTheme={bioTheme}
            primaryColor={DEFAULT_THEME_COLOR}
            accentColor={DEFAULT_ACCENT_COLOR}
            fontFamily={DEFAULT_FONT_FAMILY}
            borderRadius={DEFAULT_BORDER_RADIUS}
            ctaShape={DEFAULT_CTA_SHAPE}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bioTheme, setBioTheme] = useState<BioThemeId>(DEFAULT_BIO_THEME);

  // Step 1 data
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Values | null>(null);

  // Slug availability
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(step1Schema) });

  // Prefill step 1 from what the seller already typed at signup (stored in
  // auth user_metadata by the register page). They just confirm and continue.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const meta = (user.user_metadata ?? {}) as {
        full_name?: string;
        username?: string;
      };
      if (meta.full_name && !form1.getValues("fullName")) {
        form1.setValue("fullName", meta.full_name);
      }
      if (
        meta.username &&
        !form1.getValues("username") &&
        usernameSchema.safeParse(meta.username).success
      ) {
        form1.setValue("username", meta.username);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { currency: "XOF", checkoutMode: "whatsapp", whatsappNumber: "" },
  });
  const watchedCheckoutMode = useWatch({
    control: form2.control,
    name: "checkoutMode",
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

      const { error: shopError } = await supabase
        .from("shops")
        .insert({
          owner_id: user.id,
          name: step2Data.shopName,
          slug: step2Data.shopSlug,
          description: step2Data.description ?? null,
          currency: step2Data.currency as "XOF" | "XAF" | "GHS" | "NGN" | "KES" | "MAD" | "USD",
          template_id: null,
          bio_theme: bioTheme,
          theme_color: DEFAULT_THEME_COLOR,
          accent_color: DEFAULT_ACCENT_COLOR,
          is_published: false,
          logo_url: null,
          banner_url: null,
          contact_email: null,
          contact_phone: null,
          social_links: null,
          checkout_mode: step2Data.checkoutMode,
          whatsapp_number:
            step2Data.checkoutMode === "whatsapp"
              ? (step2Data.whatsappNumber ?? "").replace(/\D/g, "")
              : null,
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
                  <h1 className="text-2xl font-bold">Bienvenue sur Bio-Lien 👋</h1>
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
                      Lettres minuscules, chiffres, tirets et _
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
                        bio-lien.com/
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

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="pt-2 block">Comment veux-tu encaisser ?</Label>
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                      Tu pourras changer plus tard depuis les paramètres.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={cn(
                          "cursor-pointer rounded-lg border-2 p-3 transition-all",
                          watchedCheckoutMode === "whatsapp"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <input
                          type="radio"
                          value="whatsapp"
                          {...form2.register("checkoutMode")}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-xl">💬</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">WhatsApp</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Tes clients t&apos;écrivent pour commander. Recommandé.
                            </p>
                          </div>
                        </div>
                      </label>
                      <label
                        className={cn(
                          "cursor-pointer rounded-lg border-2 p-3 transition-all",
                          watchedCheckoutMode === "online"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <input
                          type="radio"
                          value="online"
                          {...form2.register("checkoutMode")}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-xl">💳</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">Paiement en ligne</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Carte + Mobile Money. Plus de config.
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {watchedCheckoutMode === "whatsapp" && (
                    <div className="space-y-2">
                      <Label htmlFor="whatsappNumber">Ton numéro WhatsApp</Label>
                      <Input
                        id="whatsappNumber"
                        type="tel"
                        inputMode="tel"
                        placeholder="+226 70 00 00 00"
                        {...form2.register("whatsappNumber")}
                        className="h-12"
                      />
                      {form2.formState.errors.whatsappNumber && (
                        <p className="text-sm text-destructive">
                          {form2.formState.errors.whatsappNumber.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Inclure l&apos;indicatif pays (ex: +226 pour le Burkina, +221 pour le Sénégal).
                      </p>
                    </div>
                  )}

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

                <OnboardingPreview
                  shopName={watchedShopName ?? ""}
                  slug={watchedSlug ?? ""}
                  bioTheme={bioTheme}
                />
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 3: Thème de la page bio ─── */}
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
                    C&apos;est ce que verront tes clients depuis ta bio. Tu
                    pourras le changer quand tu veux.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BIO_THEME_LIST.filter((t) => t.id !== "brand").map((theme) => {
                    const palette = resolveBioTheme({
                      bio_theme: theme.id,
                      theme_color: DEFAULT_THEME_COLOR,
                      accent_color: DEFAULT_ACCENT_COLOR,
                    });
                    const selected = bioTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setBioTheme(theme.id)}
                        aria-pressed={selected}
                        title={theme.description}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 text-left transition-all",
                          selected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        {/* Miniature of the page the buyer will land on */}
                        <div
                          className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 p-3"
                          style={{ background: palette.background }}
                        >
                          <span
                            className="size-5 rounded-full"
                            style={{ backgroundColor: palette.surface }}
                          />
                          <span
                            className="h-1 w-8 rounded-full"
                            style={{ backgroundColor: palette.accent }}
                          />
                          <span
                            className="h-3 w-full rounded-full"
                            style={{
                              backgroundColor: palette.surface,
                              border: `1px solid ${palette.border}`,
                            }}
                          />
                          <span
                            className="h-3 w-full rounded-full"
                            style={{
                              backgroundColor: palette.surface,
                              border: `1px solid ${palette.border}`,
                            }}
                          />
                        </div>
                        <p className="px-2.5 py-2 text-xs font-semibold">
                          {theme.label}
                        </p>
                        {selected && (
                          <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary">
                            <Check className="size-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <OnboardingPreview
                  shopName={step2Data?.shopName ?? ""}
                  slug={step2Data?.shopSlug ?? ""}
                  bioTheme={bioTheme}
                />

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
          de Bio-Lien
        </p>
      </div>
    </div>
  );
}
