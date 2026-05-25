import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export const metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="prose prose-sm sm:prose-base max-w-3xl mx-auto px-4 py-10 sm:py-14
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h1:text-3xl sm:prose-h1:text-4xl prose-h1:mb-2
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:leading-relaxed prose-p:text-foreground/85
          prose-li:text-foreground/85
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground">
          {children}
        </article>
      </main>

      <footer className="border-t border-border text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} LinkBoutik ·{" "}
        <Link href="/legal/terms" className="hover:text-foreground">CGU</Link> ·{" "}
        <Link href="/legal/privacy" className="hover:text-foreground">Confidentialité</Link> ·{" "}
        <Link href="/legal/mentions" className="hover:text-foreground">Mentions légales</Link>
      </footer>
    </div>
  );
}
