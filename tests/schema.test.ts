import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEAD_LITE_COLUMNS } from "@/app/admin/_lib/inbox";
import { applySchema, asUser, bootSupabase, one, readSchema } from "./helpers/db";

/**
 * CLAUDE.md promises the schema is "idempotent, so re-running it is safe" —
 * and re-running it is how a live database is upgraded (the panel's own error
 * copy tells people to). A second run that errors (a CREATE without IF NOT
 * EXISTS, a policy without its DROP, an ALTER that can't repeat) strands a
 * live project half-migrated, so both runs are checked separately, on a fresh
 * database AND over an older schema with data in it.
 */

const sql = readSchema();
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("supabase/schema.sql on a fresh project", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await bootSupabase();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("applies cleanly", async () => {
    await expect(applySchema(db, sql)).resolves.toBeUndefined();
  });

  it("applies cleanly a second time over itself", async () => {
    await expect(applySchema(db, sql)).resolves.toBeUndefined();
  });

  it("leaves exactly one row in each singleton table after two runs", async () => {
    const r = await one<{ settings: number; rev: number }>(
      db,
      `select (select count(*)::int from public.site_settings) as settings,
              (select count(*)::int from public.site_revision) as rev`
    );
    expect(r).toEqual({ settings: 1, rev: 1 });
  });

  it("doesn't stack duplicate constraints or triggers on a re-run", async () => {
    const fks = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_constraint
       where conrelid = 'public.leads'::regclass and contype = 'f'`
    );
    expect(fks.rows[0].n).toBe(1);

    const checks = await db.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'public.profiles'::regclass and contype = 'c' order by 1`
    );
    expect(checks.rows.map((r) => r.conname)).toEqual(["profiles_owner_not_disabled", "profiles_role_check"]);
  });

  it("enables row level security on every table in public", async () => {
    // a table without RLS is readable and writable by anyone holding the anon
    // key (Supabase grants anon ALL by default) — the quietest hole there is
    const res = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       order by 1`
    );
    expect(res.rows.map((r) => r.relname)).toEqual([]);
  });

  it("locks the work bucket to raster images under 10 MB (no SVG — it can carry script)", async () => {
    const b = await one<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      db,
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'work'"
    );
    expect(b.public).toBe(true);
    expect(Number(b.file_size_limit)).toBe(10 * 1024 * 1024);
    expect(b.allowed_mime_types).toEqual(expect.arrayContaining(["image/png", "image/jpeg", "image/webp"]));
    expect(b.allowed_mime_types.every((m) => m.startsWith("image/"))).toBe(true);
    expect(b.allowed_mime_types).not.toContain("image/svg+xml");
  });

  it("has every leads column the inbox selects (app ↔ schema drift)", async () => {
    // PostgREST answers a select of a missing column with an error the inbox
    // shows as "nothing here" — e.g. if `ip_hash` were renamed on one side only
    const wanted = LEAD_LITE_COLUMNS.split(",").map((c) =>
      c.trim().replace(/^\w+:/, "").replace(/->.*$/, "")
    );
    const res = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'leads'"
    );
    const have = new Set(res.rows.map((r) => r.column_name));
    expect(wanted.filter((c) => !have.has(c))).toEqual([]);
  });

  it("puts site_revision in the realtime publication", async () => {
    const res = await db.query(
      "select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'site_revision'"
    );
    expect(res.rows).toHaveLength(1);
  });
});

describe("supabase/schema.sql over an existing pre-Phase-1 database", () => {
  let db: PGlite;
  const editorId = randomUUID();
  const ownerId = randomUUID();

  beforeAll(async () => {
    db = await bootSupabase();
    // the bucket as an old project has it: public, no limits at all
    await db.exec(`insert into storage.buckets (id, name, public) values ('work', 'work', true);`);
    await db.exec(fixture("schema-v0.sql"));
    await db.exec(fixture("schema-v1-additions.sql"));
    // live data in the shapes Phase 1 migrates
    await db.query(
      `insert into auth.users (id, email) values ($1, 'owner@example.test'), ($2, 'ed@example.test')`,
      [ownerId, editorId]
    );
    await db.query(`update public.profiles set role = 'owner' where id = $1`, [ownerId]);
    await db.query(`update public.profiles set role = 'editor' where id = $1`, [editorId]);
    await db.exec(`
      insert into public.invitations (email, role) values ('pending@example.test', 'editor');
      insert into public.leads (kind, name, message, ip) values ('contact', 'Old Lead', 'hi', '203.0.113.7');
    `);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("the legacy fixture really has the old shapes", async () => {
    const r = await one<{ role: string }>(db, "select role from public.profiles where id = $1", [editorId]);
    expect(r.role).toBe("editor");
  });

  it("upgrades cleanly, and again", async () => {
    await expect(applySchema(db, sql)).resolves.toBeUndefined();
    await expect(applySchema(db, sql)).resolves.toBeUndefined();
  });

  it("turns retired editors into admins and keeps the owner", async () => {
    const res = await db.query<{ id: string; role: string }>("select id, role from public.profiles");
    const roles = Object.fromEntries(res.rows.map((r) => [r.id, r.role]));
    expect(roles).toEqual({ [ownerId]: "owner", [editorId]: "admin" });
  });

  it("locks nobody out: existing staff are enabled and their current tokens still work", async () => {
    const ok = await asUser(db, { sub: editorId }, async () =>
      (await one<{ ok: boolean }>(db, "select public.is_staff() as ok")).ok
    );
    expect(ok).toBe(true);
  });

  it("migrates pending editor invitations to admin", async () => {
    const r = await one<{ role: string }>(db, "select role from public.invitations where email = 'pending@example.test'");
    expect(r.role).toBe("admin");
  });

  it("drops the raw ip column from leads but keeps the lead", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'leads'"
    );
    const names = cols.rows.map((c) => c.column_name);
    expect(names).not.toContain("ip");
    expect(names).toEqual(expect.arrayContaining(["ip_hash", "replied_at", "replied_by", "job_id"]));
    const { n } = await one<{ n: number }>(db, "select count(*)::int as n from public.leads where name = 'Old Lead'");
    expect(n).toBe(1);
  });

  it("accepts the new 'application' lead kind", async () => {
    await expect(
      db.query("insert into public.leads (kind, name) values ('application', 'Applicant')")
    ).resolves.toBeDefined();
  });

  it("replaces the old admin-wide policies instead of stacking next to them", async () => {
    const res = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where schemaname = 'public' and policyname in ('invitations_admin_read', 'profiles_admin_write')"
    );
    expect(res.rows).toEqual([]);
  });

  it("tightens a work bucket that already existed", async () => {
    const b = await one<{ file_size_limit: string | null; allowed_mime_types: string[] | null }>(
      db,
      "select file_size_limit, allowed_mime_types from storage.buckets where id = 'work'"
    );
    expect(Number(b.file_size_limit)).toBe(10 * 1024 * 1024);
    expect(b.allowed_mime_types).not.toBeNull();
    expect(b.allowed_mime_types).not.toContain("image/svg+xml");
  });
});
