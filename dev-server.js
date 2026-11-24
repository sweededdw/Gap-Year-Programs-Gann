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
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const configHandler = require("./api/config.js");

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/config") return configHandler(req, res);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    if (!path.extname(rel)) rel += ".html"; // clean URLs: /login → login.html
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  })
  .listen(Number(process.env.PORT) || 3000, function () {
    console.log("Preview running at http://localhost:" + this.address().port);
  });
