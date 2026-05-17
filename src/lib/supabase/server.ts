/**
 * Server-side Supabase client.
 *
 * Creates a new client per request by reading/writing cookies through
 * Next.js's `cookies()` API from `next/headers`.
 *
 * Usage (Server Components, Route Handlers, Server Actions):
 *   import { createClient } from "@/lib/supabase/server";
 *   const supabase = await createClient();
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` is called from Server Components where cookies cannot
            // be mutated. This is safe to ignore — the middleware will
            // handle session refresh.
          }
        },
      },
    },
  );
}
