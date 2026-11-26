# Supabase

Project: **Gap Year Finder** (`boeoagusepvnpuhtdagy`). SQL editor:
https://supabase.com/dashboard/project/boeoagusepvnpuhtdagy/sql/new

## Database changes (migrations)
Run each file in `migrations/` once, in order, in the SQL editor (paste the file, click **Run**). They're all
safe to run again. If Supabase warns about "destructive operations", that's the `drop policy if exists` lines
replacing old rules with the same ones; choose **Run this query**.

| File | What it adds | Status |
|---|---|---|
| `migrations/0001_trackers.sql` | Each student's saved programs and progress (same as `schema.sql`) | Done 2026-11-24 |
| `migrations/0002_content_admin.sql` | Admin editing of program and college data, edit history, error log | Done 2026-11-26 |
| `migrations/0003_community.sql` | Community: opt-in student profiles, groups (BBYO, NCSY, ...), who's interested in each program, admin hide | Run this next |

New database changes always go in a new numbered file (`0003_...sql`), never by editing an old one, so every
copy of the database (production, a staging copy, a fresh project) can be brought to the same state.

## Make yourself an admin
After running 0002, log in to the site once, then run this with **your** login email:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Refresh the site: the account menu now has **Edit site data**. To remove an admin:
`delete from public.admins where user_id = (select id from auth.users where email = 'them@example.com');`

## How program and college data works
- The site ships with built-in data in `public/js/` (researched and sourced).
- An edit saved on the admin page is a row in `programs` or `colleges`. It replaces the built-in entry with the
  same id for every student, straight away. Built-in updates pushed in code don't overwrite your edits.
- Every save or delete copies the previous version into `content_history` first. The admin page's History box
  can load any earlier version back.
- **Undo all edits** deletes the row, so the built-in version shows again.
- Only users in `admins` can write these tables (row-level security). Logged-in students can only read them.
- `client_errors` collects errors from students' browsers (5 per visit at most). Only admins can read it.

## Optional: a staging copy
To try risky changes without touching real students: create a second free project (e.g. "Gap Year Finder
Staging"), run every migration there, and set Vercel's **Preview** environment to its URL and publishable key.
Preview deployments (any branch other than `main`) then use the staging database.

## Email templates
See `email-templates/README.md`.
