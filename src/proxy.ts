import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js proxy for LinkBoutik.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session on every request so JWTs don't expire
 *    while the user is actively browsing.
 * 2. Protect /dashboard/** routes — redirect unauthenticated users to /login.
 * 3. Redirect authenticated users away from auth pages (/login, /register, etc.)
 *    to their dashboard.
 */

const PROTECTED_PREFIXES = ["/dashboard"];
// Auth routes that should redirect logged-in users back to /dashboard.
// /reset-password is intentionally excluded: it REQUIRES an active recovery
// session (Supabase exchanges the code-grant before landing here).
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PUBLIC_AUTH_ROUTES = ["/reset-password"];
const ONBOARDING_PATH = "/dashboard/onboarding";

export async function proxy(request: NextRequest) {
  // Expose pathname to downstream Server Components via a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If the env vars aren't present (e.g. preview deployment with vars
  // scoped to Production only), pass the request through without auth
  // checks instead of crashing the runtime with a Supabase client error.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Authenticated user accessing /dashboard/* without completed onboarding
  // is forced to /dashboard/onboarding. /reset-password is exempt: it must
  // remain reachable while authenticated to allow the recovery flow.
  if (user && isProtected && pathname !== ONBOARDING_PATH && !isPublicAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = ONBOARDING_PATH;
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf)$).*)",
  ],
};
