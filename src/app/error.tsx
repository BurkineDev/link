"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="max-w-xl rounded-3xl border border-border bg-card p-10 shadow-sm">
        <h1 className="text-4xl font-bold">Oups...</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Une erreur inattendue est survenue. Nous avons enregistré le problème et vous pouvez réessayer.
        </p>
        <pre className="mt-4 rounded-xl bg-muted p-3 text-left text-xs text-destructive overflow-x-auto">
          {error.message}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>Réessayer</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Retour au dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
