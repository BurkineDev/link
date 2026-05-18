import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="max-w-xl rounded-3xl border border-border bg-card p-10 shadow-sm">
        <h1 className="text-4xl font-bold">Page introuvable</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Nous n’avons pas trouvé la page que vous cherchiez. Vérifiez l’URL ou retournez au dashboard.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Retour au dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
