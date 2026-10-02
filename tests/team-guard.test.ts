import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asService,
  asUser,
  createAuthUser,
  createStaff,
  createTestDb,
  epoch,
  one,
  type Claims,
} from "./helpers/db";

/**
 * Team management is the owner's alone (Phase 1). These run as the end-user
 * roles PostgREST would use — i.e. what anyone holding the anon key plus their
 * own JWT can do, bypassing the panel's server actions entirely.
 *
 * With roles limited to owner | admin, the only role changes that exist are to
 * or from 'owner', and those are service-role only. So what the owner can do
 * to an admin from the panel is disable / re-enable / rename them.
 */

type Profile = { role: string; disabled: boolean; full_name: string | null };

const profileOf = (db: PGlite, id: string) =>
  one<Profile>(db, "select role, disabled, full_name from public.profiles where id = $1", [id]);

/** Run a write that RLS may filter (silent no-op) or the guard may reject (error). */
const attempt = (p: Promise<unknown>) => p.then(() => "ok" as const).catch(() => "rejected" as const);

const isStaffAs = (db: PGlite, claims: Claims & { sub: string }) =>
  asUser(db, claims, async () => (await one<{ ok: boolean }>(db, "select public.is_staff() as ok")).ok);

const isOwnerAs = (db: PGlite, claims: Claims & { sub: string }) =>
  asUser(db, claims, async () => (await one<{ ok: boolean }>(db, "select public.is_owner() as ok")).ok);

describe("team guard (profiles RLS + guard_profile_write)", () => {
  let db: PGlite;
  let owner: { id: string };
  let admin: { id: string };
  let other: { id: string };

  beforeAll(async () => {
    db = await createTestDb();
    owner = await createStaff(db, "owner", { fullName: "Olive Owner" });
    admin = await createStaff(db, "admin", { fullName: "Adam Admin" });
    other = await createStaff(db, "admin", { fullName: "Otto Other" });
  });

  afterAll(async () => {
    await db?.close();
  });

  const update = (actor: { id: string }, sql: string, params: unknown[]) =>
    attempt(asUser(db, { sub: actor.id }, () => db.query(sql, params)));

  describe("an admin", () => {
    it("can't change another admin's role", async () => {
      await update(admin, "update public.profiles set role = 'owner' where id = $1", [other.id]);
      expect((await profileOf(db, other.id)).role).toBe("admin");
    });

    it("can't disable another admin", async () => {
      await update(admin, "update public.profiles set disabled = true where id = $1", [other.id]);
      expect((await profileOf(db, other.id)).disabled).toBe(false);
    });

    it("can't disable or demote the owner", async () => {
      await update(admin, "update public.profiles set disabled = true where id = $1", [owner.id]);
      await update(admin, "update public.profiles set role = 'admin' where id = $1", [owner.id]);
      expect(await profileOf(db, owner.id)).toMatchObject({ role: "owner", disabled: false });
    });

    it("can't promote themselves", async () => {
      const r = await update(admin, "update public.profiles set role = 'owner' where id = $1", [admin.id]);
      expect(r).toBe("rejected");
      expect((await profileOf(db, admin.id)).role).toBe("admin");
    });

    it("can't disable themselves either (it's team management)", async () => {
      const r = await update(admin, "update public.profiles set disabled = true where id = $1", [admin.id]);
      expect(r).toBe("rejected");
      expect((await profileOf(db, admin.id)).disabled).toBe(false);
    });

    it("can't remove another admin", async () => {
      await update(admin, "delete from public.profiles where id = $1", [other.id]);
      expect(await profileOf(db, other.id)).toBeDefined();
    });

    it("can rename themselves", async () => {
      const r = await update(admin, "update public.profiles set full_name = 'Adam A.' where id = $1", [admin.id]);
      expect(r).toBe("ok");
      expect((await profileOf(db, admin.id)).full_name).toBe("Adam A.");
    });

    it("can't un-revoke themselves by resetting sessions_valid_after", async () => {
      // revoked, then signed back in with a fresh token: if that token could
      // write the stamp, the old (stolen) tokens would come back to life
      const temp = await createStaff(db, "admin");
      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [temp.id]));
      const stamp = async () =>
        (await one<{ t: string }>(db, "select sessions_valid_after::text as t from public.profiles where id = $1", [temp.id])).t;
      const before = await stamp();
      expect(before).not.toMatch(/^1970/);

      const r = await update(
        temp,
        "update public.profiles set sessions_valid_after = 'epoch' where id = $1",
        [temp.id]
      );
      expect(r).toBe("rejected");
      expect(await stamp()).toBe(before);
    });
  });

  describe("the owner", () => {
    it("can disable and re-enable an admin", async () => {
      expect(await update(owner, "update public.profiles set disabled = true where id = $1", [other.id])).toBe("ok");
      expect((await profileOf(db, other.id)).disabled).toBe(true);
      expect(await update(owner, "update public.profiles set disabled = false where id = $1", [other.id])).toBe("ok");
      expect((await profileOf(db, other.id)).disabled).toBe(false);
    });

    it("can rename an admin", async () => {
      expect(
        await update(owner, "update public.profiles set full_name = 'Otto O.' where id = $1", [other.id])
      ).toBe("ok");
      expect((await profileOf(db, other.id)).full_name).toBe("Otto O.");
    });

    it("can't grant the owner role to an admin", async () => {
      const r = await update(owner, "update public.profiles set role = 'owner' where id = $1", [other.id]);
      expect(r).toBe("rejected");
      expect((await profileOf(db, other.id)).role).toBe("admin");
    });

    it("can't change their own role", async () => {
      const r = await update(owner, "update public.profiles set role = 'admin' where id = $1", [owner.id]);
      expect(r).toBe("rejected");
      expect((await profileOf(db, owner.id)).role).toBe("owner");
    });

    it("can't disable themselves", async () => {
      const r = await update(owner, "update public.profiles set disabled = true where id = $1", [owner.id]);
      expect(r).toBe("rejected");
      expect((await profileOf(db, owner.id)).disabled).toBe(false);
    });

    it("can't delete the owner row", async () => {
      const r = await update(owner, "delete from public.profiles where id = $1", [owner.id]);
      expect(r).toBe("rejected");
      expect(await profileOf(db, owner.id)).toBeDefined();
    });

    it("can't insert a second owner", async () => {
      // an auth user with no profile yet (no invitation → the trigger made none)
      const fresh = await createAuthUser(db);
      expect(await profileOf(db, fresh.id)).toBeUndefined();
      const r = await update(
        owner,
        "insert into public.profiles (id, email, role) values ($1, $2, 'owner')",
        [fresh.id, fresh.email]
      );
      expect(r).toBe("rejected");
      expect(await profileOf(db, fresh.id)).toBeUndefined();
    });

    it("can remove an admin", async () => {
      const temp = await createStaff(db, "admin");
      expect(await update(owner, "delete from public.profiles where id = $1", [temp.id])).toBe("ok");
      expect(await profileOf(db, temp.id)).toBeUndefined();
    });
  });

  describe("the service role (server code, SQL editor)", () => {
    it("can grant and remove the owner role", async () => {
      const temp = await createStaff(db, "admin");
      await asService(db, () => db.query("update public.profiles set role = 'owner' where id = $1", [temp.id]));
      expect((await profileOf(db, temp.id)).role).toBe("owner");
      await asService(db, () => db.query("update public.profiles set role = 'admin' where id = $1", [temp.id]));
      expect((await profileOf(db, temp.id)).role).toBe("admin");
    });

    it("still can't disable an owner (nobody would be left to re-enable them)", async () => {
      await expect(
        asService(db, () => db.query("update public.profiles set disabled = true where id = $1", [owner.id]))
      ).rejects.toThrow(/profiles_owner_not_disabled|check constraint/);
    });
  });

  describe("is_staff()", () => {
    it("is true for an enabled admin with a fresh token", async () => {
      expect(await isStaffAs(db, { sub: admin.id })).toBe(true);
    });

    it("is false for a disabled admin, and is_owner() false for them too", async () => {
      const temp = await createStaff(db, "admin");
      await db.query("update public.profiles set disabled = true where id = $1", [temp.id]);
      expect(await isStaffAs(db, { sub: temp.id })).toBe(false);
      expect(await isOwnerAs(db, { sub: temp.id })).toBe(false);
    });

    it("is false for a JWT issued before sessions_valid_after", async () => {
      const temp = await createStaff(db, "admin");
      const old = { sub: temp.id, iat: epoch(-3600) };
      expect(await isStaffAs(db, old)).toBe(true);

      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [temp.id]));

      expect(await isStaffAs(db, old)).toBe(false);
      expect(await isStaffAs(db, { sub: temp.id, iat: epoch(5) })).toBe(true);
    });

    it("accepts a token issued in the same second as the revocation (password-reset sign-in)", async () => {
      const temp = await createStaff(db, "admin");
      const second = epoch(-10);
      // revoked at second + 0.7s; the new token's iat is whole seconds
      await db.query(
        "update public.profiles set sessions_valid_after = to_timestamp($2::numeric + 0.7) where id = $1",
        [temp.id, second]
      );
      expect(await isStaffAs(db, { sub: temp.id, iat: second })).toBe(true);
      expect(await isStaffAs(db, { sub: temp.id, iat: second - 1 })).toBe(false);
    });

    it("treats a token with no iat as old once sessions have been revoked", async () => {
      const temp = await createStaff(db, "admin");
      expect(await isStaffAs(db, { sub: temp.id, iat: undefined })).toBe(true);
      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [temp.id]));
      expect(await isStaffAs(db, { sub: temp.id, iat: undefined })).toBe(false);
    });

    it("is_owner() is false for a revoked owner token", async () => {
      const old = { sub: owner.id, iat: epoch(-3600) };
      expect(await isOwnerAs(db, old)).toBe(true);
      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [owner.id]));
      expect(await isOwnerAs(db, old)).toBe(false);
      expect(await isOwnerAs(db, { sub: owner.id })).toBe(true);
    });
  });

  describe("revoke_user_sessions()", () => {
    it("deletes that user's auth sessions (and only theirs)", async () => {
      const a = await createStaff(db, "admin");
      const b = await createStaff(db, "admin");
      await db.query("insert into auth.sessions (user_id) values ($1), ($1), ($2)", [a.id, b.id]);
      await db.query(
        `insert into auth.refresh_tokens (token, user_id, session_id)
         select 'rt-' || id, user_id::text, id from auth.sessions where user_id = $1`,
        [a.id]
      );

      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [a.id]));

      const left = await one<{ a: number; b: number; rt: number }>(
        db,
        `select
           (select count(*)::int from auth.sessions where user_id = $1) as a,
           (select count(*)::int from auth.sessions where user_id = $2) as b,
           (select count(*)::int from auth.refresh_tokens where user_id = $1::text) as rt`,
        [a.id, b.id]
      );
      expect(left).toEqual({ a: 0, b: 1, rt: 0 });
    });
  });
});
