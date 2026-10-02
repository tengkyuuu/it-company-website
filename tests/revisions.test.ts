import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createStaff, createTestDb, one } from "./helpers/db";

/**
 * The CMS's undo (content_revisions) and audit feed (activity_log) are both
 * written by triggers, so they can't be skipped by a server action that
 * forgets — but a trigger that coalesces wrong is silent: either "undo" has
 * nothing from before the burst of saves, or the feed is fifty lines of noise.
 * Time is moved by rewriting created_at rather than sleeping through windows.
 */

const CONTENT_TABLES = [
  "projects",
  "services",
  "team_members",
  "site_settings",
  "products",
  "jobs",
  "posts",
] as const;

type Revision = { snapshot: { name?: string }; actor_id: string | null };
type Activity = { action: string; actor_id: string | null; actor_name: string; detail: { label?: string } };

describe("content triggers", () => {
  let db: PGlite;
  let alice: { id: string };
  let bob: { id: string };

  beforeAll(async () => {
    db = await createTestDb();
    await createStaff(db, "owner", { fullName: "Olive Owner" });
    alice = await createStaff(db, "admin", { fullName: "Alice Admin" });
    bob = await createStaff(db, "admin", { fullName: "Bob Builder" });
  });

  afterAll(async () => {
    await db?.close();
  });

  /** A project created by postgres (no actor), so tests start from a clean slate. */
  async function newProject(slug: string, name = "Original") {
    const { id } = await one<{ id: string }>(
      db,
      "insert into public.projects (slug, name) values ($1, $2) returning id",
      [slug, name]
    );
    await db.query("delete from public.activity_log where entity_id = $1", [id]);
    return id;
  }

  const as = (who: { id: string }, sql: string, params: unknown[] = []) =>
    asUser(db, { sub: who.id }, () => db.query(sql, params));

  const rename = (who: { id: string }, id: string, name: string) =>
    as(who, "update public.projects set name = $2 where id = $1", [id, name]);

  const revisions = async (id: string) =>
    (
      await db.query<Revision>(
        "select snapshot, actor_id from public.content_revisions where entity_type = 'projects' and entity_id = $1 order by id",
        [id]
      )
    ).rows;

  const activity = async (id: string) =>
    (
      await db.query<Activity>(
        "select action, actor_id, actor_name, detail from public.activity_log where entity_type = 'projects' and entity_id = $1 order by id",
        [id]
      )
    ).rows;

  /** Move every revision of `id` back past the 5-minute coalescing window. */
  const ageRevisions = (id: string, minutes = 6) =>
    db.query(
      `update public.content_revisions set created_at = created_at - make_interval(mins => $2)
       where entity_type = 'projects' and entity_id = $1`,
      [id, minutes]
    );

  const ageActivity = (id: string, minutes = 6) =>
    db.query(
      `update public.activity_log set created_at = created_at - make_interval(mins => $2)
       where entity_type = 'projects' and entity_id = $1`,
      [id, minutes]
    );

  describe("content_revisions", () => {
    it("coalesces one editor's burst of saves into one snapshot — of the state BEFORE the burst", async () => {
      const id = await newProject("rev-burst");
      await rename(alice, id, "Second");
      await rename(alice, id, "Third");
      const revs = await revisions(id);
      expect(revs).toHaveLength(1);
      expect(revs[0].snapshot.name).toBe("Original");
      expect(revs[0].actor_id).toBe(alice.id);
    });

    it("takes a second snapshot when a different editor saves inside the window", async () => {
      const id = await newProject("rev-two-editors");
      await rename(alice, id, "Alice's");
      await rename(bob, id, "Bob's");
      const revs = await revisions(id);
      expect(revs.map((r) => r.actor_id)).toEqual([alice.id, bob.id]);
      expect(revs.map((r) => r.snapshot.name)).toEqual(["Original", "Alice's"]);
    });

    it("takes a new snapshot for the same editor once the window has passed", async () => {
      const id = await newProject("rev-window");
      await rename(alice, id, "Second");
      await ageRevisions(id);
      await rename(alice, id, "Third");
      expect((await revisions(id)).map((r) => r.snapshot.name)).toEqual(["Original", "Second"]);
    });

    it("always snapshots a DELETE, even right after a coalesced edit", async () => {
      const id = await newProject("rev-delete");
      await rename(alice, id, "Edited");
      await as(alice, "delete from public.projects where id = $1", [id]);
      const revs = await revisions(id);
      expect(revs).toHaveLength(2);
      expect(revs[1].snapshot.name).toBe("Edited"); // the row as it was when deleted
    });

    it("skips a no-op save (touch_updated_at moves updated_at on every UPDATE)", async () => {
      const id = await newProject("rev-noop");
      await as(alice, "update public.projects set name = name where id = $1", [id]);
      expect(await revisions(id)).toHaveLength(0);
    });

    it("keeps only the newest 20 per entity — and never prunes a different entity", async () => {
      // the sibling's single snapshot is the OLDEST row in the table, so a
      // global "keep newest 20" would be the thing that deletes it
      const sibling = await newProject("rev-prune-sibling");
      await rename(alice, sibling, "touched once");

      const id = await newProject("rev-prune", "v0");
      for (let i = 1; i <= 25; i++) {
        await rename(alice, id, `v${i}`);
        await ageRevisions(id); // spread every save past the window
      }
      const revs = await revisions(id);
      expect(revs).toHaveLength(20);
      // the 25 snapshots were v0..v24; the oldest five are gone
      expect(revs[0].snapshot.name).toBe("v5");
      expect(revs[19].snapshot.name).toBe("v24");

      expect(await revisions(sibling)).toHaveLength(1);
    });

    it("records service-role writes with no actor, coalesced like anyone else", async () => {
      const id = await newProject("rev-service");
      await asService(db, () => db.query("update public.projects set name = 'S1' where id = $1", [id]));
      await asService(db, () => db.query("update public.projects set name = 'S2' where id = $1", [id]));
      const revs = await revisions(id);
      expect(revs).toHaveLength(1);
      expect(revs[0].actor_id).toBeNull();
    });

    it("snapshots site_settings under entity_id '1'", async () => {
      await as(alice, "update public.site_settings set tagline = 'A new tagline' where id = 1");
      const { n } = await one<{ n: number }>(
        db,
        "select count(*)::int as n from public.content_revisions where entity_type = 'site_settings' and entity_id = '1'"
      );
      expect(n).toBe(1);
    });

    it("can't be written or rewritten by staff directly (history is trigger-only)", async () => {
      await expect(
        as(alice, "insert into public.content_revisions (entity_type, entity_id, snapshot) values ('projects', 'x', '{}')")
      ).rejects.toThrow(/permission denied|row-level security/);
      await expect(as(alice, "delete from public.content_revisions")).rejects.toThrow(
        /permission denied|row-level security/
      );
    });
  });

  describe("activity_log", () => {
    it("logs create → update → publish → unpublish → delete, coalescing the updates", async () => {
      const { id } = await asUser(db, { sub: alice.id }, () =>
        one<{ id: string }>(db, "insert into public.projects (slug, name) values ('act-life', 'Lifecycle') returning id")
      );
      await rename(alice, id, "Lifecycle 2");
      await rename(alice, id, "Lifecycle 3"); // coalesced into the update above
      await as(alice, "update public.projects set published = true where id = $1", [id]);
      await as(alice, "update public.projects set published = false where id = $1", [id]);
      await as(alice, "delete from public.projects where id = $1", [id]);

      const log = await activity(id);
      expect(log.map((a) => a.action)).toEqual(["create", "update", "publish", "unpublish", "delete"]);
      expect(new Set(log.map((a) => a.actor_id))).toEqual(new Set([alice.id]));
      expect(log[0].actor_name).toBe("Alice Admin");
      // the label survives the row being deleted
      expect(log[4].detail.label).toBe("Lifecycle 3");
    });

    it("doesn't coalesce one editor's update into another's", async () => {
      const id = await newProject("act-two");
      await rename(alice, id, "A");
      await rename(bob, id, "B");
      const log = await activity(id);
      expect(log.map((a) => [a.action, a.actor_name])).toEqual([
        ["update", "Alice Admin"],
        ["update", "Bob Builder"],
      ]);
    });

    it("logs a fresh update line once the 5-minute window has passed", async () => {
      const id = await newProject("act-window");
      await rename(alice, id, "A");
      await ageActivity(id);
      await rename(alice, id, "B");
      expect((await activity(id)).map((a) => a.action)).toEqual(["update", "update"]);
    });

    it("never coalesces publish / unpublish", async () => {
      const id = await newProject("act-flip");
      for (const p of [true, false, true]) {
        await as(alice, "update public.projects set published = $2 where id = $1", [id, p]);
      }
      expect((await activity(id)).map((a) => a.action)).toEqual(["publish", "unpublish", "publish"]);
    });

    it("ignores a no-op save", async () => {
      const id = await newProject("act-noop");
      await as(alice, "update public.projects set name = name where id = $1", [id]);
      expect(await activity(id)).toHaveLength(0);
    });

    it("can't be forged or wiped through the client key, even by staff", async () => {
      await expect(
        as(alice, "insert into public.activity_log (action) values ('forged')")
      ).rejects.toThrow(/permission denied|row-level security/);
      await expect(as(alice, "delete from public.activity_log")).rejects.toThrow(
        /permission denied|row-level security/
      );
    });
  });

  describe("site_revision", () => {
    const rev = async () => Number((await one<{ rev: string }>(db, "select rev from public.site_revision where id = 1")).rev);

    it("bumps exactly once per statement, however many rows it touches", async () => {
      await newProject("bump-a");
      await newProject("bump-b");
      await newProject("bump-c");
      const before = await rev();
      await as(alice, "update public.projects set sort_order = sort_order + 1 where slug like 'bump-%'");
      expect(await rev()).toBe(before + 1);
    });

    it("bumps for every content table", async () => {
      for (const t of CONTENT_TABLES) {
        const before = await rev();
        // a statement that touches zero rows still fires a statement trigger
        await as(alice, `update public.${t} set updated_at = updated_at where false`);
        expect(await rev(), t).toBe(before + 1);
      }
    });
  });

  it("every content table carries all three triggers", async () => {
    const res = await db.query<{ tbl: string; tgname: string }>(
      `select c.relname as tbl, t.tgname
       from pg_trigger t join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal`
    );
    const have = new Set(res.rows.map((r) => `${r.tbl}.${r.tgname}`));
    const missing = CONTENT_TABLES.flatMap((t) =>
      ["_content_revision", "_activity_log", "_site_revision"]
        .map((s) => `${t}.${t}${s}`)
        .filter((name) => !have.has(name))
    );
    expect(missing).toEqual([]);
  });
});
