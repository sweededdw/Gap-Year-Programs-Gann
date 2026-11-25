// Vercel serverless function: GET /api/config
// Hands the browser the PUBLIC Supabase settings from the project's environment variables,
// so no keys live in the repo. Never return the secret / service-role key here.
module.exports = (req, res) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (!url || !key) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: "Supabase is not configured",
        missing: [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].filter(Boolean),
      })
    );
  }
  res.end(
    JSON.stringify({
      url,
      key,
      // Optional features. Each switches on when its environment variable is set in Vercel.
      // (Only says WHETHER the secret key exists; the key itself never leaves the server.)
      accountDeletion: !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
    })
  );
};
