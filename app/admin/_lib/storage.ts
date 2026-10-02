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

/** Every image URL a row holds in `gallery` ([{ src }]) — tolerant of bad jsonb. */
export function galleryUrls(gallery: unknown): (string | null)[] {
  return Array.isArray(gallery)
    ? gallery.map((g: { src?: unknown }) => (typeof g?.src === "string" ? g.src : null))
    : [];
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
    const results = await Promise.all(
      SOURCES.map(({ table, columns }) =>
        supabase
          .from(table)
          .select(columns)
          .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
          .retry(false)
      )
    );

    const haystack: string[] = [];
    for (const { data, error } of results) {
      if (error) {
        // a table that doesn't exist can't reference anything (an older
        // database without products/posts/revisions); any other failure means
        // we can't prove the file is unused, so keep everything
        if (isMissingTable(error)) continue;
        return;
      }
      for (const row of (data ?? []) as unknown[]) haystack.push(JSON.stringify(row));
    }

    const inUse = (url: string) => haystack.some((h) => h.includes(url));
    const orphans = candidates.filter((c) => !inUse(c.url)).map((c) => c.path);
    if (orphans.length) await supabase.storage.from(BUCKET).remove(orphans);
  } catch {
    // cleanup only
  }
}
