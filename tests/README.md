# Tests

```
npm test               # everything except the live-site check (about 3 minutes)
node tests/run.mjs admin acct   # just those suites
npm run test:live      # checks the deployed site
VERBOSE=1 npm test     # print every check, not just failures
```

Run `npm install` once first (it installs PGlite, an in-memory Postgres for the database tests). Needs Node 22+ and Google Chrome (set `CHROME_PATH` if it isn't in the usual place).
GitHub runs the same tests on every push (`.github/workflows/test.yml`).

- `e2e/*.mjs` drive headless Chrome. Each prints `PASS …` / `FAIL …` lines.
- `db.test.mjs` runs every file in `supabase/migrations/` (twice, to prove they're safe to re-run) in an in-memory Postgres and checks the security rules: who can read and write what, history, conflict detection.
- `api.test.mjs` tests the serverless functions in `api/` with a fake Supabase.
- `mock-supabase.js` stands in for supabase-js in the browser, storing everything in localStorage
  (accounts, tracker rows, the programs/colleges edit tables, history, the error log, `is_admin`).
- `servers.cjs` serves `public/` with the production headers from `vercel.json` on ports 3124–3126 and 4010.
- Screenshots go to `tests/out/` (not committed).
