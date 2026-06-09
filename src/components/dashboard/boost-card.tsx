"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BoostCardProps {
  shopId: string;
  featuredUntil: string | null;
}

function formatRemaining(featuredUntil: string): string {
  const ms = new Date(featuredUntil).getTime() - Date.now();
  if (ms <= 0) return "expirée";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours <= 0) return `${minutes} min restantes`;
  return `${hours} h ${minutes.toString().padStart(2, "0")} restantes`;
}

function isBoostActive(featuredUntil: string | null): boolean {
  if (!featuredUntil) return false;
  return new Date(featuredUntil).getTime() > Date.now();
}

export function BoostCard({ shopId, featuredUntil }: BoostCardProps) {
  const [loading, setLoading] = useState(false);

  const active = isBoostActive(featuredUntil);

  async function buy() {
    setLoading(true);
    try {
      const res = await fetch("/api/boosts/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, type: "featured_24h" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Impossible d'activer le boost.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl overflow-hidden border-border/70 shadow-sm">
      <CardHeader
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-[15px] font-bold tracking-tight">
            Mise en avant 24 h
          </CardTitle>
        </div>
        <CardDescription className="mt-0.5 text-xs">
          Ta boutique en haut de l&apos;explore pendant 24 h.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-3">
        {active && featuredUntil ? (
          <>
            <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Boost actif ✨
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRemaining(featuredUntil)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ta boutique apparaît en tête de l&apos;explore jusqu&apos;à
              l&apos;expiration.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-black">1,99 $CA</p>
              <p className="text-xs text-muted-foreground">paiement unique</p>
            </div>
            <Button
              className="w-full h-10 font-semibold rounded-xl gap-2"
              onClick={buy}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Booster ma boutique
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
