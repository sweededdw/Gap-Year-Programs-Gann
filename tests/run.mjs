// Runs the browser tests in headless Chrome and the API tests in Node.
//   node tests/run.mjs              every test except the live-site check
//   node tests/run.mjs admin acct   just those
//   node tests/run.mjs live         checks the deployed site
// Exits non-zero if any check fails. Screenshots land in tests/out/.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const OUT = path.join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const all = readdirSync(path.join(HERE, "e2e")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4));
const wanted = process.argv.slice(2);
const suites = wanted.length ? wanted : ["api", "db", ...all.filter((t) => t !== "live")];

function findChrome() {
  const c = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const hit = c.find((p) => p && existsSync(p));
  if (!hit) throw new Error("Chrome not found. Set CHROME_PATH.");
  return hit;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9342;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, ...opts });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => { out += "\nFAIL timed out after 360s"; p.kill("SIGKILL"); }, 360000);
    p.on("close", (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

const servers = spawn(process.execPath, [path.join(HERE, "servers.cjs"), ROOT], { stdio: "ignore" });
await sleep(500);
let failed = 0, passed = 0;
const chrome = suites.some((s) => s !== "api") ? findChrome() : null;

for (const s of suites) {
  let res, browser = null;
  if (s === "api") {
    res = await run(process.execPath, ["--test", path.join(HERE, "api.test.mjs")]);
    const ok = res.code === 0;
    console.log("== api\n" + (ok ? "PASS api handlers (node --test)" : res.out));
    ok ? passed++ : failed++;
    continue;
  }
  if (s === "db") {
    if (!existsSync(path.join(ROOT, "node_modules", "@electric-sql", "pglite"))) { console.log("== db\n   FAIL run `npm install` first (needs the PGlite dev dependency)"); failed++; continue; }
    res = await run(process.execPath, [path.join(HERE, "db.test.mjs")]);
    const lines = res.out.trim().split("\n");
    const p = lines.filter((l) => l.startsWith("PASS")).length, f = lines.filter((l) => l.startsWith("FAIL")).length;
    console.log("== db  (" + p + " passed" + (f ? ", " + f + " FAILED" : "") + ")");
    lines.filter((l) => process.env.VERBOSE || !l.startsWith("PASS")).forEach((l) => console.log("   " + l));
    if (!p) { failed++; console.log(res.out); }
    passed += p; failed += f;
    continue;
  }
  const profile = path.join(OUT, "chrome-" + s);
  rmSync(profile, { recursive: true, force: true });
  const flags = ["--headless=new", "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "--allow-file-access-from-files", "--no-first-run", "--disable-gpu", "--hide-scrollbars"];
  if (process.platform === "linux") flags.push("--no-sandbox", "--disable-dev-shm-usage");
  // The map draws with WebGL2; headless Chrome only offers it through software rendering.
  if (s === "map") flags.splice(flags.indexOf("--disable-gpu"), 1, "--enable-unsafe-swiftshader");
  browser = spawn(chrome, [...flags, "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await fetch("http://localhost:" + PORT + "/json/version"); break; } catch { await sleep(250); } }
  res = await run(process.execPath, [path.join(HERE, "e2e", s + ".mjs"), OUT, ROOT]);
  browser.kill("SIGKILL");
  await new Promise((r) => browser.once("close", r));
  const lines = res.out.trim().split("\n");
  const p = lines.filter((l) => l.startsWith("PASS")).length, f = lines.filter((l) => l.startsWith("FAIL")).length;
  console.log("== " + s + "  (" + p + " passed" + (f ? ", " + f + " FAILED" : "") + ")");
  lines.filter((l) => process.env.VERBOSE || !l.startsWith("PASS")).forEach((l) => console.log("   " + l));
  if (!p && !f) { console.log("   FAIL test produced no results (exit " + res.code + ")"); failed++; }
  passed += p; failed += f;
}
servers.kill();
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
