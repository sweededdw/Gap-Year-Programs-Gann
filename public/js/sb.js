// Shared Supabase client. Loads public settings from /api/config, then creates one client per page.
// Requires the supabase-js UMD script (window.supabase) to be loaded first.
(function () {
  let clientPromise = null;
  window.GYF_SB = function () {
    if (!clientPromise) {
      clientPromise = fetch("/api/config", { cache: "no-store" })
        .then((r) =>
          r.json().then((body) => {
            if (!r.ok) {
              const err = new Error(body.error || "Supabase is not configured");
              err.setup = true;
              err.missing = body.missing || [];
              throw err;
            }
            return body;
          })
        )
        .then((cfg) => {
          window.GYF_CONFIG = cfg; // public settings only: url, key, and which optional features are on
          return window.supabase.createClient(cfg.url, cfg.key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          });
        });
    }
    return clientPromise;
  };
})();
