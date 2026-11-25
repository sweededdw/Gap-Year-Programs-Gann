-- 0002: admin editing of program and college data, edit history, and a log of errors students hit.
-- Run once in Supabase → SQL Editor (safe to run again).
--
-- How the data works: the site ships with its built-in data (public/js/*.js). A row in `programs` or
-- `colleges` is an edit made on the site's admin page (#/admin); it replaces the built-in entry with the
-- same id, or adds a new one. Deleting the row goes back to the built-in version.

-- Admins: people allowed to edit program and college data. Add yourself with the snippet in supabase/README.md.
create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "Read own admin row" on public.admins;
create policy "Read own admin row" on public.admins for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Programs and colleges. `data` holds the same object the site uses; verified_at = last time someone checked it against the source.
create table if not exists public.programs (
  id          text primary key,
  data        jsonb not null,
  verified_at date,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  constraint programs_data_size check (pg_column_size(data) < 200000)
);
create table if not exists public.colleges (
  id          text primary key,
  kind        text not null default 'policy' check (kind in ('policy', 'not_found')),
  data        jsonb not null,
  verified_at date,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  constraint colleges_data_size check (pg_column_size(data) < 50000)
);

-- Every change to a program or college is copied here first, so a bad edit can always be undone.
create table if not exists public.content_history (
  id         bigint generated always as identity primary key,
  table_name text not null,
  item_id    text not null,
  data       jsonb,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

create or replace function public.content_touch() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.content_history (table_name, item_id, data, changed_by) values (tg_table_name, old.id, old.data, auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists programs_touch on public.programs;
create trigger programs_touch before insert or update or delete on public.programs for each row execute function public.content_touch();
drop trigger if exists colleges_touch on public.colleges;
create trigger colleges_touch before insert or update or delete on public.colleges for each row execute function public.content_touch();

alter table public.programs enable row level security;
alter table public.colleges enable row level security;
alter table public.content_history enable row level security;

-- Logged-in students can read the data; only admins can change it.
drop policy if exists "Read programs" on public.programs;
drop policy if exists "Admins write programs" on public.programs;
create policy "Read programs" on public.programs for select to authenticated using (true);
create policy "Admins write programs" on public.programs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Read colleges" on public.colleges;
drop policy if exists "Admins write colleges" on public.colleges;
create policy "Read colleges" on public.colleges for select to authenticated using (true);
create policy "Admins write colleges" on public.colleges for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins read history" on public.content_history;
create policy "Admins read history" on public.content_history for select to authenticated using ((select public.is_admin()));

-- Supabase gives new tables broad default grants; reset them and grant only what the policies above use.
revoke all on public.programs, public.colleges, public.content_history from anon, authenticated;
grant select, insert, update, delete on public.programs, public.colleges to authenticated;
grant select on public.content_history to authenticated;

-- Errors students hit in the browser, so problems show up before anyone has to report them.
create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users (id) on delete cascade,
  page       text check (char_length(page) <= 300),
  message    text check (char_length(message) <= 2000),
  user_agent text check (char_length(user_agent) <= 300)
);
alter table public.client_errors enable row level security;
drop policy if exists "Log own errors" on public.client_errors;
drop policy if exists "Admins read errors" on public.client_errors;
create policy "Log own errors" on public.client_errors for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Admins read errors" on public.client_errors for select to authenticated using ((select public.is_admin()));
revoke all on public.client_errors from anon, authenticated;
grant insert, select on public.client_errors to authenticated;
