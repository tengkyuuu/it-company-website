"use server";

import { createClient } from "@/lib/supabase/server";
import {
  describeDbError,
  fail,
  logActivity,
  ok,
  requireStaff,
  type Result,
} from "./_lib/server";
import {
  loadEntityHistory,
  loadRevisionPreview,
  revalidateEntity,
  serviceClient,
  supabaseHistoryStore,
  type HistoryResponse,
  type PreviewResponse,
} from "./_lib/history";
import { formatBytes, formatManila, isContentTable, isValidEntityId, relativeTime } from "./_lib/history-logic";
import { performRestore } from "./_lib/history-restore";
import {
  deleteUploads,
  findUnusedUploads,
  publicUploadUrl,
  removeOrphanedUploads,
  urlsIn,
} from "./_lib/storage";

/**
 * History, restore and the unused-image sweep. Same contract as the other
 * action modules: every export calls requireStaff() first (a Server Action is
 * a public POST endpoint — action-guards.test.ts fails the build otherwise),
 * and nothing here throws to the client; failures come back as sentences.
 */

const actorOf = (me: { id: string; full_name: string | null; email: string | null }) => ({
  id: me.id,
  name: me.full_name || me.email || null,
});

/** The history panel's list for one item (loaded when the panel is opened). */
export async function getEntityHistory(entityType: string, entityId: string): Promise<HistoryResponse> {
  await requireStaff();
  if (!isContentTable(entityType) || !isValidEntityId(entityType, entityId)) {
    return { ok: false, message: "That item isn't valid — reload the page." };
  }
  try {
    return await loadEntityHistory(entityType, entityId);
  } catch (e) {
    return { ok: false, message: describeDbError({ message: e instanceof Error ? e.message : String(e) }) };
  }
}

/** Every field of one stored version. */
export async function getRevisionPreview(revisionId: number): Promise<PreviewResponse> {
  await requireStaff();
  if (!Number.isSafeInteger(revisionId) || revisionId <= 0) {
    return { ok: false, message: "That version isn't valid — reload the page." };
  }
  try {
    return await loadRevisionPreview(revisionId);
  } catch (e) {
    return { ok: false, message: describeDbError({ message: e instanceof Error ? e.message : String(e) }) };
  }
}

/**
 * Write a stored version back (or bring a deleted item back with its original
 * id). The sequence — current columns only, slug check, explicit pre-restore
 * backup, write through the user's client, prune — lives in
 * _lib/history-restore.ts so the tests run the same code. The client reloads
 * the page afterwards: the edit forms are uncontrolled and carry an
 * updated_at concurrency token, and a reload hands them both fresh.
 */
export async function restoreRevision(revisionId: number): Promise<Result> {
  const me = await requireStaff();
  if (!Number.isSafeInteger(revisionId) || revisionId <= 0) {
    return fail("That version isn't valid — reload the page.");
  }

  const supabase = await createClient();
  const out = await performRestore(supabaseHistoryStore(supabase, serviceClient()), {
    revisionId,
    actorId: me.id,
    describe: (e) => describeDbError(e),
  });
  if (!out.ok) return fail(out.message);
  if (out.unchanged) return ok("That version is identical to the current one — nothing to restore.");

  // a backup pushed the oldest revision out: its images may have lost their
  // last reference (removeOrphanedUploads keeps anything still in use)
  if (out.prunedSnapshots.length) {
    await removeOrphanedUploads(supabase, out.prunedSnapshots.flatMap((s) => urlsIn(s)));
  }

  await logActivity({
    actor: actorOf(me),
    action: "content.restore",
    entityType: out.table,
    entityId: out.entityId,
    detail: {
      entity_type: out.table,
      entity_id: out.entityId,
      label: out.label,
      revision_id: out.revisionId,
      restored_from: out.restoredFrom,
      ...(out.mode === "reinserted" ? { deleted: true } : {}),
      ...(out.backupRevisionId !== null ? { backup_revision_id: out.backupRevisionId } : {}),
    },
  });

  revalidateEntity(out.table, out.publishedBefore !== out.publishedAfter);

  // `id` = something was written; the panel reloads only then
  return ok(
    out.mode === "reinserted"
      ? `“${out.label}” is back.`
      : `Restored the version from ${formatManila(out.restoredFrom)}. The previous one is saved in History.`,
    { id: out.entityId }
  );
}

// ---------------------------------------------------------------------------
// unused-image sweep
// ---------------------------------------------------------------------------

export type UnusedUploadView = { path: string; url: string; size: string; bytes: number; uploaded: string; ago: string };

export type SweepScanResponse =
  | {
      ok: true;
      items: UnusedUploadView[];
      totalBytes: number;
      totalSize: string;
      scanned: number;
      recent: number;
      truncated: boolean;
    }
  | { ok: false; message: string };

/** Storage + every reference source: the service role when configured (no RLS can hide a reference). */
async function sweepClient() {
  return serviceClient() ?? (await createClient());
}

/** List uploads nothing references (older than 24 h). Read-only. */
export async function scanUnusedUploads(): Promise<SweepScanResponse> {
  await requireStaff();
  const scan = await findUnusedUploads(await sweepClient());
  if (!scan.ok) return scan;
  const now = new Date();
  return {
    ok: true,
    items: scan.unused.map((u) => ({
      path: u.path,
      url: publicUploadUrl(u.path),
      bytes: u.size,
      size: formatBytes(u.size),
      uploaded: formatManila(u.uploadedAt, now),
      ago: relativeTime(u.uploadedAt, now),
    })),
    totalBytes: scan.totalBytes,
    totalSize: formatBytes(scan.totalBytes),
    scanned: scan.scanned,
    recent: scan.recent,
    truncated: scan.truncated,
  };
}

/**
 * Delete the listed uploads — but only those a FRESH scan still finds unused
 * (something may have started using one since the list was shown, or it may
 * have been uploaded in the meantime). A scan that can't read every source
 * deletes nothing.
 */
export async function cleanUpUnusedUploads(paths: string[]): Promise<Result> {
  const me = await requireStaff();
  const requested = new Set(
    (Array.isArray(paths) ? paths : []).filter((p): p is string => typeof p === "string" && p.length > 0 && p.length < 1024)
  );
  if (!requested.size) return fail("Nothing selected to clean up.");

  const db = await sweepClient();
  const scan = await findUnusedUploads(db);
  if (!scan.ok) return fail(`${scan.message} Nothing was deleted.`);

  const targets = scan.unused.filter((u) => requested.has(u.path));
  if (!targets.length) return ok("Nothing to clean up — those images are in use again or already gone.");

  const deleted = new Set(await deleteUploads(db, targets.map((t) => t.path)));
  const bytes = targets.filter((t) => deleted.has(t.path)).reduce((n, t) => n + t.size, 0);
  if (!deleted.size) return fail("Storage didn’t delete anything — check the bucket’s delete policy and try again.");

  await logActivity({
    actor: actorOf(me),
    action: "storage.cleanup",
    entityType: "storage",
    entityId: "work",
    detail: { count: deleted.size, bytes, label: "Unused images" },
  });

  const skipped = targets.length - deleted.size;
  return ok(
    `Deleted ${deleted.size} unused image${deleted.size === 1 ? "" : "s"} (${formatBytes(bytes)}).` +
      (skipped > 0 ? ` ${skipped} couldn’t be deleted — try again later.` : "")
  );
}
