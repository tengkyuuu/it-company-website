import "server-only";

import { revalidatePath } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import type { ContentEntityType } from "@/lib/supabase/types";
import type { ConflictInfo } from "./autosave";
import { NOTHING_CHANGED, dbFail, fail, type Result } from "./server";
import { galleryUrls } from "./storage";

/**
 * Writes shared by the explicit Save (server actions) and autosave
 * (app/api/admin/autosave/route.ts): the version-checked UPDATE, the paths each
 * entity revalidates, and the Storage URLs a row references. One copy, so a
 * keystroke-saved edit refreshes exactly what a Save-button edit does.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message?: string };

// ---------------------------------------------------------------------------
// optimistic concurrency
// ---------------------------------------------------------------------------

export type WriteOutcome =
  | { kind: "ok"; updatedAt: string }
  | { kind: "conflict"; conflict: ConflictInfo }
  | { kind: "gone" }
  /** the row is there, at the version we expected, and the write still touched nothing: RLS */
  | { kind: "denied" }
  | { kind: "error"; error: DbError };

/**
 * UPDATE … WHERE id = $id AND updated_at = $expected.
 *
 * `expected` is the updated_at string exactly as PostgREST returned it when the
 * form was rendered (or as the last save returned it) — never round-tripped
 * through `new Date()`, which truncates Postgres's microseconds to
 * milliseconds and would make every comparison miss. PostgREST casts the
 * string back to timestamptz, so the match is exact.
 *
 * Zero rows back is ambiguous (deleted? someone else saved? RLS?), so it's
 * re-read to say which.
 */
export async function guardedUpdate(
  supabase: Supabase,
  table: ContentEntityType,
  id: string | number,
  expected: string,
  patch: Record<string, unknown>,
  { actorId }: { actorId?: string | null } = {}
): Promise<WriteOutcome> {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expected)
    .select("id, updated_at");
  if (error) return { kind: "error", error };
  if (data?.length) return { kind: "ok", updatedAt: String(data[0].updated_at) };

  const { data: now, error: readError } = await supabase
    .from(table)
    .select("updated_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { kind: "error", error: readError };
  if (!now) return { kind: "gone" };

  // still at our version? then nothing raced us — the database refused the write
  const { data: same, error: sameError } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("updated_at", expected)
    .maybeSingle();
  if (sameError) return { kind: "error", error: sameError };
  if (same) return { kind: "denied" };

  return {
    kind: "conflict",
    conflict: await describeConflict(supabase, table, id, String(now.updated_at), actorId ?? null),
  };
}

/**
 * Who saved the newer version: the latest activity_log line for the row (the
 * content trigger writes it in the same transaction as the change). Best
 * effort — updates are coalesced per editor per 5 minutes, so in a busy
 * two-person session the name can be the other editor's; `at` comes from the
 * row itself, which is always exact.
 */
async function describeConflict(
  supabase: Supabase,
  table: ContentEntityType,
  id: string | number,
  updatedAt: string,
  actorId: string | null
): Promise<ConflictInfo> {
  let by: string | null = null;
  let self = false;
  try {
    const { data } = await supabase
      .from("activity_log")
      .select("actor_id, actor_name")
      .eq("entity_type", table)
      .eq("entity_id", String(id))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      by = (data.actor_name as string) || null;
      self = Boolean(actorId && data.actor_id === actorId);
    }
  } catch {
    // the name is a nicety — a conflict is still a conflict
  }
  return { updatedAt, by, at: updatedAt, self };
}

/** A form without its updated_at (loaded before this deploy, or tampered with). */
export const STALE_FORM =
  "This form is out of date — copy anything you need, then reload the page before saving.";

export const CONFLICT_MESSAGE =
  "Not saved — a newer version was saved while you were editing. Reload it, or keep yours.";

/**
 * A non-ok outcome as the explicit Save reports it. `onError` lets a caller
 * map its own errors first (e.g. 23505 → "slug taken" on the slug field).
 */
export function outcomeFail(
  outcome: Exclude<WriteOutcome, { kind: "ok" }>,
  goneMessage: string,
  onError: (error: DbError) => Result = (e) => dbFail(e)
): Result {
  switch (outcome.kind) {
    case "conflict":
      return { ...fail(CONFLICT_MESSAGE), conflict: outcome.conflict };
    case "gone":
      return fail(goneMessage);
    case "denied":
      return fail(NOTHING_CHANGED);
    case "error":
      return onError(outcome.error);
  }
}

// ---------------------------------------------------------------------------
// revalidation — route PATTERNS, so both locales and every slug refresh
// ---------------------------------------------------------------------------

/**
 * Everything that renders projects: the landing gallery, the index, every
 * detail page (each one's prev/next links depend on order and visibility, and
 * a rename has to refresh the OLD url too — the dynamic pattern covers both),
 * the sitemap, and the panel itself.
 */
export function revalidateProjects() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]", "page"); // landing gallery, both locales
  revalidatePath("/[lang]/projects", "page");
  revalidatePath("/[lang]/projects/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

/**
 * Services render on the landing page, on /services, AND in the footer of
 * every page. The footer lives in the layout, so a save must invalidate the
 * layout too — without that an edit looks saved but the footer keeps the old
 * list until the next deploy.
 */
export function revalidateServices() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]/services", "page");
  revalidatePath("/[lang]", "page");
  revalidatePath("/[lang]", "layout");
}

export function revalidateRoster() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]/about", "page");
}

/** Footer on every public page, both locales. */
export function revalidateSettings() {
  revalidatePath("/[lang]", "layout");
}

export type Section = "products" | "careers" | "blog";

/**
 * `listingChanged` = the nav/footer link may have appeared or disappeared
 * (getPublishedSections in lib/cms.ts). That link lives in the [lang] layout,
 * so the whole layout is refreshed — only then, since it re-renders every page.
 */
export function revalidateSection(section: Section, listingChanged: boolean) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/[lang]/${section}`, "page");
  revalidatePath(`/[lang]/${section}/[slug]`, "page");
  revalidatePath("/sitemap.xml");
  if (listingChanged) revalidatePath("/[lang]", "layout");
}

// ---------------------------------------------------------------------------
// Storage URLs a row references (for removeOrphanedUploads after a write)
// ---------------------------------------------------------------------------

export const projectImages = (r: { img?: string | null; img2?: string | null; gallery?: unknown }) => [
  r.img,
  r.img2,
  ...galleryUrls(r.gallery),
];

export const productImages = (r: { image?: string | null; gallery?: unknown }) => [
  r.image,
  ...galleryUrls(r.gallery),
];

export const postImages = (r: { cover_image?: string | null }) => [r.cover_image];
