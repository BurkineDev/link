"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // The Supabase recovery callback (/api/auth/callback) exchanges the code
  // for a session before redirecting here. If no session exists, the link
  // has expired or the user opened the page directly.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
    });
  }, []);

  async function onSubmit(data: ResetPasswordInput) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("same")
          ? "Le nouveau mot de passe doit être différent de l'ancien."
          : "Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré.",
      );
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  if (hasSession === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-black text-foreground">Lien expiré ou invalide</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien de réinitialisation n&apos;est plus valide. Demandez-en un nouveau.
          </p>
        </div>
        <Button asChild className="w-full h-11 font-semibold">
          <Link href="/forgot-password">Demander un nouveau lien</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="text-primary font-semibold hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3" />
            Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--success)] text-[var(--success-foreground)]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Mot de passe mis à jour</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Redirection vers ton tableau de bord…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black text-foreground">Nouveau mot de passe</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choisis un nouveau mot de passe sécurisé. Minimum 8 caractères avec au moins une
          majuscule et un chiffre.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Nouveau mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn("h-11 text-base pl-9 pr-10", errors.password && "border-destructive")}
              aria-invalid={!!errors.password}
              disabled={isSubmitting}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Masquer" : "Afficher"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-sm font-medium">
            Confirmer le mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn(
                "h-11 text-base pl-9",
                errors.confirm_password && "border-destructive",
              )}
              aria-invalid={!!errors.confirm_password}
              disabled={isSubmitting}
              {...register("confirm_password")}
            />
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Mise à jour…
            </>
          ) : (
            "Réinitialiser le mot de passe"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="text-primary font-semibold hover:underline underline-offset-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
