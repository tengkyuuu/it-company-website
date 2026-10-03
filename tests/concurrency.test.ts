import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NEVER_AUTOSAVE, SAVE_UNITS } from "@/app/admin/_lib/autosave";
import { asUser, columns, createStaff, createTestDb, one } from "./helpers/db";

/**
 * Optimistic concurrency for the editors (explicit Save and autosave alike):
 * every write is `UPDATE … WHERE id = $id AND updated_at = $expected`, where
 * $expected is updated_at exactly as PostgREST returned it when the form
 * loaded. The failure this guards against is silent: if the token ever lost
 * precision (say, round-tripped through `new Date()`, which keeps
 * milliseconds and Postgres keeps microseconds), EVERY save would look like a
 * conflict — or, with a sloppier check, none would.
 *
 * PostgREST serialises rows with to_json(), so `to_json(updated_at) #>> '{}'`
 * is byte-for-byte the string the browser holds. PGlite's own driver would
 * hand back a JS Date — the very trap — so these tests never read it that way.
 */

type Who = { id: string };

describe("updated_at as a concurrency token", () => {
  let db: PGlite;
  let alice: Who;
  let bob: Who;

  beforeAll(async () => {
    db = await createTestDb();
    // Supabase's PostgREST talks to Postgres in UTC; PGlite inherits the host's zone
    await db.exec("set timezone = 'UTC'");
    await createStaff(db, "owner", { fullName: "Olive Owner" });
    alice = await createStaff(db, "admin", { fullName: "Alice Admin" });
    bob = await createStaff(db, "admin", { fullName: "Bob Builder" });
  });

  afterAll(async () => {
    await db?.close();
  });

  /** updated_at the way the browser has it (PostgREST's JSON rendering). */
  const token = async (table: string, id: string | number) =>
    (
      await one<{ v: string }>(
        db,
        `select to_json(updated_at) #>> '{}' as v from public.${table} where id = $1`,
        [id]
      )
    ).v;

  /** The guarded write the server code issues, as `who`. Returns rows touched. */
  const guarded = (who: Who, table: string, id: string | number, expected: string, set: string) =>
    asUser(db, { sub: who.id }, async () => {
      const res = await db.query<{ id: string }>(
        `update public.${table} set ${set} where id = $1 and updated_at = $2 returning id`,
        [id, expected]
      );
      return res.rows.length;
    });

  it("projects: the exact token matches once, then a stale one is a conflict", async () => {
    // a microsecond-precise timestamp (an INSERT doesn't run the touch trigger)
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.projects (slug, name, updated_at)
       values ('conc-a', 'Original', '2026-10-02T06:41:07.123456+00') returning id`
    );

    const loaded = await token("projects", id);
    expect(loaded).toBe("2026-10-02T06:41:07.123456+00:00");

    // Alice saves with the token her form was rendered with → 1 row
    expect(await guarded(alice, "projects", id, loaded, "name = 'Alice'")).toBe(1);
    const afterAlice = await token("projects", id);
    expect(afterAlice).not.toBe(loaded); // the touch trigger moved it

    // Bob's tab still holds the old token → 0 rows: a conflict, not an overwrite
    expect(await guarded(bob, "projects", id, loaded, "name = 'Bob'")).toBe(0);
    expect((await one<{ name: string }>(db, "select name from public.projects where id = $1", [id])).name).toBe(
      "Alice"
    );

    // "Keep mine": Bob re-sends expecting the version he was just shown → 1 row
    expect(await guarded(bob, "projects", id, afterAlice, "name = 'Bob'")).toBe(1);
  });

  it("the background embed-probe verdict never moves the token, nor leaves history", async () => {
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.projects (slug, name, live_url, updated_at)
       values ('conc-probe', 'Probed', 'https://example.com', '2026-10-02T06:41:07.555555+00') returning id`
    );
    const loaded = await token("projects", id);
    const counts = async () =>
      one<{ revs: number; acts: number }>(
        db,
        `select (select count(*)::int from public.content_revisions where entity_type = 'projects' and entity_id = $1) as revs,
                (select count(*)::int from public.activity_log where entity_type = 'projects' and entity_id = $1 and action = 'update') as acts`,
        [id]
      );
    const before = await counts();

    // the probe writes only its own columns (as the editor, like the real code)
    await asUser(db, { sub: alice.id }, () =>
      db.query(
        `update public.projects set embeddable = false, embed_reason = 'X-Frame-Options: DENY',
           embed_checked_at = now() where id = $1`,
        [id]
      )
    );
    // so a tab that loaded before the probe can still save — no false conflict
    expect(await token("projects", id)).toBe(loaded);
    expect(await counts()).toEqual(before);

    // a real edit still moves the token, and the probe columns ride along unharmed
    expect(await guarded(alice, "projects", id, loaded, "name = 'Edited'")).toBe(1);
    expect(await token("projects", id)).not.toBe(loaded);
    const row = await one<{ embeddable: boolean | null }>(db, "select embeddable from public.projects where id = $1", [id]);
    expect(row.embeddable).toBe(false);
  });

  it("microseconds survive the string round-trip — and a Date round-trip would break every save", async () => {
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.projects (slug, name, updated_at)
       values ('conc-b', 'Original', '2026-10-02T06:41:07.987654+00') returning id`
    );
    const loaded = await token("projects", id);
    expect(loaded).toMatch(/\.987654\+00:00$/);

    // what `new Date(token).toISOString()` would send: milliseconds only
    const viaDate = new Date(loaded).toISOString();
    expect(viaDate).toBe("2026-10-02T06:41:07.987Z");
    expect(await guarded(alice, "projects", id, viaDate, "name = 'lossy'")).toBe(0);

    // the same instant written with another offset still matches — the
    // comparison is timestamptz equality, not string equality
    expect(await guarded(alice, "projects", id, "2026-10-02T14:41:07.987654+08:00", "name = 'tz'")).toBe(1);
    const fresh = await token("projects", id);

    // and the untouched string matches
    expect(await guarded(alice, "projects", id, fresh, "name = 'exact'")).toBe(1);
  });

  it("the token the trigger writes (now()) round-trips as well", async () => {
    const { id } = await one<{ id: string }>(
      db,
      "insert into public.projects (slug, name) values ('conc-c', 'Original') returning id"
    );
    // a real save first, so updated_at is whatever touch_updated_at stamped
    expect(await guarded(alice, "projects", id, await token("projects", id), "name = 'one'")).toBe(1);
    const t = await token("projects", id);
    expect(await guarded(alice, "projects", id, t, "name = 'two'")).toBe(1);
    expect(await guarded(alice, "projects", id, t, "name = 'three'")).toBe(0);
  });

  it("site_settings (the single row, id = 1) gets the same treatment", async () => {
    // pin a microsecond value without the touch trigger rewriting it
    await db.exec("alter table public.site_settings disable trigger site_settings_touch_updated_at");
    await db.query(
      "update public.site_settings set updated_at = '2026-10-02T06:41:07.000123+00' where id = 1"
    );
    await db.exec("alter table public.site_settings enable trigger site_settings_touch_updated_at");

    const loaded = await token("site_settings", 1);
    expect(loaded).toBe("2026-10-02T06:41:07.000123+00:00");
    expect(await guarded(alice, "site_settings", 1, new Date(loaded).toISOString(), "tagline = 'x'")).toBe(0);
    expect(await guarded(alice, "site_settings", 1, loaded, "tagline = 'Alice'")).toBe(1);
    expect(await guarded(bob, "site_settings", 1, loaded, "tagline = 'Bob'")).toBe(0);
    expect(
      (await one<{ tagline: string }>(db, "select tagline from public.site_settings where id = 1")).tagline
    ).toBe("Alice");
  });

  it("a conflict can name who saved last (the latest activity_log line, readable by staff)", async () => {
    const { id } = await one<{ id: string }>(
      db,
      "insert into public.projects (slug, name) values ('conc-d', 'Original') returning id"
    );
    expect(await guarded(bob, "projects", id, await token("projects", id), "name = 'Bob was here'")).toBe(1);

    const last = await asUser(db, { sub: alice.id }, () =>
      one<{ actor_id: string; actor_name: string }>(
        db,
        `select actor_id, actor_name from public.activity_log
          where entity_type = 'projects' and entity_id = $1
          order by created_at desc limit 1`,
        [id]
      )
    );
    expect(last).toMatchObject({ actor_id: bob.id, actor_name: "Bob Builder" });
  });

  it("a deleted row is 'gone', not a conflict: the re-read finds nothing", async () => {
    const { id } = await one<{ id: string }>(
      db,
      "insert into public.projects (slug, name) values ('conc-e', 'Original') returning id"
    );
    const t = await token("projects", id);
    await db.query("delete from public.projects where id = $1", [id]);
    expect(await guarded(alice, "projects", id, t, "name = 'late'")).toBe(0);
    const res = await db.query("select 1 from public.projects where id = $1", [id]);
    expect(res.rows).toHaveLength(0);
  });

  it("every column autosave can write exists on its table (and slug/published/sort_order are never among them)", async () => {
    for (const [table, units] of Object.entries(SAVE_UNITS)) {
      const cols = await columns(db, table);
      for (const u of units) {
        for (const c of u.columns) {
          expect(cols.has(c), `${table}.${c}`).toBe(true);
          expect(NEVER_AUTOSAVE as readonly string[]).not.toContain(c);
        }
      }
      expect(cols.has("updated_at"), `${table}.updated_at`).toBe(true);
    }
  });
});
