import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import { parseStatusRows, type StatusReports } from "@/lib/status-schema";

/**
 * Read layer for /status: the latest CI reports from `status_reports` (one
 * row per kind, upserted by app/api/status/ingest). Public on purpose — the
 * table's RLS allows anon SELECT — so it reads through the cookie-less anon
 * client and the page stays statically rendered (ISR + on-demand revalidation
 * from the ingest endpoint).
 *
 * NEVER THROWS, and fails fast like lib/cms.ts: `.retry(false)` (postgrest-js
 * otherwise retries a failed GET 3x with 1s/2s/4s backoff) and a 3 s abort
 * deadline (a paused project can accept the connection and never answer).
 *
 * `source` lets the page be honest about WHY there's nothing to show:
 *   ok           the read worked; a report may still be null (none yet)
 *   unconfigured no Supabase env (local dev, preview without a database)
 *   unavailable  the database errored / timed out / the table is missing
 * There is no fallback data — a status page with invented numbers is worse
 * than an empty one.
 */
export type StatusSnapshot = StatusReports & {
  source: "ok" | "unconfigured" | "unavailable";
};

const READ_TIMEOUT_MS = 3000;

export const getStatusSnapshot = cache(async (): Promise<StatusSnapshot> => {
  const empty = (source: StatusSnapshot["source"]): StatusSnapshot => ({
    source,
    tests: null,
    lighthouse: null,
  });
  if (!isSupabaseConfigured()) return empty("unconfigured");

  try {
    const { data, error } = await createPublicClient()
      .from("status_reports")
      .select("kind, payload, commit_sha, received_at")
      .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
      .retry(false);
    if (error || !Array.isArray(data)) return empty("unavailable");
    return { source: "ok", ...parseStatusRows(data) };
  } catch {
    return empty("unavailable");
  }
});
