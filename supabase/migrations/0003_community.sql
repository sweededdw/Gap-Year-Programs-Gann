-- 0003: community. Opt-in student profiles, the organizations students belong to (BBYO, NCSY, ...),
-- and the gap year programs they're interested in. Run once in Supabase → SQL Editor (safe to run again).
--
-- Privacy rules (enforced here, not just in the page):
--   * A profile is private until its owner turns on `visible`. Private profiles, and the groups and
--     interests of private profiles, can only be seen by their owner.
--   * Only logged-in students can see anything; logged-out visitors (anon) see nothing.
--   * Admins can hide a profile from everyone (community_bans). A student can't undo that by
--     deleting and re-making their profile, because the ban is stored separately.
--   * Deleting an account deletes all of it (on delete cascade).

create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40 and display_name !~* '(https?://|www\.)'),
  school       text check (char_length(school) <= 80 and school !~* '(https?://|www\.)'),
  grad_year    int check (grad_year between 2024 and 2035),
  visible      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.community_bans (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  banned_at timestamptz not null default now(),
  banned_by uuid default auth.uid()
);

create table if not exists public.org_members (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  org_id     text not null check (org_id ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create table if not exists public.program_interest (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id text not null check (program_id ~ '^[a-z0-9-]{1,60}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

-- Is this student's profile shown to other students? (visible, and not hidden by an admin)
create or replace function public.profile_shown(uid uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.user_id = uid and p.visible)
     and not exists (select 1 from public.community_bans b where b.user_id = uid)
$$;
revoke all on function public.profile_shown(uuid) from public, anon;
grant execute on function public.profile_shown(uuid) to authenticated;

-- Keep updated_at current on profile edits.
create or replace function public.profiles_touch() returns trigger
language plpgsql set search_path = public
as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.profiles_touch();

-- At most 30 groups and 30 interests per student, so nobody can flood the lists.
create or replace function public.community_row_limit() returns trigger
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= 30 then raise exception 'You can add up to 30 here.' using errcode = 'check_violation'; end if;
  return new;
end $$;
drop trigger if exists org_members_limit on public.org_members;
create trigger org_members_limit before insert on public.org_members for each row execute function public.community_row_limit();
drop trigger if exists program_interest_limit on public.program_interest;
create trigger program_interest_limit before insert on public.program_interest for each row execute function public.community_row_limit();

alter table public.profiles enable row level security;
alter table public.community_bans enable row level security;
alter table public.org_members enable row level security;
alter table public.program_interest enable row level security;

drop policy if exists "See own or shown profiles" on public.profiles;
drop policy if exists "Make own profile" on public.profiles;
drop policy if exists "Edit own profile" on public.profiles;
drop policy if exists "Delete own profile" on public.profiles;
create policy "See own or shown profiles" on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or public.profile_shown(user_id)
  or ((select public.is_admin()) and exists (select 1 from public.community_bans b where b.user_id = profiles.user_id))
);
create policy "Make own profile" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Edit own profile" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own profile" on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Admins manage bans" on public.community_bans;
create policy "Admins manage bans" on public.community_bans for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "See own or shown groups" on public.org_members;
drop policy if exists "Join groups" on public.org_members;
drop policy if exists "Leave groups" on public.org_members;
create policy "See own or shown groups" on public.org_members for select to authenticated using (user_id = (select auth.uid()) or public.profile_shown(user_id));
create policy "Join groups" on public.org_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Leave groups" on public.org_members for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "See own or shown interests" on public.program_interest;
drop policy if exists "Add interests" on public.program_interest;
drop policy if exists "Remove interests" on public.program_interest;
create policy "See own or shown interests" on public.program_interest for select to authenticated using (user_id = (select auth.uid()) or public.profile_shown(user_id));
create policy "Add interests" on public.program_interest for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Remove interests" on public.program_interest for delete to authenticated using (user_id = (select auth.uid()));

-- Reset Supabase's broad default grants and give only what the policies use. Profiles can only change
-- these columns, so nobody can move a profile to another account.
revoke all on public.profiles, public.community_bans, public.org_members, public.program_interest from anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant insert (user_id, display_name, school, grad_year, visible) on public.profiles to authenticated;
grant update (display_name, school, grad_year, visible) on public.profiles to authenticated;
grant select, insert, delete on public.community_bans, public.org_members, public.program_interest to authenticated;
