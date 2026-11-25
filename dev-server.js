// Local preview that behaves like Vercel: serves public/ with clean URLs and runs api/config.js.
// Usage: put your Supabase values in .env.local (see README), then `npm run dev`.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Minimal .env.local loader (KEY=value per line).
try {
  fs.readFileSync(path.join(__dirname, ".env.local"), "utf8").split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
} catch { /* no .env.local: /api/config will report what's missing */ }

const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webp": "image/webp" };
// Every file in api/ is a serverless function on Vercel; run them the same way here.
const API = {};
fs.readdirSync(path.join(__dirname, "api")).filter((f) => f.endsWith(".js")).forEach((f) => { API["/api/" + f.slice(0, -3)] = require("./api/" + f); });
// Send the same security headers Vercel does (from vercel.json), so local testing matches production.
const SITE_HEADERS = {};
try { (JSON.parse(fs.readFileSync(path.join(__dirname, "vercel.json"), "utf8")).headers || []).filter((h) => h.source === "/(.*)").forEach((h) => h.headers.forEach((x) => { SITE_HEADERS[x.key] = x.value; })); } catch { /* no vercel.json */ }

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (API[url.pathname]) return API[url.pathname](req, res);
    // Vercel Web Analytics only exists on Vercel; answer locally with an empty script.
    if (url.pathname === "/_vercel/insights/script.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(""); }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    if (!path.extname(rel)) rel += ".html"; // clean URLs: /login → login.html
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, Object.assign({}, SITE_HEADERS, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }));
      res.end(buf);
    });
  })
  .listen(Number(process.env.PORT) || 3001, function () {
    // 3001 by default so it doesn't collide with other local apps on 3000.
    const url = "http://localhost:" + this.address().port;
    console.log("Gap Year Finder running at " + url + "  (press Ctrl+C to stop)");
    if (process.argv.includes("--open") && process.platform === "darwin") require("node:child_process").exec('open "' + url + '"');
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log("Gap Year Finder is already running — opening it.");
      if (process.argv.includes("--open") && process.platform === "darwin") require("node:child_process").exec('open "http://localhost:' + (Number(process.env.PORT) || 3001) + '"');
      process.exit(0);
    }
    throw err;
  });
