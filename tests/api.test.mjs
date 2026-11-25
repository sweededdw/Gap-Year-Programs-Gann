// Tests for the serverless functions in api/, with fake requests and a fake Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const config = require("../api/config.js");
const deleteAccount = require("../api/delete-account.js");

const ENV = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "TURNSTILE_SITE_KEY"];
function env(vals) { ENV.forEach((k) => delete process.env[k]); Object.assign(process.env, vals); }
const BASE = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" };
const USER = "0b6c7d1e-1111-4222-8333-944455556666";

async function call(handler, { method = "GET", headers = {} } = {}) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b || ""; } };
  await handler({ method, headers }, res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null };
}
function fakeFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || {} });
    const r = routes(url, opts);
    return { ok: r.status < 300, status: r.status, json: async () => r.body };
  };
  return calls;
}

test("config: 503 and names what's missing when Supabase isn't set", async () => {
  env({});
  const r = await call(config);
  assert.equal(r.status, 503);
  assert.deepEqual(r.json.missing, ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
});
test("config: public values only; features off by default", async () => {
  env(BASE);
  const r = await call(config);
  assert.equal(r.status, 200);
  assert.equal(r.json.key, "sb_publishable_x");
  assert.equal(r.json.accountDeletion, false);
  assert.equal(r.json.turnstileSiteKey, null);
});
test("config: never leaks the secret key, only that it exists", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_TOPSECRET", TURNSTILE_SITE_KEY: "0x4AAA" });
  const r = await call(config);
  assert.equal(r.json.accountDeletion, true);
  assert.equal(r.json.turnstileSiteKey, "0x4AAA");
  assert.ok(!JSON.stringify(r.json).includes("TOPSECRET"));
  assert.equal(r.headers["cache-control"], "no-store");
});

test("delete-account: POST only", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  assert.equal((await call(deleteAccount, { method: "GET" })).status, 405);
});
test("delete-account: 503 until the secret key is set", async () => {
  env(BASE);
  const r = await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer abc" } });
  assert.equal(r.status, 503);
});
test("delete-account: 401 without a login token, and Supabase is never called", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  const calls = fakeFetch(() => ({ status: 200, body: {} }));
  const r = await call(deleteAccount, { method: "POST" });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});
test("delete-account: 401 when Supabase rejects the token; nothing deleted", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  const calls = fakeFetch(() => ({ status: 401, body: { msg: "bad jwt" } }));
  const r = await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer expired.jwt.token" } });
  assert.equal(r.status, 401);
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
});
test("delete-account: deletes exactly the token's user; new secret key goes in apikey only", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  const calls = fakeFetch((url, o) => (o.method === "DELETE" ? { status: 200, body: {} } : { status: 200, body: { id: USER } }));
  const r = await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer good.jwt.token" } });
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, "https://abc.supabase.co/auth/v1/user");
  assert.equal(calls[0].headers.Authorization, "Bearer good.jwt.token");
  assert.equal(calls[0].headers.apikey, "sb_publishable_x");
  assert.equal(calls[1].url, "https://abc.supabase.co/auth/v1/admin/users/" + USER);
  assert.equal(calls[1].method, "DELETE");
  assert.deepEqual(calls[1].headers, { apikey: "sb_secret_k" });
});
test("delete-account: legacy service_role key also goes in Authorization", async () => {
  env({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: "eyJlegacy.jwt.key" });
  const calls = fakeFetch((url, o) => (o.method === "DELETE" ? { status: 200, body: {} } : { status: 200, body: { id: USER } }));
  await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer good.jwt.token" } });
  assert.deepEqual(calls[1].headers, { apikey: "eyJlegacy.jwt.key", Authorization: "Bearer eyJlegacy.jwt.key" });
});
test("delete-account: 502 with a friendly message if Supabase fails", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  fakeFetch((url, o) => (o.method === "DELETE" ? { status: 500, body: {} } : { status: 200, body: { id: USER } }));
  const orig = console.error; console.error = () => {};
  const r = await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer good.jwt.token" } });
  console.error = orig;
  assert.equal(r.status, 502);
  assert.match(r.json.error, /Try again/);
});
test("delete-account: odd user ids are refused", async () => {
  env({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_k" });
  const calls = fakeFetch(() => ({ status: 200, body: { id: "../../etc" } }));
  const r = await call(deleteAccount, { method: "POST", headers: { authorization: "Bearer good.jwt.token" } });
  assert.equal(r.status, 401);
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
});
