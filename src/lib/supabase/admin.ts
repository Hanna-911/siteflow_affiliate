// Service-role Supabase client — bypasses Row Level Security.
// ONLY import this in server-only code (API routes, cron jobs).
// NEVER import this in a Client Component or expose the key to the browser.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
