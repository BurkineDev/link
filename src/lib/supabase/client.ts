"use client";

/**
 * Browser-side Supabase client.
 *
 * Usage (Client Components):
 *   import { createClient } from "@/lib/supabase/client";
 *   const supabase = createClient();
 *
 * The client is memoised — only one instance is created per page load.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return client;
}
