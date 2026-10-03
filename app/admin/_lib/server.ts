import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getAccess, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/lib/supabase/types";
import type { ConflictInfo } from "./autosave";

// The pure form helpers moved to ./schemas.ts (a plain module the autosave
// route and the tests share); re-exported so existing imports keep working.
export { int, readGallery, str, toList } from "./schemas";

/**
 * Shared plumbing for the panel's server actions and pages.
 *
 * It lives here rather than in actions.ts / content-actions.ts because a
 * `"use server"` module may only export async functions — constants and plain
 * helpers can't be exported from one. `_lib` is a private folder, so Next never
 * treats it as a route.
 */

/** What every panel action returns. Structurally identical to `ActionResult`. */
export type Result = {
  ok: boolean;
  message: string;
  /** field name -> message, rendered next to the input that caused it */
  fieldErrors?: Record<string, string>;
  /** id of a row the action just created, so the client can navigate to it */
  id?: string;
  /** the row's new updated_at after a save — the form's next concurrency token */
  updatedAt?: string;
  /** set when the save was refused because someone saved a newer version */
  conflict?: ConflictInfo;
};

export const ok = (message: string, extra: Partial<Result> = {}): Result => ({
  ...extra,
  ok: true,
  message,
});

export const fail = (message: string, fieldErrors?: Record<string, string>): Result => ({
  ok: false,
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

/** Every mutation goes through this: no session, no writes. */
export async function requireStaff() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  return profile;
}

/**
 * Team management (invite, resend, revoke, disable/enable, reset, remove) is
 * the owner's alone; admins edit content. Returns a result to hand back
 * rather than throwing, so the Team page shows a sentence, not an error page.
 * The database agrees independently: team-management RLS uses is_owner().
 */
export async function requireOwner(): Promise<{ me: ProfileRow } | { denied: Result }> {
  const me = await requireStaff();
  if (me.role !== "owner") {
    return { denied: fail("Only the owner can manage the team.") };
  }
  return { me };
}

/**
 * requireStaff() for Route Handlers (app/api/admin/**). A Route Handler is a
 * public POST endpoint exactly like a Server Action — middleware.ts doesn't
 * even run for /api — so each one checks the session itself
 * (tests/route-guards.test.ts fails the build otherwise). Answers with JSON
 * instead of redirecting: the caller is fetch(), which would otherwise follow
 * the redirect and get the login page's HTML back as a "200".
 */
export async function requireStaffForRoute(): Promise<
  { profile: ProfileRow } | { response: NextResponse }
> {
  const noStore = { "Cache-Control": "no-store" };
  const access = await getAccess();
  if (access.state === "signed-out") {
    return {
      response: NextResponse.json(
        { ok: false, error: "Your session has expired — sign in again in another tab. Your edits are kept here." },
        { status: 401, headers: noStore }
      ),
    };
  }
  if (access.state !== "ok") {
    return {
      response: NextResponse.json(
        { ok: false, error: "Your account no longer has access to the panel." },
        { status: 403, headers: noStore }
      ),
    };
  }
  return { profile: access.profile };
}

/**
 * Append a line to public.activity_log with the service role (it has no
 * insert policy). For team.* / auth.* events — content changes are logged by a
 * database trigger. NEVER throws and never fails the action that called it:
 * an audit line is worth having, not worth refusing an invite over.
 * Never put a token or a password in `detail`.
 */
export async function logActivity(entry: {
  actor: { id: string | null; name: string | null } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const { error } = await createAdminClient()
      .from("activity_log")
      .insert({
        actor_id: entry.actor?.id ?? null,
        // the text columns are NOT NULL DEFAULT '' — an explicit null would fail
        actor_name: entry.actor?.name ?? "",
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? "",
        detail: entry.detail ?? {},
      });
    if (error) console.warn(`[activity] ${entry.action} not logged:`, error.message);
  } catch (e) {
    console.warn(`[activity] ${entry.action} not logged:`, e);
  }
}

/**
 * Supabase reports an UPDATE/DELETE that row-level security filtered out as a
 * *success* that touched zero rows — there is no error to catch. Every write in
 * the panel therefore asks for the affected ids back and treats an empty list
 * as this message instead of cheerfully saying "Saved."
 */
export const NOTHING_CHANGED =
  "Nothing was changed — it may have been deleted in another tab, or your account doesn't have permission to edit it.";

type DbErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/** True when the error means the table simply hasn't been created yet. */
export function isMissingTable(error: DbErrorLike) {
  if (!error) return false;
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist|could not find the table/i.test(error.message ?? "")
  );
}

/** Turn a Postgres / PostgREST error into a sentence a client can act on. */
export function describeDbError(error: DbErrorLike, opts: { unique?: string } = {}) {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";

  if (code === "23505") return opts.unique ?? "That value is already used by another entry.";
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "The database refused this for your account — ask the owner to check your access under Team.";
  }
  if (isMissingTable(error)) {
    return "That table doesn't exist yet — run supabase/schema.sql in the Supabase SQL editor.";
  }
  if (code === "42703" || code === "PGRST204") {
    return "The database schema is out of date — re-run supabase/schema.sql (it's safe to run twice).";
  }
  if (code === "23514") return "The database rejected one of the values.";
  if (code === "23502") return "A required field is missing.";
  if (code === "22P02") return "That record id isn't valid.";
  if (code === "PGRST301" || /jwt/i.test(msg)) return "Your session has expired — sign in again.";
  if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
    return "Couldn't reach the database. Check that the Supabase project is running — free projects pause after a week without traffic.";
  }
  return msg ? `Database error: ${msg}` : "Something went wrong talking to the database.";
}

export const dbFail = (error: DbErrorLike, opts: { unique?: string } = {}) =>
  fail(describeDbError(error, opts));

/**
 * Zod failure -> a banner line plus per-field messages. The banner names the
 * first problem so the message is useful even where a field isn't visible.
 */
export function zodFail(error: ZodError): Result {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0]?.message;
  const count = Object.keys(fieldErrors).length;
  return fail(
    count > 1
      ? `Please fix the ${count} highlighted fields.`
      : (first ?? "Please check the form."),
    fieldErrors
  );
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => uuidRe.test(s);

/** All `id` values in the form that look like uuids (bulk actions send several). */
export function ids(fd: FormData, key = "id"): string[] {
  return [...new Set(fd.getAll(key).map(String).filter(isUuid))];
}
