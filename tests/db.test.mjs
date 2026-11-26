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

const USERS = { c: "00000000-0000-0000-0000-00000000000c", d: "00000000-0000-0000-0000-00000000000d" };
const as = async (who, sql, params) => {
  const uid = who === "admin" ? "00000000-0000-0000-0000-00000000000a" : who === "student" ? "00000000-0000-0000-0000-00000000000b" : USERS[who] || "";
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

// ---- 0003 community: profiles, groups, interests
const C = USERS.c, Dd = USERS.d;
await db.exec(`insert into auth.users values ('${C}','c@x'), ('${Dd}','d@x')`);
ok("anon can't read profiles", !!(await as("anon", "select * from profiles")).error);
r = await as("c", `insert into profiles (user_id, display_name, school, grad_year) values ('${C}', 'Noa L.', 'Gann Academy', 2027) returning visible`);
ok("student makes own profile; private by default", !r.error && r.rows[0].visible === false);
ok("owner sees own private profile", (await as("c", "select * from profiles")).rows.length === 1);
ok("others can't see a private profile", (await as("d", "select * from profiles")).rows.length === 0);
ok("can't make a profile for someone else", !!(await as("c", `insert into profiles (user_id, display_name) values ('${Dd}', 'Fake')`)).error);
ok("empty name refused", !!(await as("d", `insert into profiles (user_id, display_name) values ('${Dd}', '   ')`)).error);
ok("link in name refused", !!(await as("d", `insert into profiles (user_id, display_name) values ('${Dd}', 'see https://spam.example')`)).error);
ok("bad grad year refused", !!(await as("d", `insert into profiles (user_id, display_name, grad_year) values ('${Dd}', 'Maya', 1990)`)).error);
await as("c", `insert into org_members (user_id, org_id) values ('${C}', 'bbyo')`);
await as("c", `insert into program_interest (user_id, program_id) values ('${C}', 'aardvark')`);
ok("private student's groups and interests are hidden", (await as("d", "select * from org_members")).rows.length === 0 && (await as("d", "select * from program_interest")).rows.length === 0);
ok("owner sees own groups and interests", (await as("c", "select * from org_members")).rows.length === 1 && (await as("c", "select * from program_interest")).rows.length === 1);
r = await as("c", `update profiles set visible = true where user_id = '${C}' returning updated_at`);
ok("turning the profile on works", r.rows && r.rows.length === 1);
ok("shown profile, groups and interests are visible to other students", (await as("d", "select * from profiles")).rows.length === 1 && (await as("d", "select * from org_members")).rows.length === 1 && (await as("d", "select * from program_interest")).rows.length === 1);
ok("anon still sees nothing", !!(await as("anon", "select * from org_members")).error);
r = await as("d", `update profiles set display_name = 'hacked' where user_id = '${C}' returning user_id`);
ok("can't edit someone else's profile", !r.error ? r.rows.length === 0 : true);
ok("can't move a profile to another account", !!(await as("c", `update profiles set user_id = '${Dd}' where user_id = '${C}'`)).error);
ok("can't join a group as someone else", !!(await as("d", `insert into org_members (user_id, org_id) values ('${C}', 'ncsy')`)).error);
ok("bad group id refused", !!(await as("c", `insert into org_members (user_id, org_id) values ('${C}', 'Bad ID; drop')`)).error);
ok("joining the same group twice refused", !!(await as("c", `insert into org_members (user_id, org_id) values ('${C}', 'bbyo')`)).error);
r = await as("d", `delete from org_members where user_id = '${C}' returning org_id`);
ok("can't remove someone else from a group", !r.error ? r.rows.length === 0 : true);
for (let i = 0; i < 29; i++) await as("d", `insert into program_interest (user_id, program_id) values ('${Dd}', 'p${i}')`);
ok("30th interest allowed", !(await as("d", `insert into program_interest (user_id, program_id) values ('${Dd}', 'p29')`)).error);
ok("31st interest refused", !!(await as("d", `insert into program_interest (user_id, program_id) values ('${Dd}', 'p30')`)).error);
ok("students can't hide profiles", !!(await as("d", `insert into community_bans (user_id) values ('${C}')`)).error);
ok("students can't see the hidden list", (await as("d", "select * from community_bans")).rows?.length === 0);
r = await as("admin", `insert into community_bans (user_id) values ('${C}') returning banned_by`);
ok("admin can hide a profile", !r.error && r.rows[0].banned_by === "00000000-0000-0000-0000-00000000000a");
ok("hidden profile, groups and interests disappear for students", (await as("d", "select * from profiles")).rows.length === 0 && (await as("d", "select * from org_members")).rows.length === 0);
ok("admin still sees the hidden profile (to unhide it)", (await as("admin", "select * from profiles")).rows.length === 1);
await as("c", `delete from profiles where user_id = '${C}'`);
await as("c", `insert into profiles (user_id, display_name, visible) values ('${C}', 'Back again', true)`);
ok("re-making the profile doesn't undo the hide", (await as("d", "select * from profiles")).rows.length === 0);
r = await as("admin", `delete from community_bans where user_id = '${C}' returning user_id`);
ok("admin can unhide", r.rows && r.rows.length === 1 && (await as("d", "select * from profiles")).rows.length === 1);
await db.exec(`delete from auth.users where id = '${C}'`);
ok("deleting an account deletes its profile, groups and interests", (await db.query(`select (select count(*) from profiles where user_id = '${C}') + (select count(*) from org_members where user_id = '${C}') + (select count(*) from program_interest where user_id = '${C}') as n`)).rows[0].n == 0);
