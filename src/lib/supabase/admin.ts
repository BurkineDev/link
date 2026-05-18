/**
 * Supabase admin client — uses the service role key.
 *
 * ⚠️  SERVER ONLY — never import this file in Client Components or expose
 *     the service role key to the browser. It bypasses all Row Level Security.
 *
 * Usage:
 *   import { adminClient } from "@/lib/supabase/admin";
 *
 * Typical use cases:
 *   - Webhook handlers that need to write data regardless of the caller's session
 *   - Background jobs / cron functions
 *   - Admin-panel actions that intentionally bypass RLS
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      // Disable auto-refresh — admin client is stateless per request.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _adminClient: ReturnType<typeof createAdminClient> | undefined;

export function getAdminClient() {
  if (!_adminClient) _adminClient = createAdminClient();
  return _adminClient;
}
