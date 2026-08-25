import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon client for PUBLIC reads (published projects, site settings).
 *
 * Deliberately not the @supabase/ssr server client: that one calls cookies(),
 * which opts the calling route out of static rendering and forces an SSR pass on
 * every request. Public content is guarded by RLS, not by a session, so it needs
 * no cookies — and this way /projects stays cacheable, with the admin's
 * revalidatePath() calls busting it on publish.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
