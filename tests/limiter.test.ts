import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, createAuthUser, createTestDb, one } from "./helpers/db";

/**
 * consume_security_limit is the only rate limit that holds across serverless
 * instances (the in-memory Maps are per warm instance). Two silent failures
 * matter: it hands out one slot too many under a burst, or a visitor can call
 * it directly over PostgREST and reset / exhaust other people's quotas.
 */
describe("consume_security_limit", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db?.close();
  });

  const take = (key: string, limit = 2, windowSeconds = 60) =>
    db.query<{ allowed: boolean }>(
      "select public.consume_security_limit($1, $2, $3) as allowed",
      [key, limit, windowSeconds]
    );

  /** Pretend the window ended without sleeping through it. */
  const expire = (key: string) =>
    db.query(
      "update public.security_limits set window_ends_at = now() - interval '1 second' where key = $1",
      [key]
    );

  it("grants exactly `limit` slots to a burst of callers", async () => {
    // PGlite is one backend, so these queue rather than truly race; the
    // atomicity itself is pinned by the shape check below
    const results = await asService(db, () => Promise.all([take("k"), take("k"), take("k")]));
    const allowed = results.map((r) => r.rows[0].allowed);
    expect(allowed.filter(Boolean)).toHaveLength(2);
    expect(allowed).toEqual([true, true, false]);
  });

  it("keeps refusing for the rest of the window", async () => {
    const res = await asService(db, () => take("k"));
    expect(res.rows[0].allowed).toBe(false);
  });

  it("resets when the window expires — to a FULL new window, not one extra slot", async () => {
    await expire("k");
    const results = await asService(db, async () => [await take("k"), await take("k"), await take("k")]);
    expect(results.map((r) => r.rows[0].allowed)).toEqual([true, true, false]);
  });

  it("keeps keys independent", async () => {
    const res = await asService(db, () => take("another-key"));
    expect(res.rows[0].allowed).toBe(true);
  });

  it("treats a limit below 1 as 'nothing allowed'", async () => {
    const res = await asService(db, () => take("zero-limit", 0));
    expect(res.rows[0].allowed).toBe(false);
  });

  it("rejects an empty key rather than sharing one bucket for everyone", async () => {
    await expect(asService(db, () => take(""))).rejects.toThrow(/key is required/);
  });

  it("is written as one atomic upsert (PGlite can't race two backends, so pin the shape)", async () => {
    // A read-then-write would pass every test above and still let two
    // concurrent requests both take the last slot in production.
    const { def } = await one<{ def: string }>(
      db,
      "select pg_get_functiondef('public.consume_security_limit(text,integer,integer)'::regprocedure) as def"
    );
    expect(def).toMatch(/on\s+conflict/i);
    expect(def).toMatch(/do\s+update/i);
  });

  it("can't be executed by anon or authenticated (only the service role)", async () => {
    const privs = await one<Record<string, boolean>>(
      db,
      `select
         has_function_privilege('anon',          'public.consume_security_limit(text,integer,integer)', 'EXECUTE') as anon,
         has_function_privilege('authenticated', 'public.consume_security_limit(text,integer,integer)', 'EXECUTE') as authenticated,
         has_function_privilege('service_role',  'public.consume_security_limit(text,integer,integer)', 'EXECUTE') as service`
    );
    expect(privs).toEqual({ anon: false, authenticated: false, service: true });

    await expect(asAnon(db, () => take("k"))).rejects.toThrow(/permission denied/);
    const user = await createAuthUser(db);
    await expect(asUser(db, { sub: user.id }, () => take("k"))).rejects.toThrow(/permission denied/);
  });

  it("keeps the counters themselves away from anon and authenticated", async () => {
    await expect(
      asAnon(db, () => db.query("select * from public.security_limits"))
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, () => db.query("delete from public.security_limits"))
    ).rejects.toThrow(/permission denied/);
  });
});
