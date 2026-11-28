-- 0007: suggestions from the Contact page (Home › Contact).
-- Anyone can send one, guests included; only admins can read them (admin page › Suggestions).
-- Safe to run more than once.

create table if not exists public.suggestions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null default 'other' check (kind in ('program', 'feature', 'fix', 'other')),
  message    text not null check (char_length(btrim(message)) between 3 and 2000),
  contact    text check (char_length(contact) <= 200),
  page       text check (char_length(page) <= 300)
);
create index if not exists suggestions_created_at on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;
drop policy if exists "Anyone can suggest" on public.suggestions;
drop policy if exists "Admins read suggestions" on public.suggestions;
drop policy if exists "Admins delete suggestions" on public.suggestions;
-- Signed-in people can only send as themselves; guests send with no user.
create policy "Anyone can suggest" on public.suggestions for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
create policy "Admins read suggestions" on public.suggestions for select to authenticated using ((select public.is_admin()));
create policy "Admins delete suggestions" on public.suggestions for delete to authenticated using ((select public.is_admin()));

revoke all on public.suggestions from anon, authenticated;
grant insert (kind, message, contact, page, user_id) on public.suggestions to anon, authenticated;
grant select, delete on public.suggestions to authenticated;
