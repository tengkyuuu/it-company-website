// @ts-check
/**
 * The CMS switch — the ONE place that decides whether this build talks to
 * Supabase at all. Plain .mjs so next.config.mjs, the Edge middleware, server
 * code and client components can all import the same answer.
 *
 * Opt-in: the CMS is on only when NEXT_PUBLIC_CMS_ENABLED is exactly "true"
 * AND the project URL is set. Why opt-in rather than "on whenever the URL is
 * set": on 2026-10-19 the project's Supabase instance had been deleted while
 * its URL was still in the Vercel settings, which nobody on the team could edit
 * at the time. Every page view then polled a host that no longer resolved, the
 * admin offered a sign-in that could never work, and /status waited for
 * reports with nowhere to store them. With the switch off, the site runs in
 * static-content mode (lib/site.ts, lib/work.ts …) no matter what else is set.
 *
 * To turn the CMS on: create the project, run supabase/schema.sql, set the
 * Supabase vars AND NEXT_PUBLIC_CMS_ENABLED=true, then redeploy (NEXT_PUBLIC_*
 * values are inlined at build time).
 *
 * Each call reads process.env afresh, so tests can flip it per case. Next still
 * inlines the NEXT_PUBLIC_* reads into client bundles, because they are written
 * out literally below.
 */

/** True when the CMS is switched on (see above). */
export function cmsEnabled() {
  return process.env.NEXT_PUBLIC_CMS_ENABLED === "true";
}

/** The Supabase project URL, or "" whenever the CMS is switched off. */
export function supabaseUrl() {
  return cmsEnabled() ? process.env.NEXT_PUBLIC_SUPABASE_URL || "" : "";
}
