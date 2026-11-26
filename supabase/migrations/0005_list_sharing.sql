-- 0005: "interested" now means "on my list". A student chooses whether the programs on their list are
-- shared with other students (profiles.share_list, off by default). Run after 0004 (safe to run again).
--
--   * program_interest mirrors the saved list, and only for students who share it: the database refuses
--     rows from anyone who hasn't turned sharing on, and turning it off deletes their rows straight away.
--   * As before, other students only see shared lists of profiles that are visible (0003's rules).
--   * Lists can hold up to 60 programs (groups stay at 30).

alter table public.profiles add column if not exists share_list boolean not null default false;
grant insert (share_list) on public.profiles to authenticated;
grant update (share_list) on public.profiles to authenticated;

create or replace function public.community_row_limit() returns trigger
language plpgsql security definer set search_path = public
as $$
declare n int; cap int := case when tg_table_name = 'program_interest' then 60 else 30 end;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= cap then raise exception 'You can add up to % here.', cap using errcode = 'check_violation'; end if;
  return new;
end $$;

drop policy if exists "Add interests" on public.program_interest;
create policy "Add interests" on public.program_interest for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.share_list)
);

-- Turning sharing off (or deleting the profile) removes the shared list.
create or replace function public.profiles_unshare() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.program_interest where user_id = old.user_id;
    return old;
  end if;
  if not new.share_list then delete from public.program_interest where user_id = new.user_id; end if;
  return new;
end $$;
drop trigger if exists profiles_unshare on public.profiles;
create trigger profiles_unshare after update of share_list or delete on public.profiles for each row execute function public.profiles_unshare();
