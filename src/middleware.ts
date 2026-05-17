import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js middleware for LinkBoutik.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session on every request so JWTs don't expire
 *    while the user is actively browsing.
 * 2. Protect /dashboard/** routes — redirect unauthenticated users to /login.
 * 3. Redirect authenticated users away from auth pages (/login, /register, etc.)
 *    to their dashboard.
 */

// Routes that require an authenticated session
const PROTECTED_PREFIXES = ["/dashboard"];

// Auth routes where authenticated users should not linger
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function middleware(request: NextRequest) {
  // Start with a base response — this lets us forward along mutated cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to both the outgoing request and response so that
          // server components that read cookies() see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — IMPORTANT: do not run any code between createServerClient
  // and getUser() that could prevent the session from being refreshed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // Guard: unauthenticated user trying to access a protected route
  // ------------------------------------------------------------------
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ------------------------------------------------------------------
  // Guard: authenticated user trying to access an auth page
  // ------------------------------------------------------------------
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // ------------------------------------------------------------------
  // Pass through — return the response with refreshed session cookies
  // ------------------------------------------------------------------
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - Public assets in /public (images, fonts, etc.)
     * - API routes handled by Supabase's own auth helpers
     *
     * We intentionally include /api/** so auth tokens are refreshed for
     * Route Handlers as well.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf)$).*)",
  ],
};
