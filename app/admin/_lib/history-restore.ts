import type { ContentEntityType } from "@/lib/supabase/types";
import {
  COALESCE_MS,
  REVISION_KEEP,
  differingKeys,
  entityLabel,
  insertableValues,
  isContentTable,
  isValidEntityId,
  knownColumns,
  restorableValues,
  rowIdFor,
  withRevisionMeta,
} from "./history-logic";

/**
 * The restore itself, written against a tiny storage port so the exact same
 * sequence runs in production (Supabase: ./history.ts) and in the PGlite tests
 * (tests/restore.test.ts) against the real triggers.
 *
 * Sequence for an item that still exists:
 *   1. load the revision and the live row;
 *   2. keep only snapshot keys that are CURRENT columns (never id /
 *      created_at / updated_at); nothing differs → stop, nothing written;
 *   3. a slug the snapshot would bring back that another item now uses → stop
 *      with "That slug is now used by ‹name›";
 *   4. BACKUP: insert the live row as an explicit revision with the service
 *      role, attributed to the restorer and marked pre-restore. Explicit
 *      because the trigger coalesces one snapshot per editor per 5 minutes — an
 *      edit a minute ago means the trigger would NOT snapshot the version the
 *      restore is about to overwrite. (Attributing it to the restorer also
 *      makes the trigger's own snapshot of the same state coalesce away, so
 *      there's exactly one copy.) Without a service key the trigger is the
 *      backup, which is only safe when it isn't going to coalesce — so the
 *      restore refuses in that case rather than lose a version;
 *   5. write through the USER's client (RLS applies; the activity trigger
 *      records the real actor), affected rows checked;
 *   6. prune to the newest 20 like the trigger does (backups count — the
 *      reference project never pruned its pre-restore backups).
 * A failed write deletes the backup again, so history never claims a restore
 * that didn't happen.
 *
 * For an item that's gone, the newest revision is the DELETE snapshot — the
 * whole row — so it's re-inserted with its original id.
 */

export type Row = Record<string, unknown>;
export type StoreError = { code?: string | null; message?: string | null };
export type StoreResult<T> = { data: T; error: null } | { data: null; error: StoreError };

export type RevisionRecord = {
  id: number;
  entity_type: string;
  entity_id: string;
  snapshot: Row;
  actor_id: string | null;
  created_at: string;
};

export interface HistoryStore {
  /** true when revisions can be written (the service role is configured) */
  readonly canWriteRevisions: boolean;
  getRevision(id: number): Promise<StoreResult<RevisionRecord | null>>;
  getRow(table: ContentEntityType, id: string | number): Promise<StoreResult<Row | null>>;
  /** the table's live columns, from any row; null when the table is empty */
  sampleColumns(table: ContentEntityType): Promise<StoreResult<string[] | null>>;
  findBySlug(table: ContentEntityType, slug: string): Promise<StoreResult<Row | null>>;
  hasRecentRevisionBy(
    table: ContentEntityType,
    entityId: string,
    actorId: string,
    sinceIso: string
  ): Promise<StoreResult<boolean>>;
  /** service role */
  insertRevision(rev: {
    entity_type: ContentEntityType;
    entity_id: string;
    snapshot: Row;
    actor_id: string | null;
  }): Promise<StoreResult<{ id: number }>>;
  /** service role, best effort */
  deleteRevision(id: number): Promise<void>;
  /** service role; returns the snapshots it deleted */
  pruneRevisions(table: ContentEntityType, entityId: string, keep: number): Promise<StoreResult<Row[]>>;
  /** the user's own client; resolves to the number of rows written */
  updateRow(table: ContentEntityType, id: string | number, values: Row): Promise<StoreResult<number>>;
  insertRow(table: ContentEntityType, values: Row): Promise<StoreResult<number>>;
}

export type RestoreOk = {
  ok: true;
  /** the version already matched — nothing was written, backed up or logged */
  unchanged: boolean;
  mode: "updated" | "reinserted";
  table: ContentEntityType;
  entityId: string;
  label: string;
  revisionId: number;
  /** created_at of the restored revision: the moment that version was current */
  restoredFrom: string;
  publishedBefore: boolean | null;
  publishedAfter: boolean | null;
  backupRevisionId: number | null;
  /** snapshots dropped by the prune — their uploads may now be unreferenced */
  prunedSnapshots: Row[];
};

export type RestoreFail = { ok: false; message: string; error?: StoreError };

export const RESTORE_MESSAGES = {
  badRequest: "That version isn't valid — reload the page.",
  missing:
    "That version no longer exists — only the newest 20 per item are kept. Reload to see the current list.",
  unknownTable: "That kind of item can't be restored.",
  empty: "This version has nothing that can be written back.",
  settingsMissing:
    "The settings row is missing — re-run supabase/schema.sql (it re-seeds the row), then try again.",
  backupFailed: "Couldn't save a backup of the current version first, so nothing was restored.",
  needsServiceKey:
    "You edited this in the last few minutes, so the automatic snapshot would be skipped and the current version could be lost. Add SUPABASE_SERVICE_ROLE_KEY to the server (restore then saves an explicit backup), or try again in 5 minutes.",
  nothingWritten:
    "Nothing was restored — the item may have been deleted in another tab, or your account doesn't have permission to edit it.",
  alreadyBack: "It looks like this item was already restored — reload the page.",
} as const;

export const slugTakenMessage = (label: string) =>
  `That slug is now used by “${label}” — rename one first.`;

const bool = (v: unknown) => (typeof v === "boolean" ? v : null);

async function slugConflict(
  store: HistoryStore,
  table: ContentEntityType,
  slug: unknown,
  selfId: string | null
): Promise<RestoreFail | StoreError | null> {
  if (typeof slug !== "string" || !slug) return null;
  const { data, error } = await store.findBySlug(table, slug);
  if (error) return error;
  if (data && String(data.id) !== selfId) {
    return { ok: false, message: slugTakenMessage(entityLabel(table, data) || slug) };
  }
  return null;
}

export async function performRestore(
  store: HistoryStore,
  input: {
    revisionId: number;
    actorId: string;
    now?: Date;
    /** Postgres error → sentence (describeDbError in production) */
    describe?: (error: StoreError) => string;
  }
): Promise<RestoreOk | RestoreFail> {
  const describe = input.describe ?? ((e: StoreError) => e.message || "Database error.");
  const dbFail = (error: StoreError): RestoreFail => ({ ok: false, message: describe(error), error });
  const now = input.now ?? new Date();

  if (!Number.isSafeInteger(input.revisionId) || input.revisionId <= 0) {
    return { ok: false, message: RESTORE_MESSAGES.badRequest };
  }

  const rev = await store.getRevision(input.revisionId);
  if (rev.error) return dbFail(rev.error);
  if (!rev.data) return { ok: false, message: RESTORE_MESSAGES.missing };
  const revision = rev.data;

  // allow-list: the entity type decides which table gets written
  if (!isContentTable(revision.entity_type)) return { ok: false, message: RESTORE_MESSAGES.unknownTable };
  const table = revision.entity_type;
  if (!isValidEntityId(table, revision.entity_id)) return { ok: false, message: RESTORE_MESSAGES.badRequest };
  const entityId = revision.entity_id;
  const rowId = rowIdFor(table, entityId);
  const snapshot = revision.snapshot && typeof revision.snapshot === "object" ? revision.snapshot : {};

  const live = await store.getRow(table, rowId);
  if (live.error) return dbFail(live.error);
  const current = live.data;

  const base = {
    ok: true as const,
    table,
    entityId,
    revisionId: revision.id,
    restoredFrom: revision.created_at,
    prunedSnapshots: [] as Row[],
  };

  // ------------------------------------------------------------ item exists
  if (current) {
    const values = restorableValues(snapshot, Object.keys(current));
    if (!Object.keys(values).length) return { ok: false, message: RESTORE_MESSAGES.empty };

    const label = entityLabel(table, { ...current, ...values });
    const publishedBefore = bool(current.published);
    const publishedAfter = "published" in values ? bool(values.published) : publishedBefore;

    if (!differingKeys(values, current).length) {
      return {
        ...base,
        unchanged: true,
        mode: "updated",
        label,
        publishedBefore,
        publishedAfter: publishedBefore,
        backupRevisionId: null,
      };
    }

    if ("slug" in values && values.slug !== current.slug) {
      const clash = await slugConflict(store, table, values.slug, String(current.id));
      if (clash && "ok" in clash) return clash;
      if (clash) return dbFail(clash);
    }

    let backupRevisionId: number | null = null;
    if (store.canWriteRevisions) {
      const backup = await store.insertRevision({
        entity_type: table,
        entity_id: entityId,
        snapshot: withRevisionMeta(current, { kind: "pre-restore", restoring_revision_id: revision.id }),
        actor_id: input.actorId,
      });
      if (backup.error) return { ok: false, message: RESTORE_MESSAGES.backupFailed, error: backup.error };
      backupRevisionId = backup.data.id;
    } else {
      // the trigger will be the backup — only if it isn't about to coalesce
      const since = new Date(now.getTime() - COALESCE_MS).toISOString();
      const recent = await store.hasRecentRevisionBy(table, entityId, input.actorId, since);
      if (recent.error) return dbFail(recent.error);
      if (recent.data) return { ok: false, message: RESTORE_MESSAGES.needsServiceKey };
    }

    const undoBackup = async () => {
      if (backupRevisionId !== null) await store.deleteRevision(backupRevisionId);
    };

    const written = await store.updateRow(table, rowId, values);
    if (written.error) {
      await undoBackup();
      if (written.error.code === "23505" && typeof values.slug === "string") {
        const clash = await slugConflict(store, table, values.slug, String(current.id));
        if (clash && "ok" in clash) return clash;
        return { ok: false, message: slugTakenMessage(values.slug) };
      }
      return dbFail(written.error);
    }
    if (!written.data) {
      await undoBackup();
      return { ok: false, message: RESTORE_MESSAGES.nothingWritten };
    }

    let prunedSnapshots: Row[] = [];
    if (backupRevisionId !== null) {
      const pruned = await store.pruneRevisions(table, entityId, REVISION_KEEP);
      // a failed prune leaves one extra revision until the next save prunes it
      prunedSnapshots = pruned.data ?? [];
    }

    return {
      ...base,
      unchanged: false,
      mode: "updated",
      label,
      publishedBefore,
      publishedAfter,
      backupRevisionId,
      prunedSnapshots,
    };
  }

  // ------------------------------------------------------- item was deleted
  if (table === "site_settings") return { ok: false, message: RESTORE_MESSAGES.settingsMissing };

  const sample = await store.sampleColumns(table);
  if (sample.error) return dbFail(sample.error);
  // an empty table can't show its columns; fall back to the ones this code knows
  const columns = sample.data ?? knownColumns(table);
  const values = insertableValues(snapshot, columns);
  values.id = entityId;
  if (Object.keys(values).length <= 1) return { ok: false, message: RESTORE_MESSAGES.empty };

  const clash = await slugConflict(store, table, values.slug, null);
  if (clash && "ok" in clash) return clash;
  if (clash) return dbFail(clash);

  const inserted = await store.insertRow(table, values);
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const again = await slugConflict(store, table, values.slug, entityId);
      if (again && "ok" in again) return again;
      return { ok: false, message: RESTORE_MESSAGES.alreadyBack };
    }
    return dbFail(inserted.error);
  }
  if (!inserted.data) return { ok: false, message: RESTORE_MESSAGES.nothingWritten };

  return {
    ...base,
    unchanged: false,
    mode: "reinserted",
    label: entityLabel(table, values),
    publishedBefore: null,
    publishedAfter: bool(values.published),
    backupRevisionId: null,
  };
}
