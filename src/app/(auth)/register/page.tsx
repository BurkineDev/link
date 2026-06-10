"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  CheckCircle2,
  XCircle,
  AtSign,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

// ── Validation schema (extended from auth schema to include username) ────────
const registerFormSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Le nom complet doit contenir au moins 2 caractères.")
      .max(100, "Le nom complet ne peut pas dépasser 100 caractères.")
      .trim(),
    username: z
      .string()
      .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.")
      .max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères.")
      .regex(
        /^[a-z0-9_-]+$/,
        "Uniquement des lettres minuscules, chiffres, tirets et underscores.",
      ),
    email: z
      .string()
      .min(1, "L'email est requis.")
      .email("Veuillez saisir une adresse email valide.")
      .toLowerCase(),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .max(72, "Le mot de passe ne peut pas dépasser 72 caractères.")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule.")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre."),
    confirm_password: z.string().min(1, "Veuillez confirmer votre mot de passe."),
    agreed_to_terms: z.boolean().refine((v) => v === true, {
      message: "Vous devez accepter les conditions d'utilisation.",
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirm_password"],
  });

type RegisterFormInput = z.infer<typeof registerFormSchema>;

// ── Username availability indicator ─────────────────────────────────────────
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Password strength bar ────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  const colors = ["bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-green-500", "bg-green-600"];
  const labels = ["", "Faible", "Moyen", "Fort", "Très fort"];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= score ? colors[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={cn("text-xs", score >= 3 ? "text-green-600" : "text-muted-foreground")}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

function UsernameIndicator({ status }: { status: UsernameStatus }) {
  if (status === "checking") {
    return <Loader2 className="size-4 text-muted-foreground animate-spin" />;
  }
  if (status === "available") {
    return <CheckCircle2 className="size-4 text-green-500" />;
  }
  if (status === "taken" || status === "invalid") {
    return <XCircle className="size-4 text-destructive" />;
  }
  return null;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { agreed_to_terms: false },
  });

  const passwordValue = useWatch({ control, name: "password" });
  const usernameValue = useWatch({ control, name: "username" }) ?? "";
  const agreedToTerms = useWatch({ control, name: "agreed_to_terms" });
  const debouncedUsername = useDebounce(usernameValue, 500);

  // ── Real-time username availability check ──────────────────────────────────
  useEffect(() => {
    const trimmed = debouncedUsername.trim();

    if (!trimmed || trimmed.length < 3) {
      queueMicrotask(() => setUsernameStatus("idle"));
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(trimmed)) {
      queueMicrotask(() => setUsernameStatus("invalid"));
      return;
    }

    let cancelled = false;

    async function checkUsername() {
      setUsernameStatus("checking");
      try {
        const supabase = createClient();
        // Check the profiles table for existing username
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", trimmed)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // If the profiles table doesn't exist yet, treat as available
          setUsernameStatus("available");
          return;
        }

        setUsernameStatus(data ? "taken" : "available");
      } catch {
        if (!cancelled) setUsernameStatus("idle");
      }
    }

    checkUsername();
    return () => {
      cancelled = true;
    };
  }, [debouncedUsername]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(data: RegisterFormInput) {
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          username: data.username,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard/onboarding`,
      },
    });

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        toast.error("Un compte existe déjà avec cet email.", {
          description: (
            <span>
              <Link href="/login" className="underline font-medium">
                Connectez-vous
              </Link>{" "}
              ou réinitialisez votre mot de passe.
            </span>
          ),
        });
      } else {
        toast.error("Inscription échouée. Veuillez réessayer.", {
          description: error.message,
        });
      }
      return;
    }

    toast.success("Compte créé avec succès !", {
      description: "Vérifiez vos emails pour confirmer votre inscription.",
    });

    router.push("/login?registered=true");
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogleSignUp() {
    setIsGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard/onboarding`,
      },
    });

    if (error) {
      toast.error("Impossible de se connecter avec Google. Réessayez.");
      setIsGoogleLoading(false);
    }
  }

  const isLoading = isSubmitting || isGoogleLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black text-foreground">Créez votre boutique</h1>
        <p className="text-sm text-muted-foreground">
          Rejoignez +12 000 entrepreneurs africains. C&apos;est gratuit.
        </p>
      </div>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3 font-medium"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleIcon className="size-4" />
        )}
        Continuer avec Google
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground px-1">ou par email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-sm font-medium">
            Nom complet
          </Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="Aminata Diallo"
            className={cn("h-11 text-base", errors.full_name && "border-destructive")}
            aria-invalid={!!errors.full_name}
            disabled={isLoading}
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive" role="alert">
              {errors.full_name.message}
            </p>
          )}
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-sm font-medium">
            Nom d&apos;utilisateur{" "}
            <span className="text-muted-foreground font-normal">(identifiant de boutique)</span>
          </Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="aminata-boutik"
              className={cn(
                "h-11 text-base pl-9 pr-10",
                errors.username && "border-destructive",
                usernameStatus === "available" && "border-green-500 focus-visible:border-green-500",
              )}
              aria-invalid={!!errors.username || usernameStatus === "taken"}
              disabled={isLoading}
              {...register("username")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <UsernameIndicator status={usernameStatus} />
            </div>
          </div>
          {usernameStatus === "taken" && !errors.username && (
            <p className="text-xs text-destructive" role="alert">
              Ce nom d&apos;utilisateur est déjà pris.
            </p>
          )}
          {usernameStatus === "available" && !errors.username && (
            <p className="text-xs text-green-600">Disponible ✓</p>
          )}
          {errors.username && (
            <p className="text-xs text-destructive" role="alert">
              {errors.username.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Votre boutique sera accessible à{" "}
            <span className="font-mono text-foreground">
              bio-lien.com/
              {usernameValue || "votre-boutique"}
            </span>
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Adresse email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@exemple.com"
            className={cn("h-11 text-base", errors.email && "border-destructive")}
            aria-invalid={!!errors.email}
            disabled={isLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn("h-11 text-base pr-10", errors.password && "border-destructive")}
              aria-invalid={!!errors.password}
              disabled={isLoading}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <PasswordStrength password={passwordValue ?? ""} />
          {errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-sm font-medium">
            Confirmer le mot de passe
          </Label>
          <div className="relative">
            <Input
              id="confirm_password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn(
                "h-11 text-base pr-10",
                errors.confirm_password && "border-destructive",
              )}
              aria-invalid={!!errors.confirm_password}
              disabled={isLoading}
              {...register("confirm_password")}
            />
            <button
              type="button"
              aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        {/* Terms */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="agreed_to_terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) =>
                setValue("agreed_to_terms", checked === true, { shouldValidate: true })
              }
              disabled={isLoading}
              className="mt-0.5"
            />
            <Label
              htmlFor="agreed_to_terms"
              className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
            >
              J&apos;accepte les{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                conditions d&apos;utilisation
              </Link>{" "}
              et la{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                politique de confidentialité
              </Link>
              .
            </Label>
          </div>
          {errors.agreed_to_terms && (
            <p className="text-xs text-destructive" role="alert">
              {errors.agreed_to_terms.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 font-semibold gap-2 mt-2"
          disabled={isLoading || usernameStatus === "taken"}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {isSubmitting ? "Création en cours…" : "Créer mon compte"}
        </Button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/login"
          className="text-primary font-semibold hover:underline underline-offset-4"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
