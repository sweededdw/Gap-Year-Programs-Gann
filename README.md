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

This site has its **own** Supabase project, so its accounts are separate from any other app.

### Create and connect the database (Vercel)
1. Go to Vercel → project **israel-gap-year-finder** → **Storage** tab → **Create Database** → **Supabase**. Choose the free plan and name it `gap-year-finder`. When asked which project to connect, pick **israel-gap-year-finder** with all environments.
   This creates a new Supabase project and adds its URL and keys to this Vercel project as environment variables automatically. `api/config.js` reads `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` and the publishable or anon key. It never reads the service-role key.
2. **Redeploy** (Deployments → ⋯ → Redeploy). Env changes only apply to new deployments.

### Supabase (open it from the Storage tab → "Open in Supabase")
3. **Run the schema:** SQL Editor → New query → paste `supabase/schema.sql` → Run. It's safe to run again.
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
# .env.local (git-ignored)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

npm run dev   # → http://localhost:3000
```

Add `http://localhost:3000/login` to Supabase Redirect URLs if you test email links locally. Opening `public/index.html` directly as a file still works, with no accounts and progress saved in that browser only.

## Notes
- Program data (`public/js/data.js`) is public research, so it isn't secret. The login controls who uses the tracker, not who can technically download the list.
- Each program in `data.js` has an `app` block (`deadlines`, `portal`, `essays`, `interview`, `recs`, `fees`, `aid`, `visa`, `decision`). Leave a value `null` when the program doesn't publish it, and the page will show "Not published". Data was researched on 2026-11-24 for the 2027–28 cycle.
