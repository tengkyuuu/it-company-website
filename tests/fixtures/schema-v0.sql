-- ============================================================================
-- mykTech() website — Supabase schema
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query
-- → paste → Run). It is idempotent, so re-running it is safe.
--
-- What it creates:
--   profiles       one row per auth user, carrying their role
--   projects       the portfolio entries shown on /projects
--   site_settings  single-row table for the editable site copy
--   work bucket    public storage for uploaded screenshots
--
-- Roles: owner > admin > editor
--   editor  can create/edit/publish projects and edit settings
--   admin   can additionally invite and remove teammates
--   owner   same as admin, but cannot be removed by an admin
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'editor'
             check (role in ('owner', 'admin', 'editor')),
  created_at timestamptz not null default now()
);

-- Mirror new auth users into profiles. The very first user becomes the owner so
-- there is always someone who can invite the rest.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  if (select count(*) from public.profiles) = 0 then
    assigned_role := 'owner';
  else
    -- an invite can carry a role: inviteUserByEmail(email, { data: { role } })
    assigned_role := coalesce(new.raw_user_meta_data ->> 'role', 'editor');
    if assigned_role not in ('owner', 'admin', 'editor') then
      assigned_role := 'editor';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    assigned_role
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
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

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

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
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
  brand_name     text not null default 'mykTech()',
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
grant usage on schema public to anon, authenticated;
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

-- profiles: staff can see the team; you can edit yourself; admins manage roles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

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
-- Storage: screenshots uploaded from the admin land in a public "work" bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('work', 'work', true)
on conflict (id) do update set public = true;

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
