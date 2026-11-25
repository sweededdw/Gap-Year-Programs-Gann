// Vercel serverless function: POST /api/delete-account
// Deletes the logged-in student's account. Their saved data (gap_year_trackers) and error log rows
// go with it, because those tables reference auth.users with "on delete cascade".
//
// Needs SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) in Vercel, marked Sensitive.
// That key can do anything in the database, so it is only ever used here, on the server.
const json = (res, code, body) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Use POST." });
  }
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !secret) return json(res, 503, { error: "Account deletion isn't switched on yet." });

  const m = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "");
  if (!m) return json(res, 401, { error: "Please log in again, then try once more." });

  try {
    // 1. Who is asking? Supabase checks the student's own login token.
    const who = await fetch(url + "/auth/v1/user", { headers: { apikey: publishable, Authorization: "Bearer " + m[1] } });
    if (!who.ok) return json(res, 401, { error: "Please log in again, then try once more." });
    const user = await who.json();
    if (!user || typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) return json(res, 401, { error: "Please log in again, then try once more." });

    // 2. Delete exactly that user. New-style secret keys (sb_secret_...) go in the apikey header only;
    //    legacy service_role keys are JWTs and also go in Authorization.
    const headers = secret.startsWith("sb_secret_") ? { apikey: secret } : { apikey: secret, Authorization: "Bearer " + secret };
    const del = await fetch(url + "/auth/v1/admin/users/" + encodeURIComponent(user.id), { method: "DELETE", headers });
    if (!del.ok) {
      console.error("delete-account: Supabase returned", del.status);
      return json(res, 502, { error: "Couldn't delete your account. Try again in a minute." });
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("delete-account:", e && e.message);
    return json(res, 502, { error: "Couldn't reach the account server. Try again in a minute." });
  }
};
