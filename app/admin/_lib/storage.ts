import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { isMissingTable } from "./server";

/**
 * Cleanup for images uploaded to the public "work" bucket (ImageField uploads
 * straight from the browser; the server only ever deletes).
 *
 * After a save that replaced/removed an image, or a delete, the dropped URLs
 * are candidates for removal. A candidate is deleted only when NOTHING still
 * points at it — and "anything" is wider than the row that was just edited:
 *
 *  - every content table that stores uploads: projects (img, img2, gallery),
 *    products (image, gallery), posts (cover_image — and the markdown body,
 *    since someone can paste an uploaded image's URL into a post);
 *  - every content_revisions snapshot. History keeps the full old row, and a
 *    restore writes it back verbatim — deleting a file a snapshot references
 *    would restore a post with a broken cover. (Consequence: a deleted item's
 *    images stay in Storage as long as its revisions do. That is the point.)
 *
 * Matching is a substring test over each row's JSON, so a new image column
 * (or an image inside a gallery/body) is covered without teaching this file
 * its shape. A false positive only ever KEEPS a file.
 *
 * Best-effort and never throws: a leftover file costs pennies, a failed save
 * costs the edit. If any source can't be read (other than a table that simply
 * doesn't exist yet), nothing is deleted — "couldn't check" is never "unused".
 *
 * Revisions are pruned IN THE DATABASE (20 per item), so an image referenced
 * only by a pruned revision is never handed to removeOrphanedUploads. The
 * staff "unused images" sweep (findUnusedUploads, on /admin/settings) is what
 * catches those: it lists the bucket and checks every object the same way.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "work";
const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const READ_TIMEOUT_MS = 5000;

/**
 * Where an upload can be referenced from. `columns` is a PostgREST select —
 * only the fields that can hold a URL, so a cleanup never drags whole rows
 * (or every post body twice) across the wire when it doesn't have to.
 */
const SOURCES = [
  { table: "projects", columns: "img, img2, gallery" },
  { table: "products", columns: "image, gallery" },
  { table: "posts", columns: "cover_image, body" },
  { table: "content_revisions", columns: "snapshot" },
] as const;

/**
 * The sweep deletes in bulk, so it reads a deliberately WIDER net: every other
 * content table in full too. None of them has an image column today, but a
 * pasted URL in a role description or a future column must keep its file.
 */
const SWEEP_SOURCES = [
  ...SOURCES,
  { table: "services", columns: "*" },
  { table: "team_members", columns: "*" },
  { table: "jobs", columns: "*" },
  { table: "site_settings", columns: "*" },
] as const;

/** Object path inside the "work" bucket for one of OUR public URLs, else null. */
export function storagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base || !url.startsWith(base + STORAGE_MARKER)) return null;
  const path = url.slice(base.length + STORAGE_MARKER.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return null;
  }
}

/** The public URL of an object in the "work" bucket. */
export function publicUploadUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}${STORAGE_MARKER}${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Every image URL a row holds in `gallery` ([{ src }]) — tolerant of bad jsonb. */
export function galleryUrls(gallery: unknown): (string | null)[] {
  return Array.isArray(gallery)
    ? gallery.map((g: { src?: unknown }) => (typeof g?.src === "string" ? g.src : null))
    : [];
}

/** Every http(s) URL anywhere inside a value (snapshots, markdown bodies). */
export function urlsIn(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return [...new Set(text.match(/https?:\/\/[^\s"'()<>\[\]\\]+/g) ?? [])];
}

type SourceRead = { rows: unknown[] } | { error: { code?: string; message?: string } };

/**
 * All rows of one source. PostgREST caps a response at the project's max-rows
 * (1000 by default on Supabase) WITHOUT an error, and content_revisions alone
 * passes that at ~50 items × 20 revisions — a silently truncated read would
 * make an in-use file look unused. So the first read asks for the exact count,
 * and a truncated one is re-read in stable id-ordered pages (page size = what
 * the server actually returned, i.e. its cap).
 */
async function readSource(supabase: Supabase, table: string, columns: string): Promise<SourceRead> {
  const first = await supabase
    .from(table)
    .select(columns, { count: "exact" })
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
    .retry(false);
  if (first.error) return { error: first.error };
  const rows = (first.data ?? []) as unknown[];
  const total = (first as { count?: number | null }).count;
  if (typeof total !== "number" || total <= rows.length || rows.length === 0) return { rows };

  const page = rows.length;
  const all: unknown[] = [];
  for (let from = 0; from < total; from += page) {
    const res = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + page - 1)
      .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
      .retry(false);
    if (res.error) return { error: res.error };
    const got = (res.data ?? []) as unknown[];
    all.push(...got);
    if (got.length < page) break;
  }
  return { rows: all };
}

/**
 * Everything that can reference an upload, as one searchable string — or null
 * when any source failed to read (a missing table references nothing).
 */
async function referenceText(
  supabase: Supabase,
  sources: readonly { table: string; columns: string }[]
): Promise<string | null> {
  const results = await Promise.all(sources.map((s) => readSource(supabase, s.table, s.columns)));
  const parts: string[] = [];
  for (const r of results) {
    if ("error" in r) {
      // a table that doesn't exist can't reference anything (an older
      // database without products/posts/revisions); any other failure means
      // we can't prove a file is unused, so keep everything
      if (isMissingTable(r.error)) continue;
      return null;
    }
    // JSON never contains a raw newline, so a match can't span two rows
    for (const row of r.rows) parts.push(JSON.stringify(row));
  }
  return parts.join("\n");
}

/**
 * Delete the uploads among `urls` that nothing references any more. Call it
 * AFTER the write that dropped them has succeeded (the revision trigger runs
 * in that write's transaction, so its snapshot is already visible here).
 */
export async function removeOrphanedUploads(
  supabase: Supabase,
  urls: (string | null | undefined)[]
): Promise<void> {
  const candidates = [...new Set(urls)]
    .map((url) => ({ url, path: storagePath(url) }))
    .filter((c): c is { url: string; path: string } => Boolean(c.url && c.path));
  if (!candidates.length) return;

  try {
    const text = await referenceText(supabase, SOURCES);
    if (text === null) return;
    const orphans = candidates.filter((c) => !text.includes(c.url)).map((c) => c.path);
    if (orphans.length) await supabase.storage.from(BUCKET).remove(orphans);
  } catch {
    // cleanup only
  }
}

// ---------------------------------------------------------------------------
// the "unused images" sweep (staff tool on /admin/settings)
// ---------------------------------------------------------------------------

export type StoredUpload = { path: string; size: number; uploadedAt: string };

export type UnusedScan =
  | {
      ok: true;
      unused: StoredUpload[];
      totalBytes: number;
      /** objects looked at */
      scanned: number;
      /** unreferenced but uploaded in the last 24 h — left alone */
      recent: number;
      /** the bucket listing stopped at its safety cap */
      truncated: boolean;
    }
  | { ok: false; message: string };

/** An editor may be halfway through adding an image: leave the last day's uploads alone. */
export const SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const LIST_PAGE = 1000;
const MAX_OBJECTS = 10_000;
const MAX_DEPTH = 3;
const PLACEHOLDER = ".emptyFolderPlaceholder";

type Listed = { path: string; size: number; createdAt: string; updatedAt: string };

/** Every object in the bucket (ImageField uploads at the root; folders walked a few levels deep). */
async function listObjects(
  supabase: Supabase
): Promise<{ objects: Listed[]; truncated: boolean } | { error: string }> {
  const objects: Listed[] = [];
  let truncated = false;

  const walk = async (prefix: string, depth: number): Promise<string | null> => {
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: LIST_PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) return error.message || "the bucket couldn't be listed";
      const page = data ?? [];
      for (const o of page) {
        const path = prefix ? `${prefix}/${o.name}` : o.name;
        // folders come back as entries with no id / metadata
        if (!o.id || !o.metadata) {
          if (depth < MAX_DEPTH) {
            const failed = await walk(path, depth + 1);
            if (failed) return failed;
          }
          continue;
        }
        if (o.name === PLACEHOLDER) continue;
        objects.push({
          path,
          size: Number((o.metadata as { size?: unknown }).size) || 0,
          createdAt: o.created_at ?? "",
          updatedAt: o.updated_at ?? "",
        });
        if (objects.length >= MAX_OBJECTS) {
          truncated = true;
          return null;
        }
      }
      if (page.length < LIST_PAGE) return null;
    }
  };

  const failed = await walk("", 0);
  return failed ? { error: failed } : { objects, truncated };
}

/** Referenced if its path appears anywhere — raw, or URL-encoded as a public URL would carry it. */
function isReferenced(path: string, text: string) {
  const forms = new Set([path, encodeURI(path), path.split("/").map(encodeURIComponent).join("/")]);
  for (const f of forms) if (text.includes(f)) return true;
  return false;
}

/**
 * Objects in the bucket that nothing references (same rule as
 * removeOrphanedUploads, over the wider SWEEP_SOURCES), excluding anything
 * uploaded or overwritten in the last 24 hours. Lists nothing if any source
 * can't be read.
 */
export async function findUnusedUploads(
  supabase: Supabase,
  { now = new Date(), minAgeMs = SWEEP_MIN_AGE_MS }: { now?: Date; minAgeMs?: number } = {}
): Promise<UnusedScan> {
  try {
    const [listing, text] = await Promise.all([
      listObjects(supabase),
      referenceText(supabase, SWEEP_SOURCES),
    ]);
    if ("error" in listing) return { ok: false, message: `Couldn’t list the storage bucket: ${listing.error}` };
    if (text === null) {
      return {
        ok: false,
        message:
          "Couldn’t read every place an image can be used, so nothing is listed as unused. Try again in a moment.",
      };
    }

    const unused: StoredUpload[] = [];
    let recent = 0;
    for (const o of listing.objects) {
      if (isReferenced(o.path, text)) continue;
      const touched = Math.max(Date.parse(o.createdAt), Date.parse(o.updatedAt));
      // an unreadable timestamp counts as "just uploaded" — keep it
      if (!Number.isFinite(touched) || now.getTime() - touched < minAgeMs) {
        recent++;
        continue;
      }
      unused.push({ path: o.path, size: o.size, uploadedAt: new Date(touched).toISOString() });
    }
    unused.sort((a, b) => b.size - a.size);
    return {
      ok: true,
      unused,
      totalBytes: unused.reduce((n, u) => n + u.size, 0),
      scanned: listing.objects.length,
      recent,
      truncated: listing.truncated,
    };
  } catch (e) {
    return { ok: false, message: `The scan failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Remove objects in batches. Best effort: returns what Storage confirmed it deleted. */
export async function deleteUploads(supabase: Supabase, paths: string[]): Promise<string[]> {
  const deleted: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) continue;
      for (const o of data ?? []) if (o?.name) deleted.push(o.name);
    } catch {
      // keep going — the rest may still delete
    }
  }
  return deleted;
}
