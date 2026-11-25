# Israel Gap Year Finder

A website for Jewish high school seniors. Create an account, log in, and browse every Israel gap year program: pluralistic programs, Conservative and Reform programs, mechinot, and yeshivot and seminaries. Each program has a page for tracking its application: deadlines, essays, recommendations, documents, aid, visa, college deferral and decision.

**Stack:** static site on **Vercel** · accounts and data in **Supabase** · code on **GitHub**. There are no npm dependencies and no build step.

## How the pieces connect

```
GitHub (push to main) ──► Vercel builds & hosts the site
                              │  /api/config reads the Supabase env vars
                              ▼
Browser ──► Supabase Auth (sign up / log in / reset password)
        └─► Supabase table gap_year_trackers (each user's saved progress, row-level security)
```

## Files

| Path | What it is |
|---|---|
| `public/index.html`, `public/js/app.js` | The finder and program pages (logged-in users only) |
| `public/login.html`, `public/js/auth.js` | Log in, create account, forgot and reset password |
| `public/js/sb.js` | Creates the Supabase client from `/api/config` |
| `public/js/data.js` | All program data. Edit this to update programs. |
| `api/config.js` | Vercel function that gives the browser the **public** Supabase URL and key |
| `supabase/schema.sql` | Creates the progress table and its security rules. Run once. |
| `vercel.json` | Serves `public/`, gives clean URLs (`/login`), sets security headers |
| `dev-server.js` | Local preview (`npm run dev`) |
| `research/` | Research notes and sources |

## One-time setup checklist

This site has **its own Supabase project, "Gap Year Finder"** (project ID `boeoagusepvnpuhtdagy`). Accounts are separate from ApplicationMaxer, so students create a login here. Everything below happens in that project.

### Vercel environment variables (already set)
1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for Production, Preview and Development. They point at the Gap Year Finder project. `api/config.js` reads them (or `SUPABASE_URL` and the anon key) and never reads the service-role key.
2. After changing them, **redeploy** (Deployments → ⋯ → Redeploy). Env changes only apply to new deployments.

### Supabase (https://supabase.com/dashboard/project/boeoagusepvnpuhtdagy)
3. **Run the schema:** SQL Editor → New query → paste `supabase/schema.sql` → Run. Choose "Run query" if it warns about destructive operations; it only touches this site's table. It's safe to run again. (Done on 2026-11-24.)
4. **URLs:** Authentication → URL Configuration.
   - **Site URL:** `https://israel-gap-year-finder.vercel.app`
   - **Redirect URLs:** add `https://israel-gap-year-finder.vercel.app/login`. Also add `https://*-sweededdws-projects.vercel.app/login` if you want preview deployments to work.
5. **Email confirmation:** Authentication → Sign In / Providers → Email.
   - **Confirm email ON** (recommended): new users must click a link before logging in. The site handles this ("check your email", "resend").
   - **OFF:** users get in immediately after signing up.
6. **Emails that actually arrive:** Supabase's built-in email is rate-limited and meant for testing. For real users, add SMTP (for example Resend, Postmark or SendGrid) under Authentication → Emails → SMTP Settings, and customize the Confirm signup and Reset password templates.

### Vercel
7. **Deployment Protection:** Settings → Deployment Protection. Make sure the production domain is public, or visitors will hit a Vercel login wall. `israel-gap-year-finder.vercel.app` is public today.

### GitHub
8. The Vercel project is linked to `sweededdw/Gap-Year-Programs-Gann`. Every push to `main` deploys to production, and every other branch or PR gets a preview URL.

## Check that it works
1. Open the production URL in a private window. You should land on `/login`.
2. Create an account. You should either be logged in right away or told to check your email (depending on step 3).
3. Star a program, log out, log back in on another browser. The star should still be there.
4. Try **Forgot password?**. The email link should open a "Choose a new password" form.

## Local preview

```bash
cd "/Users/adamfarb/Desktop/Gap Year Programs Gann/Gap Year Programs Gann"
npm start        # starts the site on http://localhost:3001 and opens your browser
```

- If it's already running, `npm start` just opens it. Press **Ctrl+C** in that Terminal to stop it.
- It uses port **3001**, so it doesn't clash with other apps on 3000.
- Supabase settings come from `.env.local` (git-ignored):
  `NEXT_PUBLIC_SUPABASE_URL=…` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…`
- **Optional one-word shortcut:** paste this once into Terminal, then open a new Terminal window. After that, typing `gapyear` from anywhere starts and opens the site.
  ```bash
  echo 'alias gapyear="cd \"/Users/adamfarb/Desktop/Gap Year Programs Gann/Gap Year Programs Gann\" && npm start"' >> ~/.zshrc
  ```
- Opening `public/index.html` directly also works, but without accounts. Progress is then saved in that browser only.

## How matching works

The quiz has two short screens.

1. **The basics** are dealbreakers that remove programs before any scoring: community, tuition budget, setting, your current Hebrew level, and must-haves (semester option, college credit). Each group defaults to "Any" (Hebrew defaults to "Skip"). Hebrew level is scored rather than a hard filter: programs well above your level rank lower, and someone with no Hebrew skips programs that switch fully to Hebrew (rating 5).
2. **What matters to you** has seven rows: academics, social scene, internships, service, independence, peer mix and adventure. Each row is a 1–5 scale with short labels at each end, or "Don't care". An optional section adds field and city.

Every program has a **1–5 rating in 12 categories** (`PROFILES` in `public/js/data.js`). `e` ratings are estimates from the program type and show as ≈; `p` ratings come from what the program publishes; `-` means unknown. Fit per answered row = 1 − |want − rating| / 4. The match % is the average fit, plus field and city picks. The **Top 3** page explains each match ("Matched on …", weaker spots, a per-category bar), and program pages show all 12 ratings under "How it rates".

## Notes
- Program data (`public/js/data.js`) is public research, so it isn't secret. The login controls who uses the tracker, not who can technically download the list.
- Each program in `data.js` has an `app` block (`deadlines`, `portal`, `essays`, `interview`, `recs`, `fees`, `aid`, `visa`, `decision`). Leave a value `null` when the program doesn't publish it, and the page will show "Not published". Data was researched on 2026-11-24 for the 2027–28 cycle.
