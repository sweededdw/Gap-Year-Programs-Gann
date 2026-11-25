// Runs every migration in supabase/migrations against an in-memory Postgres (PGlite) with stand-ins for
// Supabase's auth schema and roles, then checks the row-level security rules, triggers and constraints.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db = new PGlite();
const ok = (n, c) => console.log((c ? "PASS " : "FAIL ") + n);
// Supabase stand-ins: roles, auth.users, auth.uid() from a session setting
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@x'), ('00000000-0000-0000-0000-00000000000b','student@x');
`);
// Every migration in order, then all of them again (each must be safe to re-run).
const files = readdirSync(R + "/supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of [...files, ...files]) await db.exec(readFileSync(R + "/supabase/migrations/" + f, "utf8"));
ok("migrations run, and run again", true);
await db.exec(`insert into public.admins (user_id) select id from auth.users where email = 'admin@x' on conflict do nothing;`);
await db.exec(`insert into public.admins (user_id) select id from auth.users where email = 'admin@x' on conflict do nothing;`);
ok("admin snippet works twice", (await db.query("select count(*)::int n from admins")).rows[0].n === 1);

const as = async (who, sql, params) => {
  const uid = who === "admin" ? "00000000-0000-0000-0000-00000000000a" : who === "student" ? "00000000-0000-0000-0000-00000000000b" : "";
  await db.exec(`set role ${who === "anon" ? "anon" : "authenticated"}; select set_config('request.uid', '${uid}', false);`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec("reset role;"); }
};
ok("is_admin(): admin true", (await as("admin", "select public.is_admin() v")).rows[0].v === true);
ok("is_admin(): student false", (await as("student", "select public.is_admin() v")).rows[0].v === false);
ok("is_admin(): anon can't call it", !!(await as("anon", "select public.is_admin() v")).error);
let r = await as("student", `insert into programs (id, data) values ('x', '{"id":"x"}') returning id`);
ok("student can't add a program", !!r.error);
r = await as("admin", `insert into programs (id, data, verified_at) values ('aardvark', '{"id":"aardvark","v":1}', '2026-11-25') returning updated_at, updated_by`);
ok("admin can add; updated_by stamped", !r.error && r.rows[0].updated_by === "00000000-0000-0000-0000-00000000000a");
const t1 = r.rows[0].updated_at;
r = await as("student", "select id, data from programs");
ok("student can read programs", r.rows && r.rows.length === 1);
ok("anon can't read programs", !!(await as("anon", "select * from programs")).error);
r = await as("student", `update programs set data = '{"id":"aardvark","hacked":1}' where id = 'aardvark' returning id`);
ok("student update changes nothing", !r.error ? r.rows.length === 0 : true);
await new Promise((res) => setTimeout(res, 5));
r = await as("admin", `update programs set data = '{"id":"aardvark","v":2}' where id = 'aardvark' and updated_at = $1 returning updated_at`, [t1]);
ok("admin update with matching updated_at works", r.rows && r.rows.length === 1);
r = await as("admin", `update programs set data = '{"id":"aardvark","v":3}' where id = 'aardvark' and updated_at = $1 returning updated_at`, [t1]);
ok("stale updated_at matches nothing (conflict detection)", r.rows && r.rows.length === 0);
r = await as("admin", "select table_name, item_id, data from content_history order by id");
ok("history keeps the version before each change", r.rows.length === 1 && r.rows[0].data.v === 1);
ok("student can't read history", (await as("student", "select * from content_history")).rows?.length === 0);
ok("nobody can write history directly", !!(await as("admin", `insert into content_history (table_name, item_id) values ('x','y')`)).error);
r = await as("admin", "delete from programs where id = 'aardvark' returning id");
ok("admin delete works and is kept in history", r.rows.length === 1 && (await as("admin", "select count(*)::int n from content_history")).rows[0].n === 2);
ok("bad college kind refused", !!(await as("admin", `insert into colleges (id, kind, data) values ('X', 'other', '{}')`)).error);
ok("college insert works", !(await as("admin", `insert into colleges (id, kind, data) values ('X', 'not_found', '{"name":"X"}')`)).error);
// error log
r = await as("student", `insert into client_errors (user_id, page, message, user_agent) values ('00000000-0000-0000-0000-00000000000b', '/#/x', 'boom', 'ua')`);
ok("student can log own error", !r.error);
ok("student can't log as someone else", !!(await as("student", `insert into client_errors (user_id, message) values ('00000000-0000-0000-0000-00000000000a', 'fake')`)).error);
ok("student can't read the error log", (await as("student", "select * from client_errors")).rows?.length === 0);
ok("admin reads the error log", (await as("admin", "select * from client_errors")).rows?.length === 1);
ok("huge message refused", !!(await as("student", `insert into client_errors (user_id, message) values ('00000000-0000-0000-0000-00000000000b', repeat('x', 3000))`)).error);
ok("student can't delete errors", (await as("student", "delete from client_errors returning id")).rows?.length === 0 || !!(await as("student", "delete from client_errors")).error);
ok("authenticated can't truncate", !!(await as("admin", "truncate client_errors")).error);
ok("anon can't log errors", !!(await as("anon", `insert into client_errors (message) values ('x')`)).error);
// account deletion cascades
await db.exec(`delete from auth.users where email = 'student@x'`);
ok("deleting a user removes their error rows", (await db.query("select count(*)::int n from client_errors")).rows[0].n === 0);
ok("admins can't add themselves (no insert grant)", !!(await as("student", `insert into admins (user_id) values ('00000000-0000-0000-0000-00000000000a')`)).error);
