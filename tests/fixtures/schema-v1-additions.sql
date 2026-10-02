-- The tables the pre-Phase-1 working copy of supabase/schema.sql added on top
-- of schema-v0.sql (the committed version), in the exact shapes Phase 1 has to
-- migrate: invitations with an 'editor' role, leads with a raw `ip` column and
-- a two-value kind check. Applied after v0 to model a live database that ran
-- the chatbot + invite passes but not Phase 1.

create table if not exists public.invitations (
  email        text primary key check (email = lower(email)),
  role         text not null default 'admin' check (role in ('admin', 'editor')),
  full_name    text,
  invited_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  accepted_at  timestamptz
);

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  blurb        text not null default '',
  detail       text not null default '',
  deliverables text[] not null default '{}',
  icon         text not null default 'web',
  published    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null default '',
  initials   text not null default '',
  published  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('contact', 'chat')),
  name       text,
  email      text,
  service    text,
  message    text,
  transcript jsonb,
  turns      integer,
  ip         text,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.invitations  enable row level security;
alter table public.services     enable row level security;
alter table public.team_members enable row level security;
alter table public.leads        enable row level security;

-- the policy names the old file used, so the new file's DROP … IF EXISTS
-- has something real to replace
create policy invitations_admin_read on public.invitations for select using (public.is_admin());
create policy leads_staff_read on public.leads for select using (public.is_staff());
