-- Italiano ogni giorno: cloud sync schema (version 2).
-- Run this once in YOUR Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again: nothing is dropped or emptied.
--
-- One set of tables, one row per thing (a card, a day, a log line...), every row owned by one user and
-- locked down with row level security, so a project can hold one learner or many without any change.
-- Lessons are NOT stored here; they live in the app. Rows refer to lessons by their permanent ids.
--
-- Upgrading from the old single-JSON table (italiano_progress)? Just run this file. The first time the app syncs it copies
-- your old data into these tables and leaves the old table untouched.

-- ---------------------------------------------------------------- tables
-- Every synced row carries two times:
--   client_updated_at  set by the app when the learner changed it (decides which edit wins)
--   updated_at         set by the server on every write (lets a device ask "what changed since I last looked")

create table if not exists public.italiano_profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  schema_version    int  not null default 2,
  timezone          text check (char_length(timezone) <= 64),
  prefs             jsonb not null default '{}'::jsonb check (octet_length(prefs::text) < 20000),   -- study preferences that follow the learner
  created_at        timestamptz not null default now(),
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.italiano_card_states (
  user_id           uuid not null references auth.users (id) on delete cascade,
  card_id           text not null check (char_length(card_id) between 1 and 200),   -- lesson item id, or a log line id
  box               smallint not null default 0 check (box between 0 and 7),
  due               date not null,
  reps              int  not null default 0 check (reps >= 0),
  lapses            int  not null default 0 check (lapses >= 0),
  last_reviewed     date,
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.italiano_daily (
  user_id           uuid not null references auth.users (id) on delete cascade,
  day               date not null,
  blocks            text[] not null default '{}' check (cardinality(blocks) <= 50),   -- ids of the Today blocks ticked that day
  reviewed          int not null default 0 check (reviewed >= 0),
  new_seen          int not null default 0 check (new_seen >= 0),
  drills            int not null default 0 check (drills >= 0),
  retells           int not null default 0 check (retells >= 0),
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.italiano_log_entries (
  user_id           uuid not null references auth.users (id) on delete cascade,
  id                text not null check (char_length(id) between 1 and 100),   -- made by the app, so it works offline
  italian           text not null check (char_length(italian) between 1 and 1000),
  english           text not null check (char_length(english) between 1 and 1000),
  situation         text check (char_length(situation) <= 40),
  kind              text check (kind in ('wanted', 'heard', 'corrected')),
  note              text check (char_length(note) <= 2000),
  grammar_tag       text check (char_length(grammar_tag) <= 200),
  source            text not null default 'manual' check (source in ('manual', 'translate')),
  provider          text check (char_length(provider) <= 40),
  checked           boolean not null default false,
  created_on        date not null default current_date,
  deleted_at        timestamptz,                                -- deleted lines stay as markers so every device learns of the delete
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.italiano_scenario_ratings (
  user_id           uuid not null references auth.users (id) on delete cascade,
  scenario_id       text not null check (char_length(scenario_id) between 1 and 200),
  stars             smallint not null check (stars between 1 and 3),   -- 1 Rough, 2 OK, 3 Smooth
  rated_on          date not null default current_date,
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, scenario_id)
);

create table if not exists public.italiano_drill_stats (
  user_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null check (char_length(kind) between 1 and 60),
  sessions          int not null default 0 check (sessions >= 0),
  correct           int not null default 0 check (correct >= 0),
  total             int not null default 0 check (total >= 0),
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, kind)
);

-- ---------------------------------------------------------------- indexes
-- The primary keys already start with user_id, which is what row level security filters on.
create index if not exists italiano_profiles_sync      on public.italiano_profiles       (user_id, updated_at);
create index if not exists italiano_card_states_sync   on public.italiano_card_states    (user_id, updated_at);
create index if not exists italiano_card_states_due    on public.italiano_card_states    (user_id, due);
create index if not exists italiano_daily_sync         on public.italiano_daily          (user_id, updated_at);
create index if not exists italiano_log_entries_sync   on public.italiano_log_entries    (user_id, updated_at);
create index if not exists italiano_log_entries_list   on public.italiano_log_entries    (user_id, created_on desc) where deleted_at is null;
create index if not exists italiano_scenario_ratings_sync on public.italiano_scenario_ratings (user_id, updated_at);
create index if not exists italiano_drill_stats_sync   on public.italiano_drill_stats    (user_id, updated_at);

-- ---------------------------------------------------------------- the "older edit loses" rule
-- A device that was offline may upload an edit that is older than what the cloud already has.
-- The database quietly ignores it, so the app can send changes without worrying about order,
-- and sending the same change twice does no harm. Also stamps updated_at with the server's time.
create or replace function public.italiano_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return null;                       -- skip this write: the stored row is newer
  end if;
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['italiano_profiles', 'italiano_card_states', 'italiano_daily', 'italiano_log_entries', 'italiano_scenario_ratings', 'italiano_drill_stats'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.italiano_guard()', t || '_guard', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- security
-- New tables are not exposed to the Data API automatically, so access is granted explicitly,
-- to signed-in users only. The anonymous role gets nothing. Every policy is the same template:
-- you can see and change only rows whose user_id is you.
do $$
declare t text;
begin
  foreach t in array array['italiano_profiles', 'italiano_card_states', 'italiano_daily', 'italiano_log_entries', 'italiano_scenario_ratings', 'italiano_drill_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', 'own rows: select', t);
    execute format('drop policy if exists %I on public.%I', 'own rows: insert', t);
    execute format('drop policy if exists %I on public.%I', 'own rows: update', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', 'own rows: select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', 'own rows: insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', 'own rows: update', t);
  end loop;
end $$;

-- Deleted log lines are only markers; allow clearing old markers (and nothing else) with a real delete.
grant delete on public.italiano_log_entries to authenticated;
drop policy if exists "own rows: delete markers" on public.italiano_log_entries;
create policy "own rows: delete markers" on public.italiano_log_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id and deleted_at is not null);

-- ---------------------------------------------------------------- helpers for the app
create or replace function public.italiano_schema_version()
returns int
language sql
stable
set search_path = ''
as $$ select 2 $$;
revoke all on function public.italiano_schema_version() from public, anon;
grant execute on function public.italiano_schema_version() to authenticated;

-- Remove delete markers older than a year (default). Run by hand now and then; only touches your own rows.
create or replace function public.italiano_purge_deleted(older_than_days int default 365)
returns int
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.italiano_log_entries
    where user_id = (select auth.uid()) and deleted_at is not null and deleted_at < now() - make_interval(days => older_than_days)
    returning 1)
  select count(*)::int from gone
$$;
revoke all on function public.italiano_purge_deleted(int) from public, anon;
grant execute on function public.italiano_purge_deleted(int) to authenticated;
