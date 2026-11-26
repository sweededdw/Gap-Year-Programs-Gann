-- 0004: student-created groups (a BBYO chapter, a school club, friends heading to Israel) with safety rules.
-- Run once in Supabase → SQL Editor after 0003 (safe to run again).
--
-- Safety, enforced here and not just in the page:
--   * Every new group is private to its creator until an admin approves it.
--   * Hateful wording is refused in group names, descriptions and profile names: racism, antisemitism,
--     xenophobia, homophobia and calls for violence (blocked_terms, checked with common letter swaps
--     like 0 for o). Admins can add terms in the table editor.
--   * No links in groups. At most 3 groups per student.
--   * Anyone can report a group or a profile. A group reported by 3 different students is hidden at once
--     ("review") until an admin decides. Only admins see reports.
--   * Only admins can approve, reject or re-show a group. Creators can delete their own group.

create table if not exists public.blocked_terms (
  term       text primary key check (term = lower(term) and char_length(term) between 2 and 60),
  whole_word boolean not null default true  -- false = also match inside other words and across spaces
);
alter table public.blocked_terms enable row level security;
drop policy if exists "Admins manage blocked terms" on public.blocked_terms;
create policy "Admins manage blocked terms" on public.blocked_terms for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.blocked_terms from anon, authenticated;
grant select, insert, update, delete on public.blocked_terms to authenticated;

-- Slurs and hate phrases (stored so they can be refused, never shown on the site).
insert into public.blocked_terms (term, whole_word) values
  ('nigg', false), ('hitler', false), ('heilhitler', false), ('siegheil', false), ('whitepower', false), ('kkk', false),
  ('nazi', true), ('nazis', true), ('neonazi', true), ('neo nazi', true), ('heil', true), ('white power', true), ('white pride', true),
  ('white genocide', true), ('great replacement', true), ('race war', true), ('racewar', true), ('zog', true), ('untermensch', true), ('subhuman', true),
  ('gas the', true), ('kill all', true), ('death to', true), ('go back to your country', true), ('deport them all', true),
  ('jews out', true), ('arabs out', true), ('muslims out', true), ('dirty jew', true), ('dirty arab', true), ('christ killer', true), ('christ killers', true),
  ('kike', true), ('kikes', true), ('hymie', true), ('spic', true), ('spics', true), ('wetback', true), ('wetbacks', true), ('beaner', true), ('beaners', true),
  ('chink', true), ('chinks', true), ('gook', true), ('gooks', true), ('raghead', true), ('ragheads', true), ('towelhead', true), ('towelheads', true),
  ('camel jockey', true), ('paki', true), ('pakis', true), ('coon', true), ('coons', true), ('jigaboo', true), ('porch monkey', true), ('darkie', true), ('darkies', true),
  ('faggot', true), ('faggots', true), ('fag', true), ('fags', true), ('tranny', true), ('trannies', true), ('retard', true), ('retards', true)
on conflict (term) do nothing;

-- true when the text contains none of the blocked terms (after undoing letter swaps like 0→o, 1→i, $→s).
create or replace function public.clean_text_ok(t text) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare n text; squashed text; r record;
begin
  if t is null or t = '' then return true; end if;
  if t ~ '14\s*[/\\.-]?\s*88' then return false; end if;
  n := lower(translate(t, '013457@$!|', 'oieastasii'));
  n := btrim(regexp_replace(n, '[^a-z]+', ' ', 'g'));
  n := regexp_replace(n, '\m([a-z]) (?=[a-z]\M)', '\1', 'g');  -- "n a z i" -> "nazi"
  n := ' ' || n || ' ';
  squashed := replace(n, ' ', '');
  for r in select term, whole_word from public.blocked_terms loop
    if r.whole_word then
      if position(' ' || r.term || ' ' in n) > 0 then return false; end if;
    elsif position(replace(r.term, ' ', '') in squashed) > 0 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.clean_text_ok(text) from public, anon;
grant execute on function public.clean_text_ok(text) to authenticated;

create table if not exists public.student_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 3 and 60 and name !~* '(https?://|www\.|\.com\b)'),
  description text check (char_length(description) <= 300 and description !~* '(https?://|www\.|\.com\b)'),
  kind        text not null default 'other' check (kind in ('chapter', 'school', 'friends', 'other')),
  parent_org  text check (parent_org ~ '^[a-z0-9-]{1,40}$'),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'review')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create table if not exists public.community_reports (
  id          bigint generated always as identity primary key,
  target_type text not null check (target_type in ('group', 'profile')),
  target_id   text not null check (char_length(target_id) <= 60),
  reporter    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text check (char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false,
  unique (target_type, target_id, reporter)
);

-- Refuse hateful wording in groups and profiles.
create or replace function public.community_clean_check() returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_table_name = 'student_groups' then
    if not (public.clean_text_ok(new.name) and public.clean_text_ok(new.description)) then
      raise exception 'That wording isn''t allowed here.' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'profiles' then
    if not (public.clean_text_ok(new.display_name) and public.clean_text_ok(new.school)) then
      raise exception 'That wording isn''t allowed here.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists student_groups_clean on public.student_groups;
create trigger student_groups_clean before insert or update on public.student_groups for each row execute function public.community_clean_check();
drop trigger if exists profiles_clean on public.profiles;
create trigger profiles_clean before insert or update on public.profiles for each row execute function public.community_clean_check();

-- At most 3 groups per student (rejected ones don't count).
create or replace function public.student_groups_limit() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.student_groups where created_by = new.created_by and status <> 'rejected') >= 3 then
    raise exception 'You can create up to 3 groups.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists student_groups_limit on public.student_groups;
create trigger student_groups_limit before insert on public.student_groups for each row execute function public.student_groups_limit();

-- A deleted group takes its memberships with it.
create or replace function public.student_groups_cleanup() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.org_members where org_id = 'g-' || old.id::text;
  delete from public.community_reports where target_type = 'group' and target_id = old.id::text;
  return old;
end $$;
drop trigger if exists student_groups_cleanup on public.student_groups;
create trigger student_groups_cleanup after delete on public.student_groups for each row execute function public.student_groups_cleanup();

-- You can only join a student group that's approved (or your own, while it waits for review).
create or replace function public.org_members_group_check() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.org_id like 'g-%' and not exists (
    select 1 from public.student_groups g
    where 'g-' || g.id::text = new.org_id and (g.status = 'approved' or g.created_by = new.user_id)
  ) then
    raise exception 'That group isn''t open to join.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists org_members_group_check on public.org_members;
create trigger org_members_group_check before insert on public.org_members for each row execute function public.org_members_group_check();

-- 3 reports from different students hide a group until an admin looks.
create or replace function public.community_reports_act() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.target_type = 'group' and (
    select count(distinct reporter) from public.community_reports
    where target_type = 'group' and target_id = new.target_id and not resolved
  ) >= 3 then
    update public.student_groups set status = 'review' where id::text = new.target_id and status = 'approved';
  end if;
  return new;
end $$;
drop trigger if exists community_reports_act on public.community_reports;
create trigger community_reports_act after insert on public.community_reports for each row execute function public.community_reports_act();

alter table public.student_groups enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "See approved or own groups" on public.student_groups;
drop policy if exists "Create groups for review" on public.student_groups;
drop policy if exists "Admins review groups" on public.student_groups;
drop policy if exists "Delete own groups" on public.student_groups;
create policy "See approved or own groups" on public.student_groups for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_admin()));
create policy "Create groups for review" on public.student_groups for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending');
create policy "Admins review groups" on public.student_groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Delete own groups" on public.student_groups for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Report things" on public.community_reports;
drop policy if exists "Admins read reports" on public.community_reports;
drop policy if exists "Admins resolve reports" on public.community_reports;
create policy "Report things" on public.community_reports for insert to authenticated with check (reporter = (select auth.uid()));
create policy "Admins read reports" on public.community_reports for select to authenticated using ((select public.is_admin()));
create policy "Admins resolve reports" on public.community_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Students can only fill in the group's own fields; status and review fields are admin-only.
revoke all on public.student_groups, public.community_reports from anon, authenticated;
grant select, delete on public.student_groups to authenticated;
grant insert (name, description, kind, parent_org) on public.student_groups to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.student_groups to authenticated;
grant insert (target_type, target_id, reason) on public.community_reports to authenticated;
grant select, update (resolved) on public.community_reports to authenticated;
