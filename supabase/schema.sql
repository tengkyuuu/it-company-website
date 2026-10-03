-- ============================================================================
-- R Ally's Tech website — Supabase schema
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query
-- → paste → Run). It is idempotent, so re-running it is safe — and re-running
-- it is how an existing database is upgraded: every later addition is written
-- as ALTER / CREATE … IF NOT EXISTS / DO-block so it applies over live data.
-- The editor sends the whole file as one query, i.e. one transaction: if any
-- statement fails, nothing is applied.
--
-- What it creates:
--   profiles          one row per panel member, carrying their role
--   invitations       who the owner invited (decides that a profile is created)
--   auth_tokens       hashed one-time invite / password-reset tokens
--   security_limits   rate-limit counters (keys are HMACs, never raw IPs)
--   projects          the portfolio entries shown on /projects
--   site_settings     single-row table for the editable site copy
--   services          the six offerings shown on / and /services
--   team_members      the PUBLIC roster on /about (not the same as profiles)
--   products          the studio's own products
--   jobs              open positions (careers)
--   posts             blog / journal entries (markdown)
--   leads             contact-form submissions, chat transcripts, applications
--   content_revisions snapshots of content rows before edits/deletes (restore)
--   activity_log      the panel's audit feed
--   chat_sessions     live-chat conversations (AI, or taken over by a human)
--   chat_messages     the messages inside them
--   lead_replies      answers emailed from the inbox (sent or not, and why)
--   status_reports    latest CI test / Lighthouse results (public status page)
--   site_revision     one counter bumped on every content change (live updates)
--   work bucket       public storage for uploaded screenshots
--
-- Roles: owner > admin
--   admin   can create/edit/publish/delete all content and edit settings
--   owner   same as admin, and is the only one who manages the team
--           (invites, roles, disabling accounts). Can't be removed, demoted
--           or disabled from the panel.
--   (The old 'editor' role is retired — re-running this file turns any
--    remaining editors into admins.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'admin'
             check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

-- Phase 1 (2026-10): account kill-switches. ALTER, not part of the CREATE
-- above, so re-running this file upgrades a table that already exists.
--
-- disabled: the owner can switch an account off without deleting it (keeps the
-- person's name on their activity history, and is reversible). is_staff() is
-- false for a disabled profile, so every policy shuts at once.
alter table public.profiles add column if not exists disabled boolean not null default false;
-- sessions_valid_after: a JWT whose `iat` is older than this is no longer
-- staff, even though GoTrue would still accept it until it expires (~1h).
-- Deleting auth.sessions only stops REFRESHES; this is what makes revocation
-- immediate for the access token already in someone's browser. 'epoch' means
-- "every token is fine", so adding the column locks nobody out.
alter table public.profiles add column if not exists sessions_valid_after timestamptz not null default 'epoch';

-- Retire the 'editor' role: migrate the data FIRST (the tighter check below
-- would otherwise fail on any remaining editor row), then swap the constraint.
-- The profiles_guard trigger lets this through — it only polices end-user
-- roles, and this runs as postgres.
update public.profiles set role = 'admin' where role = 'editor';
alter table public.profiles alter column role set default 'admin';

-- Replace the role check by looking it up (any single-column CHECK on `role`)
-- rather than assuming its generated name, then re-add it under a fixed name.
-- A DO block because a plain ADD CONSTRAINT would fail on the second run.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'role'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;

  alter table public.profiles
    add constraint profiles_role_check check (role in ('owner', 'admin'));
end;
$$;

-- The owner can never be switched off — not by the panel (the guard below says
-- so politely) and not by a bug in server code running with the service key.
-- If the owner could be disabled, nobody would be left who can re-enable them.
alter table public.profiles drop constraint if exists profiles_owner_not_disabled;
alter table public.profiles
  add constraint profiles_owner_not_disabled check (not (role = 'owner' and disabled));

-- ----------------------------------------------------------------------------
-- invitations — who the owner has invited into the panel.
--
-- This is what decides that a new account gets a profile at all. Roles used to
-- come from raw_user_meta_data, which is whatever the person signing up sends —
-- so anyone could call signUp({ options: { data: { role: 'admin' } } }) and walk
-- in as an admin. A row here can only be written with the service-role key
-- (there is no insert/update/delete policy), i.e. by the panel's invite action.
-- ----------------------------------------------------------------------------
create table if not exists public.invitations (
  -- stored lower-cased; handle_new_user() matches on lower(new.email)
  email        text primary key check (email = lower(email)),
  -- only 'admin' since Phase 1: the owner is never invitable, editor is retired
  role         text not null default 'admin' check (role = 'admin'),
  full_name    text,
  invited_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  -- set when the invitee redeems their link and the account is created
  accepted_at  timestamptz
);

update public.invitations set role = 'admin' where role <> 'admin';
alter table public.invitations alter column role set default 'admin';

-- Same lookup-and-replace as profiles_role_check, for the same reason.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = 'public.invitations'::regclass
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'role'
  loop
    execute format('alter table public.invitations drop constraint %I', c.conname);
  end loop;

  alter table public.invitations
    add constraint invitations_role_check check (role = 'admin');
end;
$$;

-- Mirror new auth users into profiles — but only the ones who are meant to be
-- there:
--   * the very first account becomes the owner, so someone can invite the rest;
--   * after that, ONLY an open invitation creates a profile, always as 'admin'.
--     No invitation → no profile → the auth user exists but has zero access to
--     the panel (every policy checks is_staff()).
-- raw_user_meta_data.role is ignored entirely: it is user-controlled.
-- (Since Phase 1 the server creates the auth user when the invitee redeems
-- their link — admin.auth.admin.createUser — so this fires at accept time, not
-- invite time. Nothing in here needs to know that.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations%rowtype;
begin
  -- serialise concurrent sign-ups so two can't both see "no profiles yet"
  perform pg_advisory_xact_lock(hashtext('public.handle_new_user'));

  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      'owner'
    )
    on conflict (id) do nothing;
    return new;
  end if;

  select * into invite
  from public.invitations
  where email = lower(new.email) and accepted_at is null;

  if not found then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(invite.full_name, ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    ),
    'admin'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role checks used by the policies below. SECURITY DEFINER so that reading a
-- role inside a policy on `profiles` does not re-trigger that same policy
-- (which would be infinite recursion).
--
-- "Staff" = has a profile, isn't disabled, and is presenting a token issued
-- after their sessions were last revoked (revoke_user_sessions below). The
-- comparison floors sessions_valid_after to whole seconds because a JWT's iat
-- is whole seconds: without the floor, signing back in during the same second
-- as a revocation (exactly what a password reset does) would mint a token the
-- check rejects. A missing iat counts as 0, which only passes while
-- sessions_valid_after is still 'epoch', i.e. never revoked.
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and not p.disabled
      and coalesce((auth.jwt() ->> 'iat')::numeric, 0)
          >= floor(extract(epoch from p.sessions_valid_after))
  );
$$;

-- The owner — the only one who manages the team. Built on is_staff(), so a
-- disabled or revoked session is not "the owner" either.
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_staff()
     and exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'owner'
     );
$$;

-- Kept so anything still calling it keeps working. Since Phase 1 every staff
-- member is at least an admin, so this is exactly is_staff().
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_staff();
$$;

-- Does the panel have an owner yet? The login screen only offers "Create the
-- owner account" while this is false. Granted to anon on purpose — it leaks a
-- single boolean, and the sign-in page has no session to ask with.
create or replace function public.has_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where role = 'owner');
$$;

revoke all on function public.has_owner() from public;
grant execute on function public.has_owner() to anon, authenticated;

-- Guard on profiles. RLS decides WHICH rows a user may touch; it can't say
-- which COLUMNS, and `profiles_update_self` alone once let any signed-in user
-- run `update profiles set role = 'owner' where id = auth.uid()` with the anon
-- key.
--
-- Deliberately SECURITY INVOKER: `current_user` is then the role PostgREST
-- switched to for this request. Only the end-user roles are policed — the
-- service role (the panel's server actions), GoTrue's trigger above, the
-- SECURITY DEFINER helpers (revoke_user_sessions) and the SQL editor
-- (postgres) are trusted.
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      raise exception 'The owner role can''t be granted from the panel.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'The owner can''t be removed.' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE: id / email / created_at are system-owned. sessions_valid_after is
  -- only ever moved by revoke_user_sessions(): if a user could write it, a
  -- revoked token could simply set it back to 'epoch' and un-revoke itself.
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at
     or new.sessions_valid_after is distinct from old.sessions_valid_after then
    raise exception 'Only the name, role and access on a profile can be changed.'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'Only the owner can change roles.'
        using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'You can''t change your own role.' using errcode = '42501';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The owner role can''t be granted or removed from the panel.'
        using errcode = '42501';
    end if;
  end if;

  -- disabling is team management, so it is the owner's alone; and the owner
  -- can't be disabled (profiles_owner_not_disabled backs this up for everyone)
  if new.disabled is distinct from old.disabled then
    if not public.is_owner() then
      raise exception 'Only the owner can disable or re-enable an account.'
        using errcode = '42501';
    end if;
    if old.role = 'owner' then
      raise exception 'The owner can''t be disabled.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update or delete on public.profiles
  for each row execute function public.guard_profile_write();

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null default '',
  -- domain shown in the preview chrome (a label, e.g. "famecrm.app")
  url         text not null default '',
  -- absolute https URL; when set, the site shows a real live iframe preview
  live_url    text,
  year        text not null default '',
  summary     text not null default '',
  description text not null default '',
  highlights  text[] not null default '{}',
  tags        text[] not null default '{}',
  -- exactly three signature colors, used for tinting + browser dots
  dots        text[] not null default '{}',
  img         text,
  img2        text,
  published   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_sort_idx on public.projects (sort_order, created_at);

-- Case-study detail (added 2026-10). ALTER, not part of the CREATE above, so
-- re-running this file upgrades a table that already exists. Every column is
-- optional: the project page only renders a section when it has content.
alter table public.projects add column if not exists client      text  not null default '';
alter table public.projects add column if not exists industry    text  not null default '';
alter table public.projects add column if not exists timeline    text  not null default '';
-- "what we did" — usually titles from public.services, but free text is allowed
alter table public.projects add column if not exists services    text[] not null default '{}';
-- names from the public roster (team_members), stored as text so a project's
-- credits survive someone later leaving the roster
alter table public.projects add column if not exists team        text[] not null default '{}';
alter table public.projects add column if not exists stack       text[] not null default '{}';
alter table public.projects add column if not exists challenge   text  not null default '';
alter table public.projects add column if not exists approach    text  not null default '';
alter table public.projects add column if not exists outcome     text  not null default '';
-- [{ "value": "3×", "label": "faster checkout" }] — real, measured numbers only
alter table public.projects add column if not exists results     jsonb not null default '[]';
-- [{ "src": "https://…", "caption": "…", "kind": "desktop" | "mobile" }]
alter table public.projects add column if not exists gallery     jsonb not null default '[]';
-- the client's own words, with their permission — never a paraphrase
alter table public.projects add column if not exists testimonial_quote  text not null default '';
alter table public.projects add column if not exists testimonial_author text not null default '';
alter table public.projects add column if not exists testimonial_role   text not null default '';

-- Phase 1: can live_url actually be framed? A site that sends X-Frame-Options /
-- frame-ancestors can't be detected from the browser (cross-origin), so the
-- server probes it (after a save) and records the answer here. NULL = never
-- checked: the preview behaves as before (tries the iframe; "Open ↗" stays).
-- false = known to refuse framing: the preview shows the screenshot instead.
alter table public.projects add column if not exists embeddable       boolean;
-- human-readable why, e.g. "X-Frame-Options: DENY" — shown to staff in the panel
alter table public.projects add column if not exists embed_reason     text not null default '';
alter table public.projects add column if not exists embed_checked_at timestamptz;

-- updated_at is the editors' concurrency token (autosave and Save both write
-- `where updated_at = <what I loaded>`). The embed probe writes its verdict in
-- the background after a save; if that moved updated_at, the editor's next
-- save would report a false "someone saved a newer version". So an update that
-- touches ONLY the probe columns keeps the old updated_at. Tables without
-- those columns are unaffected, and a save that changes nothing still moves
-- updated_at as before.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
declare
  probe constant text[] := array['updated_at', 'embeddable', 'embed_reason', 'embed_checked_at'];
begin
  if (to_jsonb(new) - probe) = (to_jsonb(old) - probe)
     and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- site_settings (exactly one row, id = 1)
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
  id             integer primary key default 1 check (id = 1),
  -- doubled apostrophe: SQL escaping for the one in "R Ally's Tech"
  brand_name     text not null default 'R Ally''s Tech',
  tagline        text not null default 'Software, designed with intent.',
  email          text not null default 'hello@mykt.studio',
  phone          text not null default '',
  address_line1  text not null default '',
  address_line2  text not null default '',
  hours          text not null default '',
  availability   text not null default 'Taking on new projects',
  available      boolean not null default true,
  -- [{ "label": "LinkedIn", "href": "https://…" }, …]
  socials        jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Grants. Supabase normally applies these to new public-schema tables through
-- default privileges, but stating them makes the schema self-contained — and
-- avoids the confusing "permission denied for table projects" that shows up
-- when default privileges have been tightened. RLS below is the real gate.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.projects, public.site_settings to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
grant update on public.site_settings to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.site_settings enable row level security;

-- profiles: staff can see the team; you can edit yourself; the owner manages it
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_staff());

-- your own row only, and only while you are staff (a disabled account or a
-- revoked token can't write anything) — and the profiles_guard trigger limits
-- it to full_name, so this can't be used to promote, re-enable or un-revoke
-- yourself
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() and public.is_staff())
  with check (id = auth.uid() and public.is_staff());

-- Team management is the owner's alone since Phase 1 (admins edit content).
-- The old name is dropped too, so a re-run doesn't leave the admin-wide
-- policy sitting next to this one (permissive policies OR together).
drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists profiles_owner_write on public.profiles;
create policy profiles_owner_write on public.profiles
  for all using (public.is_owner()) with check (public.is_owner());

-- projects: the world reads published ones; staff read and write everything
drop policy if exists projects_public_read on public.projects;
create policy projects_public_read on public.projects
  for select using (published);

drop policy if exists projects_staff_read on public.projects;
create policy projects_staff_read on public.projects
  for select using (public.is_staff());

drop policy if exists projects_staff_write on public.projects;
create policy projects_staff_write on public.projects
  for all using (public.is_staff()) with check (public.is_staff());

-- settings: world readable, staff writable
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings
  for select using (true);

drop policy if exists settings_staff_write on public.site_settings;
create policy settings_staff_write on public.site_settings
  for update using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Storage: screenshots uploaded from the admin land in a public "work" bucket.
--
-- Uploads go browser → Storage directly, so the bucket itself is the only
-- server-side gate on what lands in it: raster images only, 10 MB max. No SVG —
-- an SVG is a document that can carry <script>, and this bucket is served from
-- a public URL. The ON CONFLICT branch tightens a bucket that already exists.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work', 'work', true, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists work_public_read on storage.objects;
create policy work_public_read on storage.objects
  for select using (bucket_id = 'work');

drop policy if exists work_staff_write on storage.objects;
create policy work_staff_write on storage.objects
  for insert with check (bucket_id = 'work' and public.is_staff());

drop policy if exists work_staff_update on storage.objects;
create policy work_staff_update on storage.objects
  for update using (bucket_id = 'work' and public.is_staff());

drop policy if exists work_staff_delete on storage.objects;
create policy work_staff_delete on storage.objects
  for delete using (bucket_id = 'work' and public.is_staff());

-- ============================================================================
-- Added with the chatbot + admin completion pass.
-- Idempotent like the rest of this file — safe to re-run over an existing DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- services — was lib/services.ts only, so the six offerings couldn't be edited
-- ----------------------------------------------------------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  blurb        text not null default '',
  detail       text not null default '',
  deliverables text[] not null default '{}',
  -- must be one of the IconName union in lib/services.ts:
  -- web | app | design | cloud | ai | consult
  icon         text not null default 'web',
  published    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists services_sort_idx on public.services (sort_order, created_at);

drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- team_members — the PUBLIC roster shown on /about.
--
-- Deliberately separate from `profiles`: profiles are login accounts for the
-- panel, this is who the website says the studio is. They are not the same
-- list and conflating them would mean giving a designer a password to appear
-- on the site, or leaking a contractor's login into the marketing page.
-- ----------------------------------------------------------------------------
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null default '',
  -- shown in the gradient orb; derived from `name` when left blank
  initials   text not null default '',
  published  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_sort_idx on public.team_members (sort_order, created_at);

drop trigger if exists team_members_touch_updated_at on public.team_members;
create trigger team_members_touch_updated_at
  before update on public.team_members
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- leads — contact-form submissions, chat transcripts and job applications, one
-- inbox.
--
-- Inserts are service-role only (no public insert policy): the API routes write
-- with the service key, so a leaked anon key can neither spam this table nor
-- read anyone's enquiry. Phase 1 columns (ip_hash, replied_*, job_id) and the
-- removal of the raw `ip` column are further down, after `jobs` exists.
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('contact', 'chat', 'application')),
  name       text,
  email      text,
  service    text,
  message    text,
  -- chat only: the full visible exchange, [{role, content}, ...]
  transcript jsonb,
  turns      integer,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_kind_idx on public.leads (kind, created_at desc);

alter table public.services     enable row level security;
alter table public.team_members enable row level security;
alter table public.leads        enable row level security;

-- services: world-readable when published, staff-writable
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select using (published);

drop policy if exists services_staff_read on public.services;
create policy services_staff_read on public.services
  for select using (public.is_staff());

drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services
  for all using (public.is_staff()) with check (public.is_staff());

-- team_members: same shape
drop policy if exists team_public_read on public.team_members;
create policy team_public_read on public.team_members
  for select using (published);

drop policy if exists team_staff_read on public.team_members;
create policy team_staff_read on public.team_members
  for select using (public.is_staff());

drop policy if exists team_staff_write on public.team_members;
create policy team_staff_write on public.team_members
  for all using (public.is_staff()) with check (public.is_staff());

-- leads: staff read + update (mark handled) + delete. NO insert policy and no
-- public read — writes come from the server with the service key, which bypasses
-- RLS, and enquiries must never be world-readable.
drop policy if exists leads_staff_read on public.leads;
create policy leads_staff_read on public.leads
  for select using (public.is_staff());

drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update on public.leads
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists leads_staff_delete on public.leads;
create policy leads_staff_delete on public.leads
  for delete using (public.is_staff());

grant select, insert, update, delete on public.services     to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, update, delete         on public.leads        to authenticated;
grant select on public.services     to anon;
grant select on public.team_members to anon;

-- ============================================================================
-- Added with the invite + auth hardening pass (team invites via Resend).
-- Idempotent like the rest of this file — safe to re-run over an existing DB.
--
-- The invitations table, has_owner(), the profiles_guard trigger and the new
-- handle_new_user() are defined up in the profiles section; this is their RLS.
-- ============================================================================

-- invitations: only the owner may READ them (the Team page lists pending
-- invites, and since Phase 1 the Team page is the owner's alone).
-- No insert/update/delete policy and no write grant — every write goes through
-- the service-role key in the panel's team actions, so a signed-in admin can't
-- invite themselves a friend, and nobody can mint a role for an address.
alter table public.invitations enable row level security;

drop policy if exists invitations_admin_read on public.invitations;
drop policy if exists invitations_owner_read on public.invitations;
create policy invitations_owner_read on public.invitations
  for select using (public.is_owner());

revoke all on public.invitations from anon;
revoke insert, update, delete on public.invitations from authenticated;
grant select on public.invitations to authenticated;

-- ============================================================================
-- Phase 1 — CMS upgrade (2026-10): own auth tokens, rate limits, session
-- revocation, products / jobs / posts, revisions, activity feed, live chat,
-- status reports and a site-wide revision counter.
-- Idempotent like the rest of this file — safe to re-run over an existing DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- auth_tokens — one-time links for invites and password resets.
--
-- We mint these ourselves (rather than GoTrue's magic links) so a link can be
-- single-use, short-lived and tied to one purpose. Only the SHA-256 of the raw
-- token is stored: a database leak (or a curious admin) can't turn rows back
-- into working links. Service role only — RLS is on with NO policies and every
-- client privilege is revoked, so the anon/authenticated keys see nothing.
-- ----------------------------------------------------------------------------
create table if not exists public.auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  -- hex sha256 of the raw token; the raw token only ever exists in the email
  token_hash  text unique not null,
  purpose     text not null check (purpose in ('invite', 'reset')),
  email       text not null check (email = lower(email)),
  -- reset: the account being reset. invite: null until the account exists.
  user_id     uuid references auth.users on delete cascade,
  expires_at  timestamptz not null,
  -- set on redemption; a consumed token is dead even before it expires
  consumed_at timestamptz,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- "is there already a live token for this address?" (resend / supersede)
create index if not exists auth_tokens_open_idx
  on public.auth_tokens (email, purpose) where consumed_at is null;

alter table public.auth_tokens enable row level security;
revoke all on public.auth_tokens from anon, authenticated;
grant select, insert, update, delete on public.auth_tokens to service_role;

-- ----------------------------------------------------------------------------
-- security_limits — rate-limit counters that survive across serverless
-- instances (the chat route's in-memory Map is per warm instance only).
--
-- Callers pass an already-HMAC'd key (e.g. hmac("login:" + ip)), so raw IPs
-- and email addresses never reach the database.
-- ----------------------------------------------------------------------------
create table if not exists public.security_limits (
  key            text primary key,
  hits           integer not null,
  window_ends_at timestamptz not null
);

create index if not exists security_limits_window_idx
  on public.security_limits (window_ends_at);

alter table public.security_limits enable row level security;
revoke all on public.security_limits from anon, authenticated;
grant select, insert, update, delete on public.security_limits to service_role;

-- Take one slot from `p_key`'s window; true = allowed, false = over the limit.
--
-- Atomic by construction: a single INSERT … ON CONFLICT DO UPDATE … WHERE.
-- The conflicting row is locked and the WHERE is evaluated against its latest
-- version, so concurrent callers queue on the row and can never both take the
-- last slot (a read-then-write would let them). The UPDATE only happens while
-- hits < p_limit, or when the window has ended (reset to 1); when the WHERE is
-- false nothing is returned, which is the "denied" answer.
create or replace function public.consume_security_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taken boolean;
begin
  if p_key is null or p_key = '' then
    raise exception 'consume_security_limit: key is required'
      using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'consume_security_limit: window must be at least 1 second'
      using errcode = '22023';
  end if;
  -- a limit of 0 means "nothing allowed"; without this the INSERT branch would
  -- still hand out the first slot
  if p_limit is null or p_limit < 1 then
    return false;
  end if;

  -- Housekeeping: purge OTHER keys whose window has ended (ours is reset by the
  -- upsert instead). Bounded, and SKIP LOCKED so two callers never queue
  -- behind each other's purge or deadlock over the same expired rows.
  delete from public.security_limits
  where key in (
    select key
    from public.security_limits
    where window_ends_at <= now() and key <> p_key
    order by window_ends_at
    limit 100
    for update skip locked
  );

  insert into public.security_limits as s (key, hits, window_ends_at)
  values (p_key, 1, now() + p_window_seconds * interval '1 second')
  on conflict (key) do update
    set hits = case
                 when s.window_ends_at <= now() then 1
                 else s.hits + 1
               end,
        window_ends_at = case
                           when s.window_ends_at <= now() then excluded.window_ends_at
                           else s.window_ends_at
                         end
    where s.window_ends_at <= now() or s.hits < p_limit
  returning true into v_taken;

  return coalesce(v_taken, false);
end;
$$;

-- PostgREST exposes every public function as an RPC, and Supabase's default
-- privileges grant EXECUTE to anon/authenticated explicitly — so revoking from
-- PUBLIC alone would not be enough.
revoke execute on function public.consume_security_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_limit(text, integer, integer)
  to service_role;

-- ----------------------------------------------------------------------------
-- revoke_user_sessions — sign someone out everywhere, now.
--
-- Two halves, because they stop different things:
--   * deleting auth.sessions kills every refresh token (refresh_tokens.session_id
--     cascades), so no new access token can be minted;
--   * stamping profiles.sessions_valid_after makes is_staff() reject the access
--     tokens already issued, which GoTrue would otherwise honour until expiry.
-- Legacy refresh tokens from before GoTrue had sessions carry a NULL session_id
-- and don't cascade, so they're deleted by user_id too (user_id is varchar
-- there). That half is dynamic SQL behind a to_regclass() check so the function
-- still works where auth.refresh_tokens isn't present, and it tolerates a
-- missing privilege — the session delete above already covers every current
-- token. Service role only.
-- ----------------------------------------------------------------------------
create or replace function public.revoke_user_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;

  delete from auth.sessions where user_id = p_user;

  if to_regclass('auth.refresh_tokens') is not null then
    begin
      execute 'delete from auth.refresh_tokens where user_id = $1'
        using p_user::text;
    exception when insufficient_privilege then
      null;
    end;
  end if;

  update public.profiles
     set sessions_valid_after = now()
   where id = p_user;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- products — the studio's own products (not client work; that's `projects`).
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  tagline     text not null default '',
  summary     text not null default '',
  description text not null default '',
  features    text[] not null default '{}',
  image       text,
  -- same shape as projects.gallery: [{ "src", "caption", "kind" }]
  gallery     jsonb not null default '[]',
  -- free-text badge, e.g. "Beta", "Coming soon" — '' shows nothing
  status      text not null default '',
  cta_label   text not null default '',
  cta_url     text not null default '',
  published   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_sort_idx on public.products (sort_order, created_at);

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- jobs — open positions. Applications arrive as leads (kind 'application').
-- ----------------------------------------------------------------------------
create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  title            text not null,
  department       text not null default '',
  location         text not null default '',
  employment_type  text not null default 'full-time'
                   check (employment_type in ('full-time', 'part-time', 'contract', 'internship')),
  workplace        text not null default 'onsite'
                   check (workplace in ('onsite', 'hybrid', 'remote')),
  summary          text not null default '',
  description      text not null default '',
  responsibilities text[] not null default '{}',
  requirements     text[] not null default '{}',
  -- last day applications are accepted; null = open until unpublished
  closes_at        date,
  published        boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists jobs_sort_idx on public.jobs (sort_order, created_at);

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- posts — blog / journal. `body` is markdown, rendered on the server.
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text not null default '',
  body         text not null default '',
  cover_image  text,
  tags         text[] not null default '{}',
  author_name  text not null default '',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- the journal index sorts newest-published first
create index if not exists posts_published_at_idx on public.posts (published_at desc);

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- A post published without a date would sort wrong (Postgres puts NULLs FIRST
-- under `order by published_at desc`, so it would squat at the top forever).
-- Stamp the first publish; an explicit date from the panel always wins, and
-- unpublishing keeps the original date so a re-publish doesn't jump the queue.
create or replace function public.stamp_post_published_at()
returns trigger language plpgsql as $$
begin
  if new.published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stamp_published_at on public.posts;
create trigger posts_stamp_published_at
  before insert or update on public.posts
  for each row execute function public.stamp_post_published_at();

-- products / jobs / posts: same shape as projects — the world reads published
-- rows; staff read and write everything.
alter table public.products enable row level security;
alter table public.jobs     enable row level security;
alter table public.posts    enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (published);

drop policy if exists products_staff_read on public.products;
create policy products_staff_read on public.products
  for select using (public.is_staff());

drop policy if exists products_staff_write on public.products;
create policy products_staff_write on public.products
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists jobs_public_read on public.jobs;
create policy jobs_public_read on public.jobs
  for select using (published);

drop policy if exists jobs_staff_read on public.jobs;
create policy jobs_staff_read on public.jobs
  for select using (public.is_staff());

drop policy if exists jobs_staff_write on public.jobs;
create policy jobs_staff_write on public.jobs
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select using (published);

drop policy if exists posts_staff_read on public.posts;
create policy posts_staff_read on public.posts
  for select using (public.is_staff());

drop policy if exists posts_staff_write on public.posts;
create policy posts_staff_write on public.posts
  for all using (public.is_staff()) with check (public.is_staff());

grant select on public.products, public.jobs, public.posts to anon, authenticated;
grant insert, update, delete on public.products, public.jobs, public.posts to authenticated;
grant select, insert, update, delete on public.products, public.jobs, public.posts to service_role;

-- ----------------------------------------------------------------------------
-- leads, Phase 1 changes (here because job_id needs `jobs` to exist)
-- ----------------------------------------------------------------------------
-- HMAC of the visitor's IP (lib/security.ts) — enough to spot one source
-- spamming the inbox, useless for identifying anyone if the table leaks
alter table public.leads add column if not exists ip_hash    text;
-- set when staff answer from the panel's inbox (inbox.reply)
alter table public.leads add column if not exists replied_at timestamptz;
alter table public.leads add column if not exists replied_by uuid;
-- kind 'application': which job it was for. SET NULL so deleting a closed
-- position doesn't delete the people who applied to it. The FK is added
-- separately: some Postgres versions create the REFERENCES constraint of an
-- `ADD COLUMN IF NOT EXISTS … REFERENCES` even when the column already exists,
-- which would stack a duplicate FK on every re-run.
alter table public.leads add column if not exists job_id     uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass and conname = 'leads_job_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_job_id_fkey
      foreign key (job_id) references public.jobs (id) on delete set null;
  end if;
end;
$$;

-- an FK without an index makes every job delete scan all of leads
create index if not exists leads_job_idx on public.leads (job_id) where job_id is not null;

-- Widen the kind check to include 'application'. Looked up rather than assumed
-- by name (same as profiles_role_check), and a DO block so a re-run can't fail.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = 'public.leads'::regclass
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'kind'
  loop
    execute format('alter table public.leads drop constraint %I', c.conname);
  end loop;

  alter table public.leads
    add constraint leads_kind_check check (kind in ('contact', 'chat', 'application'));
end;
$$;

-- Drop the raw `ip` column — we keep ip_hash instead. NULL it first: DROP
-- COLUMN only hides a column, the old values stay in every tuple on disk until
-- the row is next rewritten. The UPDATE writes new tuple versions without the
-- address, and vacuum reclaims the old ones. A DO block because the column is
-- gone on every run after the first.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'ip'
  ) then
    execute 'update public.leads set ip = null where ip is not null';
    execute 'alter table public.leads drop column ip';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- content_revisions — "undo" for the CMS.
--
-- An AFTER UPDATE/DELETE trigger on every content table stores the row as it
-- was BEFORE the change (to_jsonb(OLD)). Restoring = writing a snapshot back.
--   * entity_type is the table name ('projects', 'services', 'team_members',
--     'site_settings', 'products', 'jobs', 'posts'); entity_id is the row's id
--     as text ('1' for site_settings).
--   * Updates are coalesced: one snapshot per (entity, editor) per 5 minutes,
--     so a burst of saves keeps the state from before the burst instead of 20
--     near-identical copies. Deletes always snapshot — that's the one you need.
--   * No-op saves are skipped (updated_at is ignored in the comparison, since
--     touch_updated_at moves it on every UPDATE).
--   * Only the newest 20 per entity are kept.
-- Staff can read; nobody writes except the trigger (SECURITY DEFINER).
-- ----------------------------------------------------------------------------
create table if not exists public.content_revisions (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   text not null,
  snapshot    jsonb not null,
  -- auth.uid() of whoever made the change; null for service-role writes
  actor_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists content_revisions_entity_idx
  on public.content_revisions (entity_type, entity_id, created_at desc);

create or replace function public.record_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   jsonb;
  v_id    text;
  v_actor uuid;
begin
  v_old   := to_jsonb(old);
  v_id    := v_old ->> 'id';
  v_actor := auth.uid();

  if tg_op = 'UPDATE' then
    -- nothing but updated_at / the background embed-probe verdict changed:
    -- not an edit worth a revision (see touch_updated_at)
    if (v_old - array['updated_at', 'embeddable', 'embed_reason', 'embed_checked_at'])
       = (to_jsonb(new) - array['updated_at', 'embeddable', 'embed_reason', 'embed_checked_at']) then
      return null;
    end if;

    if exists (
      select 1 from public.content_revisions
      where entity_type = tg_table_name
        and entity_id   = v_id
        and actor_id is not distinct from v_actor
        and created_at  > now() - interval '5 minutes'
    ) then
      return null;
    end if;
  end if;

  insert into public.content_revisions (entity_type, entity_id, snapshot, actor_id)
  values (tg_table_name, v_id, v_old, v_actor);

  -- keep the newest 20 for this entity (ids are monotonic, so id order is
  -- insertion order even within one transaction, where created_at ties)
  delete from public.content_revisions
  where entity_type = tg_table_name
    and entity_id   = v_id
    and id <= (
      select id from public.content_revisions
      where entity_type = tg_table_name and entity_id = v_id
      order by id desc
      offset 20 limit 1
    );

  return null;
end;
$$;

alter table public.content_revisions enable row level security;

drop policy if exists content_revisions_staff_read on public.content_revisions;
create policy content_revisions_staff_read on public.content_revisions
  for select using (public.is_staff());

revoke all on public.content_revisions from anon, authenticated;
grant select on public.content_revisions to authenticated;
grant select, insert, update, delete on public.content_revisions to service_role;

-- ----------------------------------------------------------------------------
-- activity_log — the panel's audit feed.
--
-- Content changes are logged by a trigger, so nothing can edit content without
-- leaving a line here (including someone using the anon key + their JWT
-- directly, bypassing the panel's server actions):
--   create | update | delete | publish | unpublish
-- A flip of `published` logs as publish/unpublish rather than update. Updates
-- are coalesced per (actor, entity) over 5 minutes so a busy editing session
-- is one line, not fifty. `detail.label` carries the row's name/title/slug so
-- the feed still reads after the row is deleted.
-- Everything else (team.*, auth.*, content.restore, inbox.reply, chat.*) is
-- inserted by server code with the service role. Staff read; no insert policy.
-- ----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  -- denormalised so the feed survives the person being removed later
  actor_name  text not null default '',
  action      text not null,
  entity_type text not null default '',
  entity_id   text not null default '',
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);
-- per-entity history, and the 5-minute coalescing lookup
create index if not exists activity_log_entity_idx
  on public.activity_log (entity_type, entity_id, created_at desc);

create or replace function public.log_content_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    jsonb;
  v_old    jsonb;
  v_action text;
  v_id     text;
  v_actor  uuid;
  v_name   text := '';
  v_label  text;
begin
  v_actor := auth.uid();

  if tg_op = 'INSERT' then
    v_row    := to_jsonb(new);
    v_action := 'create';
  elsif tg_op = 'DELETE' then
    v_row    := to_jsonb(old);
    v_action := 'delete';
  else
    v_row := to_jsonb(new);
    v_old := to_jsonb(old);

    -- a save that changed nothing but updated_at (or only the background
    -- embed-probe verdict) isn't activity
    if (v_old - array['updated_at', 'embeddable', 'embed_reason', 'embed_checked_at'])
       = (v_row - array['updated_at', 'embeddable', 'embed_reason', 'embed_checked_at']) then
      return null;
    end if;

    if v_row ? 'published'
       and (v_old ->> 'published')::boolean
           is distinct from (v_row ->> 'published')::boolean then
      v_action := case when (v_row ->> 'published')::boolean
                       then 'publish' else 'unpublish' end;
    else
      v_action := 'update';
    end if;
  end if;

  v_id := coalesce(v_row ->> 'id', '');

  if v_action = 'update' and exists (
    select 1 from public.activity_log
    where action      = 'update'
      and entity_type = tg_table_name
      and entity_id   = v_id
      and actor_id is not distinct from v_actor
      and created_at  > now() - interval '5 minutes'
  ) then
    return null;
  end if;

  if v_actor is not null then
    select coalesce(nullif(full_name, ''), nullif(email, ''), '')
      into v_name
      from public.profiles
     where id = v_actor;
    v_name := coalesce(v_name, '');
  end if;

  v_label := case
    when tg_table_name = 'site_settings' then 'Site settings'
    else coalesce(
      nullif(v_row ->> 'name', ''),
      nullif(v_row ->> 'title', ''),
      nullif(v_row ->> 'slug', ''),
      v_id
    )
  end;

  insert into public.activity_log
    (actor_id, actor_name, action, entity_type, entity_id, detail)
  values (
    v_actor, v_name, v_action, tg_table_name, v_id,
    jsonb_strip_nulls(jsonb_build_object('label', v_label, 'slug', v_row ->> 'slug'))
  );

  return null;
end;
$$;

alter table public.activity_log enable row level security;

drop policy if exists activity_log_staff_read on public.activity_log;
create policy activity_log_staff_read on public.activity_log
  for select using (public.is_staff());

revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;
grant select, insert, update, delete on public.activity_log to service_role;

-- ----------------------------------------------------------------------------
-- chat_sessions / chat_messages — live chat.
--
-- The visitor's browser generates the session id. Visitor and AI messages are
-- written by the chat route with the service role; staff can read everything,
-- take a session over (mode 'human', taken_over_by, admin_read_at), and reply —
-- but only as themselves (role 'human', author_id = their own uid), so the
-- panel can't be used to put words in the AI's or the visitor's mouth.
-- ----------------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id              uuid primary key,
  mode            text not null default 'ai' check (mode in ('ai', 'human')),
  ip_hash         text,
  taken_over_by   uuid,
  admin_read_at   timestamptz,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists chat_sessions_last_message_idx
  on public.chat_sessions (last_message_at desc);

-- Phase 4 — human takeover.
--   visitor_key_hash  sha256 (hex) of a random key the visitor's browser holds
--                     next to the session id. The chat routes require the key on
--                     every request, so a session id seen in a log or a
--                     screenshot is not enough to read or post into the
--                     conversation. Only the hash is stored.
--   wants_human_at    the visitor pressed "Talk to a person" (the console lists
--                     these first). Cleared when staff hand the chat back.
--   taken_over_at     when the current person took it over.
--   last_visitor_at   newest VISITOR message — unread means newer than
--                     admin_read_at (last_message_at also moves on staff and AI
--                     messages, so it can't answer that).
--   opening / last_preview / last_role / message_count
--                     denormalised for the console list, so it is one query.
-- The last five are kept by the touch_chat_session trigger below — no writer
-- has to remember them.
alter table public.chat_sessions add column if not exists visitor_key_hash text;
alter table public.chat_sessions add column if not exists wants_human_at   timestamptz;
alter table public.chat_sessions add column if not exists taken_over_at    timestamptz;
alter table public.chat_sessions add column if not exists last_visitor_at  timestamptz;
alter table public.chat_sessions add column if not exists opening          text;
alter table public.chat_sessions add column if not exists last_preview     text;
alter table public.chat_sessions add column if not exists last_role        text;
alter table public.chat_sessions add column if not exists message_count    integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chat_sessions'::regclass
      and conname = 'chat_sessions_visitor_key_hash_check'
  ) then
    alter table public.chat_sessions
      add constraint chat_sessions_visitor_key_hash_check
      check (visitor_key_hash is null or visitor_key_hash ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

-- the console's "needs a person" set and the nav badge: small, so a partial index
create index if not exists chat_sessions_attention_idx
  on public.chat_sessions (last_message_at desc)
  where mode = 'human' or wants_human_at is not null;

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role       text not null check (role in ('visitor', 'ai', 'human')),
  content    text not null,
  -- the staff member, for role 'human'; null otherwise
  author_id  uuid,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, id);

-- Keep chat_sessions.last_message_at honest whoever writes the message —
-- including a staff reply inserted straight through RLS, which has no reason
-- to also remember to touch the session. The console sorts on this column,
-- decides "unread" from last_visitor_at, and lists opening / last_preview.
create or replace function public.touch_chat_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_sessions
     set last_message_at = greatest(last_message_at, new.created_at),
         last_visitor_at = case
           when new.role = 'visitor'
             then greatest(coalesce(last_visitor_at, new.created_at), new.created_at)
           else last_visitor_at
         end,
         opening = coalesce(
           opening,
           case when new.role = 'visitor' then left(new.content, 200) end
         ),
         last_preview  = left(new.content, 200),
         last_role     = new.role,
         message_count = message_count + 1
   where id = new.session_id;
  return null;
end;
$$;

drop trigger if exists chat_messages_touch_session on public.chat_messages;
create trigger chat_messages_touch_session
  after insert on public.chat_messages
  for each row execute function public.touch_chat_session();

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_sessions_staff_read on public.chat_sessions;
create policy chat_sessions_staff_read on public.chat_sessions
  for select using (public.is_staff());

drop policy if exists chat_sessions_staff_update on public.chat_sessions;
create policy chat_sessions_staff_update on public.chat_sessions
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists chat_messages_staff_read on public.chat_messages;
create policy chat_messages_staff_read on public.chat_messages
  for select using (public.is_staff());

drop policy if exists chat_messages_staff_reply on public.chat_messages;
create policy chat_messages_staff_reply on public.chat_messages
  for insert with check (
    public.is_staff() and role = 'human' and author_id = auth.uid()
  );

-- Staff may change only the takeover / read-state columns. In particular not
-- visitor_key_hash: setting it to a known value would let a panel account post
-- through the public chat route AS the visitor. Column-level, so the RLS
-- policy above still decides which rows. (REVOKE ALL also drops column grants,
-- so this pair is safe to re-run.)
revoke all on public.chat_sessions, public.chat_messages from anon, authenticated;
grant select on public.chat_sessions to authenticated;
grant update (mode, taken_over_by, taken_over_at, admin_read_at, wants_human_at)
  on public.chat_sessions to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_sessions, public.chat_messages to service_role;

-- ----------------------------------------------------------------------------
-- lead_replies — answers sent from /admin/inbox (Phase 4).
--
-- One row per attempt, sent or not: Resend's sandbox only delivers to the
-- account owner, so a reply can fail for reasons the panel must show plainly,
-- and the record must never claim an email went out when it didn't
-- (status 'failed', sent_at null, `error` says why).
-- Written ONLY by server code with the service role, after the send — so a
-- staff session can't insert a "sent" row for an email that never left. Staff
-- read; nobody else sees it. Deleting the lead deletes its replies.
-- ----------------------------------------------------------------------------
create table if not exists public.lead_replies (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  author_id   uuid,
  -- denormalised so the history still reads after the person is removed
  author_name text not null default '',
  to_email    text not null,
  subject     text not null,
  body        text not null,
  status      text not null check (status in ('sent', 'failed')),
  -- Resend's message id when sent
  provider_id text,
  -- why it wasn't sent ('' when it was)
  error       text not null default '',
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists lead_replies_lead_idx on public.lead_replies (lead_id, created_at);

alter table public.lead_replies enable row level security;

drop policy if exists lead_replies_staff_read on public.lead_replies;
create policy lead_replies_staff_read on public.lead_replies
  for select using (public.is_staff());

revoke all on public.lead_replies from anon, authenticated;
grant select on public.lead_replies to authenticated;
grant select, insert, update, delete on public.lead_replies to service_role;

-- ----------------------------------------------------------------------------
-- status_reports — the latest CI results, one row per kind, upserted by CI
-- through a service-role route. Public on purpose: the site's status page
-- shows them, and they contain nothing that isn't already in the repo.
-- ----------------------------------------------------------------------------
create table if not exists public.status_reports (
  kind        text primary key check (kind in ('tests', 'lighthouse')),
  payload     jsonb not null,
  commit_sha  text not null default '',
  received_at timestamptz not null default now()
);

alter table public.status_reports enable row level security;

drop policy if exists status_reports_public_read on public.status_reports;
create policy status_reports_public_read on public.status_reports
  for select using (true);

revoke all on public.status_reports from anon, authenticated;
grant select on public.status_reports to anon, authenticated;
grant select, insert, update, delete on public.status_reports to service_role;

-- ----------------------------------------------------------------------------
-- site_revision — one row whose counter moves whenever any content changes.
--
-- Phase 2 subscribes to this single row over Realtime instead of to every
-- content table: one channel, no row data (so no RLS questions about what a
-- visitor may receive), and "something changed → refetch" is all the site
-- needs. Bumped by a STATEMENT-level trigger, so a 40-row reorder is one bump.
-- ----------------------------------------------------------------------------
create table if not exists public.site_revision (
  id         integer primary key default 1 check (id = 1),
  rev        bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.site_revision (id) values (1) on conflict (id) do nothing;

-- SECURITY DEFINER: the staff member whose edit fires this has no write
-- privilege on site_revision, and shouldn't.
create or replace function public.bump_site_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.site_revision
     set rev = rev + 1, updated_at = now()
   where id = 1;
  return null;
end;
$$;

alter table public.site_revision enable row level security;

drop policy if exists site_revision_public_read on public.site_revision;
create policy site_revision_public_read on public.site_revision
  for select using (true);

revoke all on public.site_revision from anon, authenticated;
grant select on public.site_revision to anon, authenticated;
grant select, insert, update, delete on public.site_revision to service_role;

-- Realtime only broadcasts tables in the supabase_realtime publication. Checked
-- first because ADD TABLE errors if the table is already a member (and on a
-- FOR ALL TABLES publication, which lists every table here anyway); skipped
-- entirely where the publication doesn't exist (self-hosted without Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'site_revision'
     ) then
    execute 'alter publication supabase_realtime add table public.site_revision';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Wire the three content triggers onto every content table. One loop so a
-- table can't end up with revisions but no activity line, or vice versa.
-- AFTER triggers, so they see the final row (after touch_updated_at) and only
-- run once the write has passed RLS and every constraint.
--   <table>_content_revision  row-level       → content_revisions
--   <table>_activity_log      row-level       → activity_log
--   <table>_site_revision     statement-level → site_revision.rev
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'services', 'team_members', 'site_settings',
    'products', 'jobs', 'posts'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_content_revision', t);
    execute format(
      'create trigger %I after update or delete on public.%I
         for each row execute function public.record_content_revision()',
      t || '_content_revision', t);

    execute format('drop trigger if exists %I on public.%I', t || '_activity_log', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.log_content_activity()',
      t || '_activity_log', t);

    execute format('drop trigger if exists %I on public.%I', t || '_site_revision', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each statement execute function public.bump_site_revision()',
      t || '_site_revision', t);
  end loop;
end;
$$;
