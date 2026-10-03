import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentEntityType } from "@/lib/supabase/types";
import { describeDbError, isMissingTable } from "./server";
import {
  revalidateProjects,
  revalidateRoster,
  revalidateSection,
  revalidateServices,
  revalidateSettings,
} from "./content";
import {
  ACTIVITY_SECTIONS,
  CONTENT_ACTIONS,
  NOISY_ACTION_PREFIXES,
  actionGroup,
  activityHref,
  actorDisplay,
  buildHistoryEntries,
  buildPreview,
  describeActivity,
  entityLabel,
  formatManila,
  idsToPrune,
  isContentTable,
  isValidEntityId,
  latestRevisionPerMissingEntity,
  relativeTime,
  revisionMeta,
  rowIdFor,
  type ActionGroup,
  type ActivityLite,
  type HistoryEntry,
  type PreviewField,
  type RevisionLite,
  type SentencePart,
} from "./history-logic";
import type { HistoryStore, Row } from "./history-restore";

/**
 * Server side of the history panel, "recently deleted", the activity feed and
 * restore: the Supabase implementation of the restore port, the loaders, and
 * per-entity revalidation. Reads go through the USER's cookie client — both
 * content_revisions and activity_log are staff-read (RLS is_staff()), so a
 * non-staff session simply sees nothing. Only revision writes (the pre-restore
 * backup + its prune) use the service role: nobody else may write history.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The service-role client when configured. Typed as the cookie client's type
 * (both are supabase-js clients; the generics just differ) so one store/sweep
 * implementation serves both.
 */
export function serviceClient(): Supabase | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient() as unknown as Supabase;
}

// ---------------------------------------------------------------------------
// the restore port, on Supabase
// ---------------------------------------------------------------------------

export function supabaseHistoryStore(db: Supabase, admin: Supabase | null): HistoryStore {
  return {
    canWriteRevisions: admin !== null,

    async getRevision(id) {
      const { data, error } = await db
        .from("content_revisions")
        .select("id, entity_type, entity_id, snapshot, actor_id, created_at")
        .eq("id", id)
        .maybeSingle();
      return error ? { data: null, error } : { data: data ?? null, error: null };
    },

    async getRow(table, id) {
      const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
      return error ? { data: null, error } : { data: (data as Row | null) ?? null, error: null };
    },

    async sampleColumns(table) {
      const { data, error } = await db.from(table).select("*").limit(1);
      if (error) return { data: null, error };
      const row = (data?.[0] ?? null) as Row | null;
      return { data: row ? Object.keys(row) : null, error: null };
    },

    async findBySlug(table, slug) {
      const { data, error } = await db.from(table).select("*").eq("slug", slug).limit(1);
      if (error) return { data: null, error };
      return { data: ((data?.[0] ?? null) as Row | null) ?? null, error: null };
    },

    async hasRecentRevisionBy(table, entityId, actorId, sinceIso) {
      const { data, error } = await db
        .from("content_revisions")
        .select("id")
        .eq("entity_type", table)
        .eq("entity_id", entityId)
        .eq("actor_id", actorId)
        .gt("created_at", sinceIso)
        .limit(1);
      return error ? { data: null, error } : { data: (data?.length ?? 0) > 0, error: null };
    },

    async insertRevision(rev) {
      if (!admin) return { data: null, error: { message: "SUPABASE_SERVICE_ROLE_KEY is not set" } };
      const { data, error } = await admin.from("content_revisions").insert(rev).select("id").single();
      return error ? { data: null, error } : { data: { id: Number(data.id) }, error: null };
    },

    async deleteRevision(id) {
      if (!admin) return;
      try {
        await admin.from("content_revisions").delete().eq("id", id);
      } catch {
        // best effort — an extra (accurate) snapshot is harmless
      }
    },

    async pruneRevisions(table, entityId, keep) {
      if (!admin) return { data: [], error: null };
      const { data, error } = await admin
        .from("content_revisions")
        .select("id")
        .eq("entity_type", table)
        .eq("entity_id", entityId);
      if (error) return { data: null, error };
      const drop = idsToPrune(
        (data ?? []).map((r) => Number(r.id)),
        keep
      );
      if (!drop.length) return { data: [], error: null };
      const del = await admin.from("content_revisions").delete().in("id", drop).select("snapshot");
      if (del.error) return { data: null, error: del.error };
      return { data: (del.data ?? []).map((r) => r.snapshot as Row), error: null };
    },

    async updateRow(table, id, values) {
      const { data, error } = await db.from(table).update(values).eq("id", id).select("id");
      return error ? { data: null, error } : { data: data?.length ?? 0, error: null };
    },

    async insertRow(table, values) {
      const { data, error } = await db.from(table).insert(values).select("id");
      return error ? { data: null, error } : { data: data?.length ?? 0, error: null };
    },
  };
}

/**
 * Refresh exactly what that entity's own save refreshes — the shared helpers
 * in ./content.ts are the single source (Save and autosave use them too) —
 * plus the panel layout, which the settings save doesn't need but a restore
 * does (the History list and overview change).
 */
export function revalidateEntity(table: ContentEntityType, listingChanged: boolean) {
  revalidatePath("/admin", "layout");
  switch (table) {
    case "projects":
      return revalidateProjects();
    case "services":
      return revalidateServices();
    case "team_members":
      return revalidateRoster();
    case "site_settings":
      return revalidateSettings();
    case "products":
      return revalidateSection("products", listingChanged);
    case "jobs":
      return revalidateSection("careers", listingChanged);
    case "posts":
      return revalidateSection("blog", listingChanged);
  }
}

// ---------------------------------------------------------------------------
// names
// ---------------------------------------------------------------------------

async function actorNames(db: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unique);
  for (const p of data ?? []) {
    const name = (p.full_name as string | null)?.trim() || (p.email as string | null) || "";
    if (name) names.set(p.id as string, name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// the history panel
// ---------------------------------------------------------------------------

export type HistoryResponse =
  | { ok: true; entries: HistoryEntry[]; exists: boolean }
  | { ok: false; message: string };

const NOT_SET_UP =
  "History isn’t set up on this database yet — re-run supabase/schema.sql (it’s safe to run twice).";

export async function loadEntityHistory(table: ContentEntityType, entityId: string): Promise<HistoryResponse> {
  const db = await createClient();
  const [revs, live, deletes] = await Promise.all([
    db
      .from("content_revisions")
      .select("id, snapshot, actor_id, created_at")
      .eq("entity_type", table)
      .eq("entity_id", entityId)
      .order("id", { ascending: false })
      .limit(30),
    db.from(table).select("*").eq("id", rowIdFor(table, entityId)).maybeSingle(),
    db
      .from("activity_log")
      .select("created_at")
      .eq("entity_type", table)
      .eq("entity_id", entityId)
      .eq("action", "delete")
      .order("id", { ascending: false })
      .limit(30),
  ]);

  if (revs.error) return { ok: false, message: isMissingTable(revs.error) ? NOT_SET_UP : describeDbError(revs.error) };
  if (live.error) return { ok: false, message: describeDbError(live.error) };

  const rows = (revs.data ?? []) as RevisionLite[];
  const names = await actorNames(db, rows.map((r) => r.actor_id));
  return {
    ok: true,
    exists: Boolean(live.data),
    entries: buildHistoryEntries(table, rows, (live.data as Row | null) ?? null, {
      names,
      // a missing activity_log only loses the "deleted" badge
      deleteTimes: deletes.error ? [] : (deletes.data ?? []).map((d) => d.created_at as string),
    }),
  };
}

export type PreviewResponse =
  | {
      ok: true;
      id: number;
      label: string;
      when: string;
      actor: string;
      backup: boolean;
      fields: PreviewField[];
    }
  | { ok: false; message: string };

export async function loadRevisionPreview(revisionId: number): Promise<PreviewResponse> {
  const db = await createClient();
  const { data, error } = await db
    .from("content_revisions")
    .select("id, entity_type, entity_id, snapshot, actor_id, created_at")
    .eq("id", revisionId)
    .maybeSingle();
  if (error) return { ok: false, message: describeDbError(error) };
  if (!data || !isContentTable(data.entity_type)) {
    return { ok: false, message: "That version no longer exists — only the newest 20 per item are kept." };
  }
  const snapshot = (data.snapshot ?? {}) as Row;
  const names = await actorNames(db, [data.actor_id as string | null]);
  return {
    ok: true,
    id: Number(data.id),
    label: entityLabel(data.entity_type, snapshot),
    when: formatManila(data.created_at as string),
    actor: actorDisplay(data.actor_id as string | null, names),
    backup: Boolean(revisionMeta(snapshot)),
    fields: buildPreview(data.entity_type, snapshot),
  };
}

// ---------------------------------------------------------------------------
// recently deleted
// ---------------------------------------------------------------------------

export type DeletedItem = {
  revisionId: number;
  entityId: string;
  label: string;
  slug: string | null;
  /** was it published when deleted? (it comes back the same way) */
  published: boolean | null;
  actor: string;
  when: string;
  ago: string;
};

const DELETED_SHOWN = 25;

/**
 * Items of one table that no longer exist, newest deletion first — read from
 * content_revisions alone (light columns + label fields via JSON paths, never
 * whole snapshots). Empty on any failure: this section is a convenience, it
 * must never break the list page it sits on.
 */
export async function loadRecentlyDeleted(table: ContentEntityType): Promise<DeletedItem[]> {
  if (table === "site_settings") return [];
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("content_revisions")
      .select("id, entity_id, actor_id, created_at, name:snapshot->>name, title:snapshot->>title, slug:snapshot->>slug, published:snapshot->published")
      .eq("entity_type", table)
      .order("id", { ascending: false })
      .limit(1000);
    if (error || !data?.length) return [];

    type Head = {
      id: number;
      entity_id: string;
      actor_id: string | null;
      created_at: string;
      name: string | null;
      title: string | null;
      slug: string | null;
      published: unknown;
    };
    const heads = (data as unknown as Head[]).map((h) => ({ ...h, id: Number(h.id) }));
    const candidates = [...new Set(heads.map((h) => h.entity_id))].filter((id) => isValidEntityId(table, id));
    if (!candidates.length) return [];

    const existing = new Set<string>();
    for (let i = 0; i < candidates.length; i += 100) {
      const chunk = candidates.slice(i, i + 100);
      const res = await db.from(table).select("id").in("id", chunk);
      // can't tell what exists → show nothing rather than offer to "restore" live items
      if (res.error) return [];
      for (const r of res.data ?? []) existing.add(String(r.id));
    }

    const gone = latestRevisionPerMissingEntity(heads, existing).slice(0, DELETED_SHOWN);
    const names = await actorNames(db, gone.map((g) => g.actor_id));
    const now = new Date();
    return gone.map((g) => ({
      revisionId: g.id,
      entityId: g.entity_id,
      label: g.name?.trim() || g.title?.trim() || g.slug || "Untitled",
      slug: g.slug,
      published: typeof g.published === "boolean" ? g.published : null,
      actor: actorDisplay(g.actor_id, names),
      when: formatManila(g.created_at, now),
      ago: relativeTime(g.created_at, now),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// activity feed
// ---------------------------------------------------------------------------

export type ActivityItem = {
  id: number;
  actor: string | null;
  parts: SentencePart[];
  href: string | null;
  group: ActionGroup;
  at: string;
  when: string;
  ago: string;
};

export type ActivityFilters = {
  section?: string;
  /** a profile id, or "system" for rows with no actor */
  actor?: string;
  group?: string;
  /** cursor: only rows with id < before */
  before?: number;
  limit?: number;
};

export type ActivityPage =
  | { ok: true; items: ActivityItem[]; nextBefore: number | null }
  | { ok: false; message: string; notSetUp: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadActivity(filters: ActivityFilters = {}): Promise<ActivityPage> {
  const db = await createClient();
  const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);

  let q = db
    .from("activity_log")
    .select("id, actor_id, actor_name, action, entity_type, entity_id, detail, created_at")
    .order("id", { ascending: false })
    .limit(limit + 1);

  // keep per-message noise out even if something starts logging it
  for (const p of NOISY_ACTION_PREFIXES) q = q.not("action", "like", `${p}%`);

  const section = ACTIVITY_SECTIONS.find((s) => s.value === filters.section);
  if (section) q = q.in("entity_type", section.entityTypes);

  if (filters.actor === "system") q = q.is("actor_id", null);
  else if (filters.actor && UUID.test(filters.actor)) q = q.eq("actor_id", filters.actor);

  if (filters.group === "content") {
    q = q.or(`action.in.(${CONTENT_ACTIONS.join(",")}),action.like.content.*,action.like.storage.*`);
  } else if (filters.group === "team") {
    q = q.like("action", "team.%");
  } else if (filters.group === "auth") {
    q = q.like("action", "auth.%");
  }

  if (filters.before && Number.isSafeInteger(filters.before)) q = q.lt("id", filters.before);

  const { data, error } = await q;
  if (error) {
    return { ok: false, message: isMissingTable(error) ? NOT_SET_UP : describeDbError(error), notSetUp: isMissingTable(error) };
  }

  const rows = ((data ?? []) as ActivityLite[]).map((r) => ({ ...r, id: Number(r.id) }));
  const page = rows.slice(0, limit);
  const nextBefore = rows.length > limit ? page[page.length - 1].id : null;

  // which content items still exist (for links) — one query per table present
  const byTable = new Map<ContentEntityType, Set<string>>();
  for (const r of page) {
    if (isContentTable(r.entity_type) && r.entity_type !== "site_settings" && isValidEntityId(r.entity_type, r.entity_id)) {
      const set = byTable.get(r.entity_type) ?? new Set<string>();
      set.add(r.entity_id);
      byTable.set(r.entity_type, set);
    }
  }
  const alive = new Set<string>();
  await Promise.all(
    [...byTable].map(async ([table, ids]) => {
      const res = await db.from(table).select("id").in("id", [...ids]);
      for (const r of res.data ?? []) alive.add(`${table}:${r.id}`);
    })
  );

  // names for rows written before the actor had a name on file
  const names = await actorNames(
    db,
    page.filter((r) => !r.actor_name && r.actor_id).map((r) => r.actor_id)
  );

  const now = new Date();
  return {
    ok: true,
    nextBefore,
    items: page.map((r) => {
      const sentence = describeActivity(r, {
        actorName: r.actor_id ? names.get(r.actor_id) : null,
        formatTime: (iso) => formatManila(iso, now),
      });
      return {
        id: r.id,
        actor: sentence.actor,
        parts: sentence.parts,
        href: activityHref(r, (t, id) => alive.has(`${t}:${id}`)),
        group: actionGroup(r.action),
        at: r.created_at,
        when: formatManila(r.created_at, now),
        ago: relativeTime(r.created_at, now),
      };
    }),
  };
}

/** Everyone on the panel, for the feed's person filter. */
export async function loadPeople(): Promise<{ id: string; name: string }[]> {
  const db = await createClient();
  const { data } = await db.from("profiles").select("id, full_name, email").order("created_at");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string | null)?.trim() || (p.email as string | null) || "Unnamed",
  }));
}

