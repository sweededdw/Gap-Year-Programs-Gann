-- 0001: per-student tracker table (same as supabase/schema.sql). Safe to run again.
-- Safe to run again. Accounts themselves live in Supabase Auth (auth.users);
-- this table only stores each user's tracker progress (saved programs, statuses, notes, colleges).

create table if not exists public.gap_year_trackers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint gap_year_trackers_state_size check (pg_column_size(state) < 500000)
);

-- Row Level Security: every user can see and change ONLY their own row.
alter table public.gap_year_trackers enable row level security;

drop policy if exists "Read own tracker"   on public.gap_year_trackers;
drop policy if exists "Insert own tracker" on public.gap_year_trackers;
drop policy if exists "Update own tracker" on public.gap_year_trackers;

create policy "Read own tracker" on public.gap_year_trackers
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Insert own tracker" on public.gap_year_trackers
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Update own tracker" on public.gap_year_trackers
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Logged-in users need table access (RLS above still limits them to their own row).
grant select, insert, update on public.gap_year_trackers to authenticated;
revoke all on public.gap_year_trackers from anon;
