// Local servers for the browser tests. Each serves public/ with the production headers from vercel.json.
//   node tests/servers.cjs <repo root>
//   3124  app with a fake Supabase config (pages swap in tests/mock-supabase.js), account deletion on
//   3125  no Supabase config (the "not connected" message)
//   3126  like 3124, plus a Turnstile site key (bot check on the login page)
//   4010  real files, real CSP, a CSP-violation recorder injected, no backend (browser-only mode)
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = process.argv[2] || path.join(__dirname, "..");
const H = {};
JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"))).headers.filter((h) => h.source === "/(.*)").forEach((h) => h.headers.forEach((x) => (H[x.key] = x.value)));
const T = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const CSPWATCH = 'window.__cspv=[];document.addEventListener("securitypolicyviolation",function(e){window.__cspv.push(e.violatedDirective+" "+(e.blockedURI||""))});';
const json = (r, code, body) => { r.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); r.end(JSON.stringify(body)); };

function serve(port, mode) {
  http.createServer((q, r) => {
    let u = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (u === "/api/config") {
      if (mode === "noconfig" || mode === "csp") return json(r, 503, { error: "Supabase is not configured", missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] });
      return json(r, 200, { url: "https://mock.supabase.co", key: "sb_publishable_test", accountDeletion: true, turnstileSiteKey: mode === "turnstile" ? "1x00000000000000000000AA" : null });
    }
    if (u === "/api/delete-account") {
      if (q.method !== "POST") return json(r, 405, { error: "Use POST." });
      if (!/^Bearer tok-/.test(q.headers.authorization || "")) return json(r, 401, { error: "Please log in again, then try once more." });
      return json(r, 200, { ok: true });
    }
    if (u === "/_vercel/insights/script.js") { r.writeHead(200, { "Content-Type": "text/javascript" }); return r.end(""); }
    if (u === "/__cspwatch.js") { r.writeHead(200, { "Content-Type": "text/javascript" }); return r.end(CSPWATCH); }
    if (u.endsWith("/")) u += "index.html";
    if (!path.extname(u)) u += ".html";
    const file = path.join(ROOT, "public", path.normalize(u));
    if (!file.startsWith(path.join(ROOT, "public") + path.sep)) { r.writeHead(403); return r.end(); }
    fs.readFile(file, (e, b) => {
      if (e) { r.writeHead(404); return r.end(); }
      let body = b;
      if (u.endsWith(".html")) {
        let s = b.toString();
        if (mode === "csp") {
          s = s.replace("<head>", '<head>\n  <script src="/__cspwatch.js"></script>');
          if (u === "/index.html") s = s.replace(/\s*<script src="js\/sb\.js"><\/script>/, ""); // browser-only mode
        } else {
          s = s.replace(/ integrity="[^"]+" crossorigin="anonymous"/g, ""); // so the mock can stand in for supabase-js
        }
        body = Buffer.from(s);
      }
      r.writeHead(200, Object.assign({}, H, { "Content-Type": T[path.extname(u)] || "application/octet-stream" }));
      r.end(body);
    });
  }).listen(port);
}
serve(3124, "mock");
serve(3125, "noconfig");
serve(3126, "turnstile");
serve(4010, "csp");
console.log("test servers ready");
