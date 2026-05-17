"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Send, CheckCircle2 } from "lucide-react";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });

    if (error) {
      // Don't reveal if the email exists (security best practice)
      // But do handle genuine errors
      if (!error.message.includes("rate limit")) {
        toast.error("Une erreur est survenue. Veuillez réessayer.");
        return;
      }
      toast.error("Trop de tentatives. Attendez quelques minutes avant de réessayer.");
      return;
    }

    setSentTo(data.email);
    setEmailSent(true);
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.62 0.24 22) 0%, oklch(0.72 0.18 85) 100%)",
            }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Email envoyé !</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Nous avons envoyé un lien de réinitialisation à{" "}
              <span className="font-semibold text-foreground">{sentTo}</span>. Vérifiez aussi vos
              spams.
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 space-y-2 border border-border">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Vous ne recevez pas l&apos;email ?
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Vérifiez votre dossier spam / courrier indésirable</li>
            <li>Assurez-vous que l&apos;adresse email est correcte</li>
            <li>L&apos;email peut prendre quelques minutes</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={() => setEmailSent(false)}
          >
            <Mail className="size-4" />
            Utiliser une autre adresse
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
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black text-foreground">Mot de passe oublié ?</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Saisissez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot
          de passe.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Adresse email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="vous@exemple.com"
              className={cn("h-11 text-base pl-9", errors.email && "border-destructive")}
              aria-invalid={!!errors.email}
              disabled={isSubmitting}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {isSubmitting ? "Envoi en cours…" : "Envoyer le lien"}
        </Button>
      </form>

      {/* Back link */}
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
