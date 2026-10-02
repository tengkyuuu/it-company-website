import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it must NEVER reach the browser —
 * the "server-only" import above makes bundling it into client code a build
 * error rather than a silent key leak.
 *
 * Only used for things the anon key genuinely cannot (or must not) do:
 * creating / listing / updating / deleting auth users (app/admin/team-actions.ts,
 * app/admin/auth/actions.ts), the auth_tokens table and the
 * revoke_user_sessions / consume_security_limit RPCs (service role only),
 * writing public.invitations and activity_log (no write policy for anyone
 * else), restoring the OWNER_EMAIL profile (getAccess in ./server.ts), and the
 * inbox's lead inserts (lib/leads.ts).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required to invite or remove teammates."
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
