"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import {
  Store,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Palette,
  Target,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import {
  BIO_THEME_LIST,
  DEFAULT_BIO_THEME,
  groupBioThemes,
  isBioThemeId,
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
import { BioThemeSwatch } from "@/components/dashboard/bio-theme-swatch";
import {
  INTENTION_META,
  INTENTIONS,
  SOCIAL_NETWORK_META,
  SOCIAL_NETWORKS,
  seedBlocksForIntentions,
  type Intention,
  type SocialNetwork,
} from "@/lib/onboarding/intentions";
import { usernameSchema } from "@/lib/validations/auth";
import { useDebounce } from "@/hooks/use-debounce";
import { isValidE164 } from "@/lib/phone/dial-codes";
import { WhatsAppNumberField } from "@/components/dashboard/whatsapp-number-field";
import {
  browserDraftStorage,
  clearDraft,
  loadDraft,
  resumeStep,
  saveDraft,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";

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
  { id: 3, label: "Objectifs", icon: "🎯" },
  { id: 4, label: "Thème", icon: "🎨" },
  { id: 5, label: "Terminé", icon: "🎉" },
];

// ─── Schemas ─────────────────────────────────────────────────
const step1Schema = z.object({
  fullName: z.string().min(2, "Minimum 2 caractères"),
  // Same rule as the register page and the DB constraint — the seller must
  // never see their signup username rejected here.
  username: usernameSchema,
});

/**
 * Écran Boutique. Caisse masquée (voir src/lib/payments/online-checkout.ts),
 * toute boutique prend ses commandes sur WhatsApp : le numéro est exigé
 * quel que soit le mode porté par le formulaire.
 */
function step2Schema(onlineCheckout: boolean) {
  return z
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
      // Le champ ne renvoie qu'un numéro composé valide (indicatif + longueur
      // du pays) ou "" : un numéro sans indicatif ne peut plus passer.
      const needsNumber = !onlineCheckout || data.checkoutMode === "whatsapp";
      if (needsNumber && !isValidE164(data.whatsappNumber ?? "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappNumber"],
          message: "Choisis l'indicatif et saisis un numéro WhatsApp complet.",
        });
      }
    });
}

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<ReturnType<typeof step2Schema>>;

/**
 * Thèmes proposés à l'inscription : tous sauf « Mes couleurs », qui reprend
 * des couleurs que la boutique n'a pas encore. L'ordre et les groupes sont
 * ceux de BIO_THEME_LIST ; Wax est présélectionné (DEFAULT_BIO_THEME).
 */
const ONBOARDING_THEMES = BIO_THEME_LIST.filter((theme) => theme.id !== "brand");

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

/** Objectifs retenus quand le vendeur passe l'écran : vendre, et sur WhatsApp si c'est son mode. */
function defaultIntentions(checkoutMode: "whatsapp" | "online"): Intention[] {
  return checkoutMode === "whatsapp" ? ["sell", "whatsapp"] : ["sell"];
}

export interface SessionProfile {
  fullName: string | null;
  username: string | null;
}

/** Même règle que l'auto-génération de l'écran Boutique. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
}

/**
 * Le serveur connaît déjà l'utilisateur (le layout l'a vérifié) : il passe
 * l'identifiant et le profil. Il ne reste au navigateur qu'à lire le
 * brouillon, une fois monté, avant de monter l'assistant avec ses états
 * partant des bonnes valeurs — un seul rendu d'attente, aucun aller-retour
 * réseau.
 */
export default function OnboardingClient({
  userId,
  profile,
  nextPath,
  onlineCheckout,
}: {
  userId: string;
  profile: SessionProfile;
  nextPath: string | null;
  /** Caisse Bio-Lien allumée : le vendeur choisit entre WhatsApp et le paiement en ligne. Éteinte : WhatsApp, point. */
  onlineCheckout: boolean;
}) {
  const [draft, setDraft] = useState<OnboardingDraft | null | undefined>(undefined);
  useEffect(() => {
    // Lecture du stockage : externe à React, donc dans un effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraft(browserDraftStorage(), userId));
  }, [userId]);

  if (draft === undefined) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Logo size="md" />
            <Badge variant="outline" className="text-xs">
              Configuration initiale
            </Badge>
          </div>
        </header>
        <div className="container mx-auto flex max-w-2xl justify-center px-4 py-24" aria-busy="true">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <OnboardingWizard
      key={userId}
      userId={userId}
      profile={profile}
      draft={draft}
      nextPath={nextPath}
      onlineCheckout={onlineCheckout}
    />
  );
}

function OnboardingWizard({
  userId,
  profile,
  draft,
  nextPath,
  onlineCheckout,
}: {
  userId: string;
  profile: SessionProfile;
  draft: OnboardingDraft | null;
  /** Le visiteur qui avait choisi un plan avant de s'inscrire y retourne (déjà validé par le serveur). */
  nextPath: string | null;
  onlineCheckout: boolean;
}) {
  const router = useRouter();
  const exitTo = nextPath ?? "/dashboard";

  // Nom et pseudo ont été saisis à l'inscription : l'écran Profil est passé
  // d'office, le vendeur peut y revenir d'un tap.
  const profileKnown = Boolean(profile.fullName && profile.username);
  const [step, setStep] = useState(() =>
    draft ? resumeStep(draft, profileKnown) : profileKnown ? 2 : 1,
  );
  const [resumed, setResumed] = useState(draft !== null);
  const [loading, setLoading] = useState(false);
  const [bioTheme, setBioTheme] = useState<BioThemeId>(() =>
    isBioThemeId(draft?.bioTheme) ? draft.bioTheme : DEFAULT_BIO_THEME,
  );

  // Step 1 data
  const [step1Data, setStep1Data] = useState<Step1Values | null>(() => {
    if (draft?.step1?.fullName && draft.step1.username) return draft.step1;
    if (profileKnown) return { fullName: profile.fullName!, username: profile.username! };
    return null;
  });
  const [step2Data, setStep2Data] = useState<Step2Values | null>(() =>
    draft?.step2?.shopName && draft.step2.shopSlug
      ? // Caisse masquée : un brouillon « online » repris est ignoré, le mode
        // est WhatsApp (le numéro manquant est rattrapé à la fin).
        { ...draft.step2, checkoutMode: onlineCheckout ? draft.step2.checkoutMode : "whatsapp" }
      : null,
  );

  // Step 3 — ce que le vendeur veut faire, et le minimum pour le lui livrer.
  const [intentions, setIntentions] = useState<Intention[]>(
    () => (draft?.intentions ?? []).filter((i): i is Intention => INTENTIONS.includes(i as Intention)),
  );
  const [handles, setHandles] = useState<Partial<Record<SocialNetwork, string>>>(() =>
    Object.fromEntries(
      SOCIAL_NETWORKS.flatMap((network) =>
        draft?.handles?.[network] ? [[network, draft.handles[network]]] : [],
      ),
    ),
  );
  const [announcement, setAnnouncement] = useState(draft?.announcement ?? "");

  // Écran Terminé : la boutique existe, reste à la publier.
  const [created, setCreated] = useState<{ id: string; slug: string; published: boolean } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const toggleIntention = (value: Intention) =>
    setIntentions((current) =>
      current.includes(value)
        ? current.filter((i) => i !== value)
        : [...current, value],
    );

  // Slug availability
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullName: draft?.step1?.fullName || profile.fullName || "",
      username: draft?.step1?.username || profile.username || "",
    },
  });
  // Le drapeau est figé au build : le schéma ne change pas pendant la session.
  const step2Resolver = useMemo(() => zodResolver(step2Schema(onlineCheckout)), [onlineCheckout]);
  const form2 = useForm<Step2Values>({
    resolver: step2Resolver,
    defaultValues: {
      shopName: draft?.step2?.shopName ?? "",
      shopSlug: draft?.step2?.shopSlug ?? "",
      description: draft?.step2?.description ?? "",
      currency: draft?.step2?.currency ?? "XOF",
      // Caisse masquée : un brouillon « online » (repris d'avant) est ignoré,
      // le mode est WhatsApp.
      checkoutMode: onlineCheckout ? (draft?.step2?.checkoutMode ?? "whatsapp") : "whatsapp",
      whatsappNumber: draft?.step2?.whatsappNumber ?? "",
    },
  });
  // Un slug repris du brouillon qui ne découle pas du nom a été choisi :
  // l'auto-génération ne doit pas l'écraser. S'il en découle, renommer la
  // boutique continue de le mettre à jour, comme avant.
  const slugPinned = useRef(
    Boolean(draft?.step2?.shopSlug) && draft?.step2?.shopSlug !== slugify(draft?.step2?.shopName ?? ""),
  );
  // Remonte le champ WhatsApp (qui garde son propre état) après « Recommencer ».
  const [formEpoch, setFormEpoch] = useState(0);
  const watchedCheckoutMode = useWatch({
    control: form2.control,
    name: "checkoutMode",
  });
  // Le mode qui s'applique vraiment : caisse masquée, WhatsApp quoi que
  // porte le formulaire.
  const effectiveMode: "whatsapp" | "online" = onlineCheckout ? watchedCheckoutMode : "whatsapp";

  const watchedSlug = useWatch({ control: form2.control, name: "shopSlug" });
  const watchedCurrency = useWatch({ control: form2.control, name: "currency" });
  const debouncedSlug = useDebounce(watchedSlug, 500);
  const watchedShopName = useWatch({ control: form2.control, name: "shopName" });
  const watchedForm1 = useWatch({ control: form1.control });
  const watchedForm2 = useWatch({ control: form2.control });

  // Brouillon : chaque saisie est enregistrée dans le navigateur, un peu
  // après la frappe — et tout de suite quand l'onglet passe en arrière-plan
  // (c'est là qu'il se fait purger). Effacé à la création de la boutique.
  const fullName = watchedForm1.fullName ?? "";
  const username = watchedForm1.username ?? "";
  // Le profil pré-rempli depuis le compte n'est pas une saisie : sans lui,
  // un écran 2 encore vide ne mérite pas de brouillon.
  const step1ForDraft =
    fullName === (profile.fullName ?? "") && username === (profile.username ?? "")
      ? null
      : { fullName, username };
  const snapshot = {
    step,
    step1: step1ForDraft,
    step2: {
      shopName: watchedForm2.shopName ?? "",
      shopSlug: watchedForm2.shopSlug ?? "",
      description: watchedForm2.description ?? "",
      currency: watchedForm2.currency ?? "XOF",
      checkoutMode: watchedForm2.checkoutMode ?? "whatsapp",
      whatsappNumber: watchedForm2.whatsappNumber ?? "",
    },
    intentions,
    handles: Object.fromEntries(
      Object.entries(handles).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
    announcement,
    bioTheme,
  };
  // Dernier instantané, lisible depuis les écouteurs de visibilité (hors
  // rendu) : mis à jour après chaque rendu.
  const snapshotRef = useRef(snapshot);
  const createdRef = useRef(created);
  useEffect(() => {
    snapshotRef.current = snapshot;
    createdRef.current = created;
  });

  useEffect(() => {
    if (created) return;
    const timer = setTimeout(() => saveDraft(browserDraftStorage(), userId, snapshotRef.current), 400);
    return () => clearTimeout(timer);
  }, [userId, created, step, watchedForm1, watchedForm2, intentions, handles, announcement, bioTheme]);

  useEffect(() => {
    const flush = () => {
      if (!createdRef.current) saveDraft(browserDraftStorage(), userId, snapshotRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [userId]);

  const restart = () => {
    clearDraft(browserDraftStorage(), userId);
    form1.reset({ fullName: profile.fullName ?? "", username: profile.username ?? "" });
    form2.reset({ shopName: "", shopSlug: "", description: "", currency: "XOF", checkoutMode: "whatsapp", whatsappNumber: "" });
    slugPinned.current = false;
    setStep1Data(profileKnown ? { fullName: profile.fullName!, username: profile.username! } : null);
    setStep2Data(null);
    setIntentions([]);
    setHandles({});
    setAnnouncement("");
    setBioTheme(DEFAULT_BIO_THEME);
    setResumed(false);
    setFormEpoch((n) => n + 1);
    setStep(profileKnown ? 2 : 1);
  };

  // Auto-generate slug from shop name
  useEffect(() => {
    if (watchedShopName && !form2.formState.dirtyFields.shopSlug && !slugPinned.current) {
      form2.setValue("shopSlug", slugify(watchedShopName));
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
      // Même vérification que le serveur au moment de créer : longueur,
      // caractères, slugs réservés, unicité.
      // Réseau coupé : on ne sait pas, le serveur tranchera à la création
      // (409 SLUG_TAKEN) — plutôt que de bloquer l'écran sur un faux « pris ».
      let available: boolean | null = false;
      try {
        const res = await fetch(
          `/api/shops/check-slug?slug=${encodeURIComponent(debouncedSlug)}`,
        );
        const json = (await res.json()) as { available?: boolean };
        available = res.ok ? json.available === true : null;
      } catch {
        available = null;
      }
      if (!cancelled) {
        setSlugAvailable(available);
        setCheckingSlug(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
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

    // Caisse masquée, le serveur refuse « online » : on envoie toujours
    // WhatsApp, quel que soit le mode porté par le formulaire.
    const checkoutMode = onlineCheckout ? step2Data.checkoutMode : "whatsapp";
    const whatsappNumber =
      checkoutMode === "whatsapp"
        ? (step2Data.whatsappNumber ?? "").replace(/\D/g, "")
        : null;
    // Un brouillon « online » repris n'a pas de numéro : retour à l'écran
    // Boutique, l'erreur sur le bon champ — plutôt qu'un 422 en toast.
    if (checkoutMode === "whatsapp" && !isValidE164(whatsappNumber)) {
      form2.setError("whatsappNumber", { message: "Choisis l'indicatif et saisis un numéro WhatsApp complet." });
      setStep(2);
      return;
    }
    setLoading(true);

    try {
      // La première page est composée à partir des intentions ; le serveur
      // crée profil, boutique et blocs en une seule transaction. Sans
      // objectif choisi, la page reçoit le strict nécessaire pour vendre.
      const effectiveIntentions =
        intentions.length > 0 ? intentions : defaultIntentions(checkoutMode);
      const seeds = seedBlocksForIntentions({
        intentions: effectiveIntentions,
        whatsappNumber: whatsappNumber ?? undefined,
        handles,
        announcement,
        shopName: step2Data.shopName,
      });

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: step1Data.fullName,
          username: step1Data.username,
          shop: {
            name: step2Data.shopName,
            slug: step2Data.shopSlug,
            description: step2Data.description ?? null,
            currency: step2Data.currency,
            checkoutMode,
            whatsappNumber,
            bioTheme,
            intentions: effectiveIntentions,
          },
          blocks: seeds.map((seed) => ({
            type: seed.type,
            position: seed.position,
            title: seed.title,
            config: seed.config,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          shopId?: string | null;
          slug?: string | null;
        };
        // La boutique existe déjà (double envoi, rechargement) : on la
        // montre, plutôt que de renvoyer en silence.
        if (body.code === "ALREADY_ONBOARDED") {
          clearDraft(browserDraftStorage(), userId);
          if (body.shopId) {
            setCreated({ id: body.shopId, slug: body.slug ?? step2Data.shopSlug, published: false });
            setStep(5);
            toast.info("Ta boutique existe déjà — la voici.");
          } else {
            router.replace(exitTo);
          }
          return;
        }
        // Pris entre-temps : retour au bon écran, l'erreur sur le bon champ.
        if (body.code === "USERNAME_TAKEN") {
          form1.setError("username", { message: body.error ?? "Ce pseudo est déjà pris." });
          setStep(1);
          return;
        }
        if (body.code === "SLUG_TAKEN") {
          form2.setError("shopSlug", { message: body.error ?? "Cette adresse est déjà prise." });
          setSlugAvailable(false);
          setStep(2);
          return;
        }
        if (body.code === "WHATSAPP_NUMBER_REQUIRED") {
          form2.setError("whatsappNumber", { message: body.error ?? "Ton numéro WhatsApp est obligatoire." });
          setStep(2);
          return;
        }
        throw new Error(body.error ?? "Une erreur est survenue");
      }
      const body = (await res.json()) as { shopId: string };

      clearDraft(browserDraftStorage(), userId);
      setCreated({ id: body.shopId, slug: step2Data.shopSlug, published: false });
      setStep(5);
      toast.success("Ta boutique est créée ! 🎉");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  // Écran Terminé : publier tout de suite, sans chercher le bandeau du
  // tableau de bord.
  const handlePublish = async () => {
    if (!created) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/shops/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Impossible de publier la boutique.");
      }
      setCreated({ ...created, published: true });
      toast.success("Ta page est en ligne !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de publier la boutique.");
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl =
    typeof window !== "undefined" && created
      ? `${window.location.origin}/${created.slug}`
      : created
        ? `/${created.slug}`
        : "";

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

        {resumed && !created && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
            <p className="text-muted-foreground">On a repris là où tu t&apos;étais arrêté.</p>
            <button
              type="button"
              onClick={restart}
              className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Recommencer
            </button>
          </div>
        )}

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
                      maxLength={100}
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
                        maxLength={30}
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

                {step1Data && (
                  <p className="flex flex-wrap items-center justify-center gap-x-2 rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
                    <span>
                      Profil : <span className="font-semibold text-foreground">{step1Data.fullName}</span>{" "}
                      · @{step1Data.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      Modifier
                    </button>
                  </p>
                )}

                <form onSubmit={handleStep2} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shopName">Nom de ta boutique</Label>
                    <Input
                      id="shopName"
                      maxLength={100}
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
                        maxLength={50}
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
                      maxLength={500}
                      aria-invalid={!!form2.formState.errors.description}
                      {...form2.register("description")}
                    />
                    {form2.formState.errors.description && (
                      <p className="text-sm text-destructive">
                        {form2.formState.errors.description.message}
                      </p>
                    )}
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

                  {onlineCheckout ? (
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
                  ) : (
                    // Caisse masquée : pas de choix, WhatsApp est le fonctionnement.
                    <div className="space-y-1 pt-2 border-t border-border">
                      <Label className="pt-2 block">Tes commandes arrivent sur WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">
                        Le client t&apos;écrit avec sa commande déjà rédigée ;
                        tu la marques payée dans ton tableau de bord. Tu
                        pourras changer de numéro depuis les paramètres.
                      </p>
                    </div>
                  )}

                  {effectiveMode === "whatsapp" && (
                    <div className="space-y-2">
                      <WhatsAppNumberField
                        key={formEpoch}
                        id="whatsappNumber"
                        value={form2.getValues("whatsappNumber") ?? ""}
                        onChange={(digits) =>
                          form2.setValue("whatsappNumber", digits, { shouldValidate: true, shouldDirty: true })
                        }
                        currency={watchedCurrency}
                        inputClassName="h-12"
                      />
                      {form2.formState.errors.whatsappNumber && (
                        <p className="text-sm text-destructive">
                          {form2.formState.errors.whatsappNumber.message}
                        </p>
                      )}
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


          {/* ─── STEP 3: Intentions ─── */}
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
                    <Target className="h-10 w-10 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold">
                    Que veux-tu faire avec Bio-Lien&nbsp;?
                  </h1>
                  <p className="text-muted-foreground">
                    Choisis tout ce qui te correspond, ou passe : on prépare
                    ta page à partir de ça — tu pourras tout changer ensuite.
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Tes objectifs"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {INTENTIONS.map((value) => {
                    const meta = INTENTION_META[value];
                    const selected = intentions.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleIntention(value)}
                        aria-pressed={selected}
                        className={cn(
                          "relative rounded-xl border-2 p-4 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="text-2xl" aria-hidden>
                          {meta.emoji}
                        </span>
                        <p className="mt-2 font-semibold text-sm">{meta.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {meta.description}
                        </p>
                        {selected && (
                          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary">
                            <Check className="size-3 text-primary-foreground" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Le minimum pour que l'intention produise vraiment un bloc :
                    demandé ici, une fois, plutôt que laissé à découvrir dans
                    un éditeur vide. */}
                {intentions.includes("socials") && (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold">
                      Tes réseaux — on en fait des boutons
                    </p>
                    {SOCIAL_NETWORKS.map((network) => (
                      <div key={network} className="space-y-1.5">
                        <Label htmlFor={`handle-${network}`} className="text-xs">
                          {SOCIAL_NETWORK_META[network].label}
                        </Label>
                        <Input
                          id={`handle-${network}`}
                          maxLength={200}
                          value={handles[network] ?? ""}
                          onChange={(e) =>
                            setHandles((current) => ({
                              ...current,
                              [network]: e.target.value,
                            }))
                          }
                          placeholder={SOCIAL_NETWORK_META[network].placeholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-11"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Ton pseudo suffit, ou colle l&apos;adresse complète. Laisse
                      vide ce que tu n&apos;utilises pas.
                    </p>
                  </div>
                )}

                {intentions.includes("promote") && (
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                    <Label htmlFor="announcement" className="text-sm font-semibold">
                      Ton annonce du moment
                    </Label>
                    <Textarea
                      id="announcement"
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      placeholder="Livraison offerte à Ouaga jusqu'à dimanche 🎉"
                      rows={2}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground">
                      Elle s&apos;affichera tout en haut de ta page.
                    </p>
                  </div>
                )}

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
                    type="button"
                    className="flex-1 h-12 gap-2"
                    onClick={() => setStep(4)}
                  >
                    {intentions.length === 0 ? "Passer" : "Continuer"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                {intentions.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground -mt-2">
                    {effectiveMode === "whatsapp"
                      ? "Sans objectif, ta page part avec l'essentiel : tes produits et un bouton WhatsApp."
                      : "Sans objectif, ta page part avec l'essentiel : tes produits."}
                  </p>
                )}
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 4: Thème de la page bio ─── */}
          {step === 4 && (
            <motion.div
              key="step4"
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

                {/* Les thèmes par groupe, l'Afrique de l'Ouest en tête.
                    « Mes couleurs » attend que la boutique ait ses couleurs :
                    il n'est pas proposé ici. */}
                {groupBioThemes(ONBOARDING_THEMES).map((group) => (
                  <div key={group.group} className="space-y-2">
                    <h2
                      id={`onboarding-theme-group-${group.group}`}
                      className="text-sm font-semibold"
                    >
                      {group.label}
                    </h2>
                    {group.group === "afrique" && (
                      <p className="text-xs text-muted-foreground">
                        Pensés pour le plein soleil et les petits écrans.
                      </p>
                    )}
                    <div
                      role="group"
                      aria-labelledby={`onboarding-theme-group-${group.group}`}
                      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                    >
                      {group.themes.map((theme) => {
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
                            <div className="aspect-[4/3] overflow-hidden">
                              <BioThemeSwatch
                                themeId={theme.id}
                                primaryColor={DEFAULT_THEME_COLOR}
                                accentColor={DEFAULT_ACCENT_COLOR}
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
                  </div>
                ))}

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
                    onClick={() => setStep(3)}
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
          {/* ─── STEP 5: Terminé ─── */}
          {step === 5 && created && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <div className="text-4xl" aria-hidden="true">🎉</div>
                  <h1 className="text-2xl font-bold">Ta boutique est créée</h1>
                  <p className="text-muted-foreground">
                    {created.published
                      ? "Elle est en ligne : partage ton lien dans ta bio."
                      : "Il ne reste qu'à la publier pour que tes clients la voient."}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground">Ton lien</p>
                  <p className="break-all font-mono text-sm font-semibold">{publicUrl}</p>
                </div>

                {created.published ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="outline" className="flex-1 h-12 gap-2">
                      <a href={`/${created.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> Voir ma page
                      </a>
                    </Button>
                    <Button className="flex-1 h-12 gap-2" onClick={() => router.replace(exitTo)}>
                      {nextPath ? "Continuer" : "Aller au tableau de bord"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Button className="h-12 gap-2" onClick={handlePublish} disabled={publishing}>
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publier ma page maintenant</>}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-12"
                      onClick={() => router.replace(exitTo)}
                      disabled={publishing}
                    >
                      Plus tard — ajouter des produits d&apos;abord
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Tu pourras publier à tout moment depuis le tableau de bord.
                    </p>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          En créant ta boutique, tu acceptes les{" "}
          <Link href="/legal/terms" className="underline hover:text-primary">
            conditions d&apos;utilisation
          </Link>{" "}
          de Bio-Lien
        </p>
      </div>
    </div>
  );
}
