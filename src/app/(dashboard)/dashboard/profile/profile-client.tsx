"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserIcon, Sparkles, ArrowRight, Crown, CalendarClock } from "lucide-react";

import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProfileData = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
} | null;

type SubscriptionData = {
  plan: "free" | "pro";
  status: "active" | "trialing" | "past_due" | "cancelled" | "incomplete";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

export function ProfileClient({
  email,
  profile,
  subscription,
}: {
  email: string;
  profile: ProfileData;
  subscription: SubscriptionData;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      username: profile?.username ?? "",
      bio: profile?.bio ?? "",
    },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name ?? null,
          username: values.username ?? null,
          bio: values.bio ?? null,
        })
        .eq("id", profile?.id ?? "");

      if (error) {
        toast.error(
          error.code === "23505"
            ? "Ce nom d'utilisateur est déjà pris."
            : "Impossible de mettre à jour le profil.",
        );
        return;
      }

      toast.success("Profil mis à jour.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function openBillingPortal() {
    setIsOpeningBilling(true);
    try {
      const res = await fetch("/api/subscription/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Impossible d'ouvrir le portail de facturation.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setIsOpeningBilling(false);
    }
  }

  const isPro = subscription?.plan === "pro" && subscription.status !== "cancelled";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gère tes informations personnelles et ton abonnement.
        </p>
      </div>

      {/* Subscription card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {isPro ? (
                  <Crown className="size-5 text-primary" />
                ) : (
                  <Sparkles className="size-5 text-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">
                    Plan {isPro ? "Pro" : "Gratuit"}
                  </h2>
                  {subscription?.status === "past_due" && (
                    <Badge variant="destructive">Paiement en retard</Badge>
                  )}
                  {subscription?.cancel_at_period_end && (
                    <Badge variant="secondary">Annulation programmée</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isPro
                    ? "Produits illimités · 0% commission · Analytics avancés"
                    : "Jusqu'à 5 produits · 5% de commission sur les ventes"}
                </p>
                {subscription?.current_period_end && isPro && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <CalendarClock className="size-3" />
                    {subscription.cancel_at_period_end ? "Se termine le" : "Renouvellement le"}{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            <div>
              {isPro ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openBillingPortal}
                  disabled={isOpeningBilling}
                >
                  {isOpeningBilling ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Gérer l&apos;abonnement
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/pricing">
                    Passer en Pro
                    <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
              <UserIcon className="size-5 text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold">Informations personnelles</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="h-11" />
              <p className="text-xs text-muted-foreground">
                L&apos;email ne peut pas être modifié depuis cette page.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                placeholder="Fatou Diallo"
                className="h-11"
                aria-invalid={!!errors.full_name}
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Nom d&apos;utilisateur</Label>
              <div className="flex items-center gap-2 border rounded-md px-3 h-11 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-muted-foreground text-sm">@</span>
                <input
                  id="username"
                  placeholder="fatou_diallo"
                  className="flex-1 bg-transparent outline-none text-sm"
                  {...register("username", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase();
                    },
                  })}
                />
              </div>
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                placeholder="Parle un peu de toi…"
                className="resize-none"
                aria-invalid={!!errors.bio}
                {...register("bio")}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSaving} className="h-11 font-semibold">
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
