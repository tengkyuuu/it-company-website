import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, createAuthUser, createStaff, createTestDb, one } from "./helpers/db";
import {
  META_KEY,
  REVISION_KEEP,
  idsToPrune,
  latestRevisionPerMissingEntity,
  revisionMeta,
} from "@/app/admin/_lib/history-logic";
import {
  RESTORE_MESSAGES,
  performRestore,
  slugTakenMessage,
  type HistoryStore,
  type Row,
  type StoreError,
  type StoreResult,
} from "@/app/admin/_lib/history-restore";
import type { ContentEntityType } from "@/lib/supabase/types";

/**
 * Restore, run against the REAL schema and triggers (PGlite). The production
 * code path is performRestore (app/admin/_lib/history-restore.ts); this file
 * gives it a PGlite implementation of the same storage port the Supabase one
 * implements: reads + content writes as the signed-in user (RLS and the
 * triggers see their uid), revision writes as the service role.
 *
 * What must never silently happen: a restore overwriting the only copy of the
 * version it replaces (the trigger's 5-minute coalescing would skip it), the
 * activity line naming the wrong person, pre-restore backups piling up past 20,
 * or a deleted item coming back under a new id.
 */

type Who = { id: string };

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (col: string) => {
  if (!IDENT.test(col)) throw new Error(`bad column ${col}`);
  return `"${col}"`;
};

async function attempt<T>(fn: () => Promise<T>): Promise<StoreResult<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { data: null, error: { code: err.code ?? null, message: err.message ?? String(e) } as StoreError };
  }
}

/** The storage port on PGlite: `who` is the signed-in staff member. */
function pgStore(db: PGlite, who: Who, { service = true } = {}): HistoryStore {
  const user = <T>(fn: () => Promise<T>) => attempt(() => asUser(db, { sub: who.id }, fn));
  const svc = <T>(fn: () => Promise<T>) => attempt(() => asService(db, fn));
  const rowOf = async (sql: string, params: unknown[]) =>
    ((await db.query<{ row: Row }>(sql, params)).rows[0]?.row ?? null) as Row | null;

  return {
    canWriteRevisions: service,

    getRevision: (id) =>
      user(async () => {
        const r = await db.query<{
          id: number;
          entity_type: string;
          entity_id: string;
          snapshot: Row;
          actor_id: string | null;
          created_at: string;
        }>(
          `select id::int as id, entity_type, entity_id, snapshot, actor_id,
                  to_jsonb(created_at) #>> '{}' as created_at
           from public.content_revisions where id = $1`,
          [id]
        );
        return r.rows[0] ?? null;
      }),

    getRow: (table, id) =>
      user(() => rowOf(`select to_jsonb(t) as row from public.${q(table)} t where t.id = $1`, [id])),

    sampleColumns: (table) =>
      user(async () => {
        const row = await rowOf(`select to_jsonb(t) as row from public.${q(table)} t limit 1`, []);
        return row ? Object.keys(row) : null;
      }),

    findBySlug: (table, slug) =>
      user(() => rowOf(`select to_jsonb(t) as row from public.${q(table)} t where t.slug = $1 limit 1`, [slug])),

    hasRecentRevisionBy: (table, entityId, actorId, sinceIso) =>
      user(async () => {
        const r = await db.query<{ hit: boolean }>(
          `select exists (
             select 1 from public.content_revisions
             where entity_type = $1 and entity_id = $2 and actor_id = $3 and created_at > $4::timestamptz
           ) as hit`,
          [table, entityId, actorId, sinceIso]
        );
        return Boolean(r.rows[0]?.hit);
      }),

    insertRevision: (rev) =>
      svc(async () => {
        const r = await db.query<{ id: number }>(
          `insert into public.content_revisions (entity_type, entity_id, snapshot, actor_id)
           values ($1, $2, $3::jsonb, $4) returning id::int as id`,
          [rev.entity_type, rev.entity_id, JSON.stringify(rev.snapshot), rev.actor_id]
        );
        return { id: r.rows[0].id };
      }),

    deleteRevision: async (id) => {
      await svc(() => db.query("delete from public.content_revisions where id = $1", [id]));
    },

    pruneRevisions: (table, entityId, keep) =>
      svc(async () => {
        const ids = (
          await db.query<{ id: number }>(
            "select id::int as id from public.content_revisions where entity_type = $1 and entity_id = $2",
            [table, entityId]
          )
        ).rows.map((r) => r.id);
        const drop = idsToPrune(ids, keep);
        if (!drop.length) return [];
        const r = await db.query<{ snapshot: Row }>(
          "delete from public.content_revisions where id = any($1::bigint[]) returning snapshot",
          [drop]
        );
        return r.rows.map((x) => x.snapshot);
      }),

    // PostgREST-style: values arrive as JSON and are cast by the table's own types
    updateRow: (table, id, values) =>
      user(async () => {
        const cols = Object.keys(values);
        const r = await db.query(
          `update public.${q(table)} as t
              set ${cols.map((c) => `${q(c)} = r.${q(c)}`).join(", ")}
             from jsonb_populate_record(null::public.${q(table)}, $1::jsonb) as r
            where t.id = $2
           returning t.id`,
          [JSON.stringify(values), id]
        );
        return r.rows.length;
      }),

    insertRow: (table, values) =>
      user(async () => {
        const cols = Object.keys(values).map(q).join(", ");
        const r = await db.query(
          `insert into public.${q(table)} (${cols})
           select ${cols} from jsonb_populate_record(null::public.${q(table)}, $1::jsonb)
           returning id`,
          [JSON.stringify(values)]
        );
        return r.rows.length;
      }),
  };
}

describe("restore (performRestore against the real triggers)", () => {
  let db: PGlite;
  let alice: Who;
  let bob: Who;

  beforeAll(async () => {
    db = await createTestDb();
    await createStaff(db, "owner", { fullName: "Olive Owner" });
    alice = await createStaff(db, "admin", { fullName: "Alice Admin" });
    bob = await createStaff(db, "admin", { fullName: "Bob Builder" });
  });

  afterAll(async () => {
    await db?.close();
  });

  /** A project created by postgres (no actor, no history), so each test starts clean. */
  async function newProject(slug: string, extra: Record<string, unknown> = {}) {
    const values = { slug, name: "Original", ...extra };
    const cols = Object.keys(values);
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.projects (${cols.map(q).join(", ")})
       select ${cols.map(q).join(", ")} from jsonb_populate_record(null::public.projects, $1::jsonb)
       returning id`,
      [JSON.stringify(values)]
    );
    await db.query("delete from public.activity_log where entity_id = $1", [id]);
    return id;
  }

  const as = (who: Who, sql: string, params: unknown[] = []) =>
    asUser(db, { sub: who.id }, () => db.query(sql, params));
  const rename = (who: Who, id: string, name: string) =>
    as(who, "update public.projects set name = $2 where id = $1", [id, name]);

  type Rev = { id: number; snapshot: Row; actor_id: string | null };
  const revisions = async (id: string, table = "projects") =>
    (
      await db.query<Rev>(
        "select id::int as id, snapshot, actor_id from public.content_revisions where entity_type = $1 and entity_id = $2 order by id",
        [table, id]
      )
    ).rows;
  const ageRevisions = (id: string, minutes = 6) =>
    db.query(
      `update public.content_revisions set created_at = created_at - make_interval(mins => $2) where entity_id = $1`,
      [id, minutes]
    );
  const projectRow = (id: string) =>
    one<{ name: string; slug: string; tags: string[]; published: boolean; created_at: string } | undefined>(
      db,
      "select name, slug, tags, published, created_at::text from public.projects where id = $1",
      [id]
    );
  const lastActivity = (id: string) =>
    one<{ action: string; actor_id: string | null; actor_name: string }>(
      db,
      "select action, actor_id, actor_name from public.activity_log where entity_id = $1 order by id desc limit 1",
      [id]
    );

  it("writes the snapshot back through the user's session — the trigger records THAT user", async () => {
    const id = await newProject("r-basic");
    await rename(alice, id, "Second");
    const [r1] = await revisions(id);
    expect(r1.snapshot.name).toBe("Original");

    const out = await performRestore(pgStore(db, bob), { revisionId: r1.id, actorId: bob.id });
    expect(out).toMatchObject({ ok: true, unchanged: false, mode: "updated", label: "Original" });

    expect((await projectRow(id))?.name).toBe("Original");
    const log = await lastActivity(id);
    expect(log).toMatchObject({ action: "update", actor_id: bob.id, actor_name: "Bob Builder" });

    // one explicit backup (Bob's, marked), and the trigger's own snapshot of the
    // same state coalesced into it — no duplicate
    const revs = await revisions(id);
    expect(revs).toHaveLength(2);
    expect(revs[1].actor_id).toBe(bob.id);
    expect(revs[1].snapshot.name).toBe("Second");
    expect(revisionMeta(revs[1].snapshot)).toEqual({ kind: "pre-restore", restoring_revision_id: r1.id });
  });

  it("saves the explicit backup even INSIDE the 5-minute window, where the trigger would skip it", async () => {
    const id = await newProject("r-window");
    await rename(alice, id, "A"); // trigger: snapshot of "Original" by Alice
    await rename(alice, id, "B"); // coalesced — "A"→"B" leaves no snapshot of "A"
    const before = await revisions(id);
    expect(before).toHaveLength(1);

    // Alice restores "Original" a minute later: the trigger alone would skip
    // (Alice already has a revision inside the window) and "B" would be lost
    const out = await performRestore(pgStore(db, alice), { revisionId: before[0].id, actorId: alice.id });
    expect(out.ok).toBe(true);

    const after = await revisions(id);
    const backup = after.find((r) => revisionMeta(r.snapshot));
    expect(backup?.snapshot.name).toBe("B");
    expect(backup?.actor_id).toBe(alice.id);

    // …and the backup is itself restorable: undo the restore
    const undo = await performRestore(pgStore(db, alice), { revisionId: backup!.id, actorId: alice.id });
    expect(undo.ok).toBe(true);
    expect((await projectRow(id))?.name).toBe("B");
  });

  it("without a service key: refuses inside the window instead of losing a version, works outside it", async () => {
    const id = await newProject("r-nokey");
    await rename(alice, id, "Edited");
    const [r1] = await revisions(id);

    const refused = await performRestore(pgStore(db, alice, { service: false }), {
      revisionId: r1.id,
      actorId: alice.id,
    });
    expect(refused).toEqual({ ok: false, message: RESTORE_MESSAGES.needsServiceKey });
    expect((await projectRow(id))?.name).toBe("Edited");

    await ageRevisions(id);
    const outside = await performRestore(pgStore(db, alice, { service: false }), {
      revisionId: r1.id,
      actorId: alice.id,
    });
    expect(outside.ok).toBe(true);
    expect((await projectRow(id))?.name).toBe("Original");
    // the trigger itself took the backup (unmarked), attributed to Alice
    const revs = await revisions(id);
    expect(revs.at(-1)).toMatchObject({ actor_id: alice.id });
    expect(revs.at(-1)?.snapshot.name).toBe("Edited");
  });

  it("prunes backups with everything else — never more than 20 per item", async () => {
    const id = await newProject("r-prune", { name: "v0" });
    for (let i = 1; i <= 22; i++) {
      await rename(alice, id, `v${i}`);
      await ageRevisions(id);
    }
    expect(await revisions(id)).toHaveLength(REVISION_KEEP);

    // restore back and forth between the two newest versions: every restore
    // adds a backup, and every backup must push the oldest revision out
    const revs = await revisions(id);
    const [a, b] = [revs[revs.length - 1], revs[revs.length - 2]];
    for (let i = 0; i < 6; i++) {
      const target = i % 2 === 0 ? a : b;
      const out = await performRestore(pgStore(db, bob), { revisionId: target.id, actorId: bob.id });
      expect(out).toMatchObject({ ok: true, unchanged: false });
      if (out.ok) expect(out.prunedSnapshots).toHaveLength(1);
      expect(await revisions(id)).toHaveLength(REVISION_KEEP);
    }
    const finalRevs = await revisions(id);
    expect(finalRevs).toHaveLength(REVISION_KEEP);
    expect(finalRevs.some((r) => revisionMeta(r.snapshot))).toBe(true);
  });

  it("does nothing (no backup, no write) when the version already matches", async () => {
    const id = await newProject("r-same");
    await rename(alice, id, "Changed");
    await rename(bob, id, "Original"); // Bob's revision snapshots "Changed"; live is "Original" again
    const revs = await revisions(id);
    const original = revs.find((r) => r.snapshot.name === "Original")!;
    const out = await performRestore(pgStore(db, bob), { revisionId: original.id, actorId: bob.id });
    expect(out).toMatchObject({ ok: true, unchanged: true });
    expect(await revisions(id)).toHaveLength(revs.length);
  });

  it("re-inserts a deleted row with its ORIGINAL id, exactly as it was", async () => {
    const id = await newProject("r-deleted", {
      name: "Deleted one",
      tags: ["web", "ios"],
      gallery: [{ src: "https://x.test/1.webp", caption: "Home", kind: "desktop" }],
      img: "https://x.test/main.webp",
      published: true,
    });
    await as(alice, "delete from public.projects where id = $1", [id]);
    expect(await projectRow(id)).toBeUndefined();

    // the list page's detection: newest revision of an id that no longer exists
    const heads = (
      await db.query<{ id: number; entity_id: string; created_at: string; actor_id: string | null }>(
        "select id::int as id, entity_id, created_at::text, actor_id from public.content_revisions where entity_type = 'projects'"
      )
    ).rows;
    const existing = new Set(
      (await db.query<{ id: string }>("select id from public.projects")).rows.map((r) => r.id)
    );
    const gone = latestRevisionPerMissingEntity(heads, existing).find((h) => h.entity_id === id)!;
    expect(gone.actor_id).toBe(alice.id);

    const out = await performRestore(pgStore(db, bob), { revisionId: gone.id, actorId: bob.id });
    expect(out).toMatchObject({ ok: true, mode: "reinserted", label: "Deleted one", publishedAfter: true });

    const row = await one<{ name: string; tags: string[]; gallery: unknown; published: boolean; img: string }>(
      db,
      "select name, tags, gallery, published, img from public.projects where id = $1",
      [id]
    );
    expect(row).toMatchObject({ name: "Deleted one", tags: ["web", "ios"], published: true, img: "https://x.test/main.webp" });
    expect(row.gallery).toEqual([{ src: "https://x.test/1.webp", caption: "Home", kind: "desktop" }]);
    expect(await lastActivity(id)).toMatchObject({ action: "create", actor_id: bob.id });

    // it exists again, so it's no longer "recently deleted"
    const now = new Set((await db.query<{ id: string }>("select id from public.projects")).rows.map((r) => r.id));
    expect(latestRevisionPerMissingEntity(heads, now).some((h) => h.entity_id === id)).toBe(false);
  });

  it("a slug that's since been taken → a clear message, and nothing written (no stray backup)", async () => {
    // deleted item whose slug was reused
    const gone = await newProject("taken-slug", { name: "Gone" });
    await as(alice, "delete from public.projects where id = $1", [gone]);
    await newProject("taken-slug", { name: "Usurper" });
    const [del] = (await revisions(gone)).slice(-1);
    const out = await performRestore(pgStore(db, alice), { revisionId: del.id, actorId: alice.id });
    expect(out).toEqual({ ok: false, message: slugTakenMessage("Usurper") });

    // existing item whose old slug was reused
    const c = await newProject("c-old", { name: "Cee" });
    await as(alice, "update public.projects set slug = 'c-new' where id = $1", [c]);
    await newProject("c-old", { name: "Dee" });
    const revs = await revisions(c);
    const out2 = await performRestore(pgStore(db, bob), { revisionId: revs[0].id, actorId: bob.id });
    expect(out2).toEqual({ ok: false, message: slugTakenMessage("Dee") });
    expect(await revisions(c)).toHaveLength(revs.length);
    expect((await projectRow(c))?.slug).toBe("c-new");
  });

  it("writes only current columns: unknown keys and id / created_at in a snapshot are ignored", async () => {
    const id = await newProject("r-filter", { name: "Live" });
    const createdBefore = (await projectRow(id))?.created_at;
    const { id: revId } = await asService(db, () =>
      one<{ id: number }>(
        db,
        `insert into public.content_revisions (entity_type, entity_id, snapshot, actor_id)
         values ('projects', $1, $2::jsonb, null) returning id::int as id`,
        [
          id,
          JSON.stringify({
            id: "99999999-9999-4999-8999-999999999999",
            created_at: "2001-01-01T00:00:00+00:00",
            name: "From an old schema",
            legacy_column: "no longer exists",
            [META_KEY]: { kind: "pre-restore", restoring_revision_id: 1 },
          }),
        ]
      )
    );
    const out = await performRestore(pgStore(db, alice), { revisionId: revId, actorId: alice.id });
    expect(out.ok).toBe(true);
    const row = await projectRow(id);
    expect(row?.name).toBe("From an old schema");
    expect(row?.created_at).toBe(createdBefore);
  });

  it("restores site_settings (id 1)", async () => {
    await as(alice, "update public.site_settings set tagline = 'Before' where id = 1");
    await ageRevisions("1");
    await as(alice, "update public.site_settings set tagline = 'After' where id = 1");
    const revs = await revisions("1", "site_settings");
    const target = revs.find((r) => r.snapshot.tagline === "Before")!;
    const out = await performRestore(pgStore(db, bob), { revisionId: target.id, actorId: bob.id });
    expect(out).toMatchObject({ ok: true, table: "site_settings" as ContentEntityType, entityId: "1" });
    expect((await one<{ tagline: string }>(db, "select tagline from public.site_settings where id = 1")).tagline).toBe(
      "Before"
    );
  });

  it("refuses an unknown revision without touching anything", async () => {
    const out = await performRestore(pgStore(db, alice), { revisionId: 987654, actorId: alice.id });
    expect(out).toEqual({ ok: false, message: RESTORE_MESSAGES.missing });
    expect(await performRestore(pgStore(db, alice), { revisionId: -1, actorId: alice.id })).toEqual({
      ok: false,
      message: RESTORE_MESSAGES.badRequest,
    });
  });

  it("a non-staff session can't restore: it can't even see the revision", async () => {
    const id = await newProject("r-outsider");
    await rename(alice, id, "Edited");
    const [r1] = await revisions(id);
    const outsider = await createAuthUser(db); // signed in, but no profile = not staff
    const out = await performRestore(pgStore(db, outsider), { revisionId: r1.id, actorId: outsider.id });
    expect(out).toEqual({ ok: false, message: RESTORE_MESSAGES.missing });
    expect((await projectRow(id))?.name).toBe("Edited");
  });

  it("revisions are invisible to anon and to signed-in non-staff; staff can read them", async () => {
    const id = await newProject("r-rls");
    await rename(alice, id, "Edited");

    await expect(asAnon(db, () => db.query("select * from public.content_revisions"))).rejects.toThrow(
      /permission denied/
    );

    const outsider = await createAuthUser(db);
    const seen = await asUser(db, { sub: outsider.id }, () =>
      db.query<{ n: number }>("select count(*)::int as n from public.content_revisions")
    );
    expect(seen.rows[0].n).toBe(0);

    const staff = await asUser(db, { sub: alice.id }, () =>
      db.query<{ n: number }>("select count(*)::int as n from public.content_revisions where entity_id = $1", [id])
    );
    expect(staff.rows[0].n).toBe(1);

    // and nobody but the service role can write one (the backup path)
    await expect(
      as(alice, "insert into public.content_revisions (entity_type, entity_id, snapshot) values ('projects', $1, '{}')", [id])
    ).rejects.toThrow(/permission denied|row-level security/);
  });
});
