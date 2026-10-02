import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

/**
 * PGlite harness: a real Postgres (WASM) with just enough of Supabase stubbed
 * in to run supabase/schema.sql exactly as the SQL editor would.
 *
 * The stubs that matter for fidelity are the PRIVILEGES, not the tables:
 * Supabase grants anon/authenticated/service_role ALL on every new table,
 * function and sequence in `public` through default privileges, and Postgres
 * itself grants EXECUTE on every new function to PUBLIC. A schema that forgets
 * a `revoke` is wide open in production while looking locked down in a bare
 * Postgres — so the harness reproduces those defaults, and RLS / explicit
 * revokes have to be the thing that keeps anon out.
 */

/**
 * TEST_SCHEMA_PATH points the suites at another file — for mutation-checking
 * the tests themselves (break a copy of the schema, confirm a test goes red)
 * without touching supabase/schema.sql.
 */
export const SCHEMA_PATH =
  process.env.TEST_SCHEMA_PATH ?? fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url));

export const readSchema = () => readFileSync(SCHEMA_PATH, "utf8");

const SUPABASE_STUBS = /* sql */ `
-- ---------------------------------------------------------------- roles
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator noinherit;
create role supabase_auth_admin nologin noinherit;
create role supabase_storage_admin nologin noinherit;
create role supabase_admin nologin;
grant anon, authenticated, service_role to authenticator;

-- Supabase's default privileges on public (see header comment)
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------------------------------------------------------------- extensions
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto with schema extensions;
create extension "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------- auth
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  instance_id         uuid,
  aud                 text default 'authenticated',
  role                text default 'authenticated',
  email               text,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  invited_at          timestamptz,
  confirmed_at        timestamptz,
  last_sign_in_at     timestamptz,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  is_super_admin      boolean,
  phone               text,
  banned_until        timestamptz,
  deleted_at          timestamptz,
  is_anonymous        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table auth.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  aal          text,
  not_after    timestamptz,
  refreshed_at timestamp,
  user_agent   text,
  ip           inet,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table auth.refresh_tokens (
  id          bigserial primary key,
  token       text,
  user_id     varchar(255),
  revoked     boolean not null default false,
  parent      varchar(255),
  session_id  uuid references auth.sessions on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table auth.identities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  provider      text not null default 'email',
  provider_id   text,
  identity_data jsonb not null default '{}'::jsonb,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant all on all tables in schema auth to supabase_auth_admin;

-- Same bodies as Supabase's: PostgREST puts the verified JWT into these GUCs.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.email() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- ---------------------------------------------------------------- storage
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  owner_id           text,
  public             boolean default false,
  avif_autodetection boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  type               text default 'STANDARD',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  user_metadata    jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  version          text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now()
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end $$;

create function storage.filename(name text) returns text language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end $$;

create function storage.extension(name text) returns text language plpgsql immutable as $$
declare _parts text[]; _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end $$;

grant execute on all functions in schema storage to anon, authenticated, service_role;

-- ---------------------------------------------------------------- realtime
create publication supabase_realtime;
`;

/** Supabase's database-level search_path. */
const SEARCH_PATH = `set search_path to "$user", public, extensions;`;

/** A PGlite with the Supabase stubs in place and the schema NOT yet applied. */
export async function bootSupabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(SUPABASE_STUBS);
  await db.exec(SEARCH_PATH);
  return db;
}

/** Run supabase/schema.sql once, as the SQL editor would (postgres, one batch). */
export async function applySchema(db: PGlite, sql = readSchema()): Promise<void> {
  await db.exec(sql);
  // the file may `set search_path`; put Supabase's back for what follows
  await db.exec(`reset role; ${SEARCH_PATH}`);
}

/**
 * The normal entry point: stubs + schema applied TWICE. Every suite therefore
 * also re-proves idempotency against whatever the file currently says.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = await bootSupabase();
  const sql = readSchema();
  await applySchema(db, sql);
  await applySchema(db, sql);
  return db;
}

// ---------------------------------------------------------------------------
// acting as someone
// ---------------------------------------------------------------------------

export type Claims = {
  sub?: string;
  role?: string;
  email?: string;
  /** seconds since epoch — what is_staff() compares to sessions_valid_after */
  iat?: number;
  exp?: number;
  [claim: string]: unknown;
};

export const epoch = (offsetSeconds = 0) => Math.floor(Date.now() / 1000) + offsetSeconds;

async function enter(db: PGlite, role: "anon" | "authenticated" | "service_role", claims: Claims) {
  await db.query(
    `select set_config('request.jwt.claims', $1, false),
            set_config('request.jwt.claim.sub', $2, false),
            set_config('request.jwt.claim.role', $3, false),
            set_config('request.jwt.claim.email', $4, false)`,
    [JSON.stringify(claims), claims.sub ?? "", role, claims.email ?? ""]
  );
  await db.exec(`set role ${role}`);
}

async function leave(db: PGlite) {
  await db.exec("reset role");
  await db.query(
    `select set_config('request.jwt.claims', '', false),
            set_config('request.jwt.claim.sub', '', false),
            set_config('request.jwt.claim.role', '', false),
            set_config('request.jwt.claim.email', '', false)`
  );
}

async function acting<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  claims: Claims,
  fn: () => Promise<T>
): Promise<T> {
  await enter(db, role, claims);
  try {
    return await fn();
  } finally {
    await leave(db);
  }
}

/** A request with only the anon key — no session. */
export const asAnon = <T>(db: PGlite, fn: () => Promise<T>) =>
  acting(db, "anon", { role: "anon", iat: epoch(-60), exp: epoch(3600) }, fn);

/**
 * A signed-in user. `iat` defaults to one second from now so a session minted
 * "just now" is never older than a sessions_valid_after stamped in the same
 * second; pass an explicit `iat` to model an old token.
 */
export const asUser = <T>(db: PGlite, claims: Claims & { sub: string }, fn: () => Promise<T>) =>
  acting(
    db,
    "authenticated",
    { role: "authenticated", aud: "authenticated", iat: epoch(1), exp: epoch(3600), ...claims },
    fn
  );

/** The service-role key (server actions, API routes). Bypasses RLS. */
export const asService = <T>(db: PGlite, fn: () => Promise<T>) =>
  acting(db, "service_role", { role: "service_role", iat: epoch(-60), exp: epoch(3600) }, fn);

// ---------------------------------------------------------------------------
// fixtures — written as postgres (the SQL editor / GoTrue), i.e. trusted
// ---------------------------------------------------------------------------

export const uniqueEmail = (label = "user") => `${label}-${randomUUID().slice(0, 8)}@example.test`;

/** Insert an auth user the way GoTrue does; handle_new_user() fires. */
export async function createAuthUser(
  db: PGlite,
  opts: { email?: string; fullName?: string; meta?: Record<string, unknown> } = {}
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = opts.email ?? uniqueEmail();
  const meta = { ...(opts.fullName ? { full_name: opts.fullName } : {}), ...(opts.meta ?? {}) };
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
     values ($1, $2, $3::jsonb, now())`,
    [id, email, JSON.stringify(meta)]
  );
  return { id, email };
}

export type StaffRole = "owner" | "admin";

/**
 * A panel member with exactly `role`. Writes the profile as postgres, which
 * the profile guard trusts — fixtures shouldn't depend on the code under test.
 */
export async function createStaff(
  db: PGlite,
  role: StaffRole,
  opts: { email?: string; fullName?: string } = {}
): Promise<{ id: string; email: string }> {
  const user = await createAuthUser(db, opts);
  await db.query(
    `insert into public.profiles (id, email, full_name, role)
     values ($1, $2, $3, $4)
     on conflict (id) do update set role = excluded.role`,
    [user.id, user.email, opts.fullName ?? null, role]
  );
  return user;
}

/** First row of a query, typed. */
export async function one<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<T>(sql, params);
  return res.rows[0];
}

/** Count rows the CURRENT role can see. */
export async function count(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) _q`, params);
  return res.rows[0].n;
}

/** Column names of a table, for tests that must adapt to the exact contract. */
export async function columns(db: PGlite, table: string, schema = "public"): Promise<Map<string, string>> {
  const res = await db.query<{ column_name: string; data_type: string }>(
    `select column_name, data_type from information_schema.columns
     where table_schema = $1 and table_name = $2`,
    [schema, table]
  );
  return new Map(res.rows.map((r) => [r.column_name, r.data_type]));
}
