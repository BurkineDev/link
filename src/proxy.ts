import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js proxy for LinkBoutik.
 *
 * Responsibilities:
 * 1. Protect /dashboard/** routes — redirect unauthenticated users to /login.
 * 2. Redirect authenticated users away from auth pages (/login, /register, etc.)
 *    to their dashboard.
 * 3. Expose the pathname to Server Components via the `x-pathname` header.
 *
 * Le contrôle ici est volontairement *optimiste* : on regarde si le cookie de
 * session Better Auth est présent, sans le vérifier en base. C'est ce que
 * recommande Better Auth pour un middleware, et ce que demande Next.js pour
 * un proxy — pas de module partagé, pas de connexion à la base sur chaque
 * requête. La vérification réelle de la session (et le renvoi vers
 * l'onboarding) se fait dans le layout du tableau de bord, qui a accès à
 * Prisma. Un cookie périmé passe donc le proxy, puis est rejeté là-bas.
 *
 * Le rafraîchissement de session que faisait l'ancienne version n'a plus de
 * raison d'être : Better Auth gère l'expiration côté serveur, il n'y a pas de
 * JWT à faire tourner.
 */

const PROTECTED_PREFIXES = ["/dashboard"];
// Auth routes that should redirect logged-in users back to /dashboard.
// /reset-password is intentionally excluded: it must stay reachable while
// authenticated so the recovery flow can complete.
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

export async function proxy(request: NextRequest) {
  // Expose pathname to downstream Server Components via a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  // Même préfixe que `advanced.cookiePrefix` dans src/lib/auth.ts — sans lui,
  // le proxy ne verrait jamais le cookie et renverrait tout le monde au login.
  const hasSession = Boolean(
    getSessionCookie(request, { cookiePrefix: "biolien" }),
  );
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute && hasSession) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf)$).*)",
  ],
};
