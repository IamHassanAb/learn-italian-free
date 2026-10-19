-- LEGACY (version 1): the old single-JSON sync table. New projects should use supabase/schema.sql instead.
-- Kept so anyone who already ran it can see what it created. The app imports its data once, then ignores it.
-- Optional cross-device sync for the Italiano ogni giorno app.
-- Run this once in YOUR Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It creates one table with one row per signed-in user (their study progress as JSON),
-- locked down so each user can only read and write their own row.

create table if not exists public.italiano_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint italiano_progress_size check (octet_length(data::text) < 1000000)
);

alter table public.italiano_progress enable row level security;

-- New tables are not exposed to the Data API automatically, so grant access explicitly,
-- to signed-in users only. The anonymous role gets nothing.
revoke all on public.italiano_progress from anon;
grant select, insert, update on public.italiano_progress to authenticated;

-- Row level security: each user sees and changes only their own row.
-- (UPDATE needs both a SELECT policy and USING + WITH CHECK, or it silently changes nothing.)
create policy "progress: read own" on public.italiano_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "progress: insert own" on public.italiano_progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "progress: update own" on public.italiano_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep updated_at honest.
create or replace function public.italiano_progress_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger italiano_progress_touch
  before update on public.italiano_progress
  for each row execute function public.italiano_progress_touch();
