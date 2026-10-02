import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthUser, createTestDb, one, uniqueEmail } from "./helpers/db";

/**
 * handle_new_user() decides who gets into the panel at all. Sign-up is open at
 * the GoTrue level (anyone with the anon key can create an auth user), so this
 * trigger is the actual gate: first account → owner, invited → admin,
 * everyone else → an auth user with no profile and therefore no access.
 */

type Profile = { role: string; full_name: string | null; email: string };

const profileOf = (db: PGlite, id: string) =>
  one<Profile | undefined>(db, "select role, full_name, email from public.profiles where id = $1", [id]);

const invite = (db: PGlite, email: string, fullName: string | null, acceptedAt: string | null = null) =>
  db.query("insert into public.invitations (email, full_name, accepted_at) values ($1, $2, $3)", [
    email,
    fullName,
    acceptedAt,
  ]);

describe("handle_new_user", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("starts with no profiles (fresh project)", async () => {
    const { n } = await one<{ n: number }>(db, "select count(*)::int as n from public.profiles");
    expect(n).toBe(0);
    const { has } = await one<{ has: boolean }>(db, "select public.has_owner() as has");
    expect(has).toBe(false);
  });

  it("makes the very first auth user the owner", async () => {
    const first = await createAuthUser(db, { fullName: "Olive Owner" });
    expect(await profileOf(db, first.id)).toMatchObject({ role: "owner", full_name: "Olive Owner" });
    const { has } = await one<{ has: boolean }>(db, "select public.has_owner() as has");
    expect(has).toBe(true);
  });

  it("gives a later sign-up with no invitation no profile at all", async () => {
    const stranger = await createAuthUser(db, { fullName: "Some Stranger" });
    expect(await profileOf(db, stranger.id)).toBeUndefined();
  });

  it("ignores a role smuggled in through user metadata", async () => {
    // signUp({ options: { data: { role: 'owner' } } }) is user-controlled
    const sneaky = await createAuthUser(db, { meta: { role: "owner" } });
    expect(await profileOf(db, sneaky.id)).toBeUndefined();
  });

  it("gives an invited user an admin profile with the invitation's name", async () => {
    const email = uniqueEmail("invitee");
    await invite(db, email, "Ivy Invitee");
    // the name the invitee typed loses to the one the owner chose; the email
    // matches case-insensitively (invitations are stored lower-cased)
    const user = await createAuthUser(db, { email: email.toUpperCase(), fullName: "Typed Name" });
    expect(await profileOf(db, user.id)).toMatchObject({ role: "admin", full_name: "Ivy Invitee" });
  });

  it("falls back to the typed name when the invitation has none", async () => {
    const email = uniqueEmail("noname");
    await invite(db, email, null);
    const user = await createAuthUser(db, { email, fullName: "Typed Name" });
    expect(await profileOf(db, user.id)).toMatchObject({ role: "admin", full_name: "Typed Name" });
  });

  it("never makes an invited user an owner, whatever the metadata says", async () => {
    const email = uniqueEmail("invited-sneaky");
    await invite(db, email, "Ina");
    const user = await createAuthUser(db, { email, meta: { role: "owner" } });
    expect((await profileOf(db, user.id))?.role).toBe("admin");
  });

  it("ignores an invitation that was already accepted", async () => {
    const email = uniqueEmail("used");
    await invite(db, email, "Used Invite", new Date().toISOString());
    const user = await createAuthUser(db, { email });
    expect(await profileOf(db, user.id)).toBeUndefined();
  });

  it("refuses to store an invitation for any role but admin", async () => {
    await expect(
      db.query("insert into public.invitations (email, role) values ($1, 'owner')", [uniqueEmail("owner-invite")])
    ).rejects.toThrow(/check constraint/);
  });

  it("refuses a mixed-case invitation email (matching relies on lower-case storage)", async () => {
    await expect(invite(db, "Mixed@Example.test", "M")).rejects.toThrow(/check constraint/);
  });
});
