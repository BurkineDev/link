import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth / magic-link callback handler.
 *
 * Supabase redirects here after the user authenticates with an OAuth provider
 * (Google, etc.) or clicks a magic-link / email confirmation link.
 *
 * Query params:
 *   - code  — PKCE authorization code to exchange for a session
 *   - next  — optional redirect path after successful auth (defaults to /dashboard)
 *   - error — set by Supabase when auth fails
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // The `next` param lets callers specify where to redirect after auth.
  // Only allow relative paths to prevent open-redirect attacks.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  // ── Handle provider-level errors (e.g. user cancelled Google OAuth) ─────
  if (error) {
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set(
      "error",
      errorDescription ?? "L'authentification a échoué. Veuillez réessayer.",
    );
    return NextResponse.redirect(errorUrl);
  }

  // ── Exchange code for session ────────────────────────────────────────────
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const errorUrl = new URL("/login", origin);
      errorUrl.searchParams.set(
        "error",
        "Le lien d'authentification a expiré ou est invalide. Veuillez réessayer.",
      );
      return NextResponse.redirect(errorUrl);
    }

    // Success — redirect to the intended destination
    return NextResponse.redirect(new URL(next, origin));
  }

  // ── No code — redirect back to login with a generic error ───────────────
  const fallbackUrl = new URL("/login", origin);
  fallbackUrl.searchParams.set("error", "Paramètre d'authentification manquant.");
  return NextResponse.redirect(fallbackUrl);
}
