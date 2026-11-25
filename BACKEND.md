# Backend, security, email and data

How accounts, data and email work, and the dashboard settings to check. The site uses its own Supabase project, **Gap Year Finder** (`boeoagusepvnpuhtdagy`). Accounts are separate from ApplicationMaxer.

## What's in place (checked 2026-11-25)
- **Accounts:** Supabase Auth, email and password only (no other providers turned on). Signup requires email confirmation, and the site asks for passwords of at least 8 characters.
- **Data:** one row per student in `public.gap_year_trackers` (`supabase/schema.sql`), protected by row-level security. Logged-out requests to read or write it are refused (checked: both return `42501 permission denied`). Each row is capped at about 500 KB.
- **Saving across devices:** a save only goes through if the account copy hasn't changed since this device last read it. If another device or tab saved first, the student chooses **Load the newer version** or **Keep mine**, so one device can't silently overwrite another.
- **Student controls:** the account menu has **Download my data** (a JSON file), **Delete my saved data** (clears the account copy and this browser's copy) and, once `SUPABASE_SECRET_KEY` is set in Vercel, **Delete my account** (removes the login and everything saved with it, through `api/delete-account.js`).
- **Editing data without code (added 2026-11-25):** admins get **Edit site data** (`#/admin`) in the account menu. Edits go live for everyone on save, every change is kept in history, two editors can't overwrite each other, bad edits are rejected before saving (and skipped if one ever gets into the database). Needs `supabase/migrations/0002_content_admin.sql`. See `supabase/README.md`.
- **Error log:** errors in students' browsers are saved to `client_errors` (5 per visit at most) and shown on the admin page's Errors tab.
- **Bot protection, ready to switch on:** Cloudflare Turnstile on sign-up, log-in, password reset and resend. Off until `TURNSTILE_SITE_KEY` is set in Vercel.
- **Privacy page:** `/privacy`, linked from the login page and the footer.
- **Visit counts:** Vercel Web Analytics script on every page (cookieless). Counts start once Analytics is enabled in Vercel.
- **Tests:** `npm test` runs about 300 browser and API checks; GitHub runs them on every push (`.github/workflows/test.yml`). See `tests/README.md`.
- **Keys:** the browser only ever gets the publishable key from `/api/config`. The secret (service-role) key is never in the repo, the browser or `/api/config`; only `api/delete-account.js` uses it, on the server.
- **Security headers** (`vercel.json`; the local dev server sends the same ones):
  - **Content-Security-Policy:** scripts only from this site, the pinned supabase-js on jsdelivr and Cloudflare Turnstile; data only to `*.supabase.co`; frames only from Turnstile; no inline scripts or event handlers; nobody can frame this site.
  - **Subresource Integrity** on supabase-js: the browser refuses the file if the CDN copy ever changes.
  - **HSTS** with preload (Vercel), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, a `Permissions-Policy` that turns off camera, mic and location, and `Cross-Origin-Opener-Policy`.

## Dashboard settings to check (Supabase → Gap Year Finder project)
1. **Authentication → URL Configuration**
   - Site URL: `https://israel-gap-year-finder.vercel.app`
   - Redirect URLs: `https://israel-gap-year-finder.vercel.app/login` (and `http://localhost:3001/login` for local testing)
2. **Authentication → Emails → SMTP Settings** (Gmail)
   - Host `smtp.gmail.com`, port `465`, username = the Gmail address, password = its **App Password** (never your normal password; don't share it with anyone).
   - Sender email = the same Gmail address. Sender name: `Israel Gap Year Finder`.
   - Gmail limits sending to roughly 500 emails a day. If signups grow past that, switch to a sending service such as Resend or Postmark on your own domain.
3. **Authentication → Emails → Templates:** paste the four templates from `supabase/email-templates/` (subjects are in that folder's README).
4. **Authentication → Sign In / Providers → Email**
   - Keep **Confirm email** on (it is now).
   - Turn on **Secure email change**.
   - Set **Minimum password length** to 8 to match the site, and require letters and digits.
   - **Leaked password protection** (blocks known breached passwords) needs a paid plan; turn it on if you upgrade.
5. **Authentication → Rate Limits:** keep the email-sending limit modest (Supabase's defaults are fine), so nobody can use the signup form to spam people.
6. **Bot protection:** see step 5 of the checklist below. Turn it on in Supabase only *after* the site key is in Vercel, or log-ins will fail.
7. **Database → Backups:** the free plan has no point-in-time recovery. Students can use **Download my data** in the meantime; a paid plan adds daily backups.

## Your checklist (in order)
1. **Run migration 0002.** SQL editor → paste `supabase/migrations/0002_content_admin.sql` → Run.
2. **Make yourself an admin.** Run the snippet in `supabase/README.md` with your login email, then refresh the site.
3. **Turn on Delete my account.** Supabase → Project Settings → API Keys → Secret keys → create one (name it `vercel-delete-account`) and copy it. Vercel → project → Settings → Environment Variables → add `SUPABASE_SECRET_KEY`, environment **Production**, mark **Sensitive**. Redeploy. Never paste it anywhere else (not in chat, not in code, never with a `NEXT_PUBLIC_` name).
4. **Turn on Analytics.** Vercel → project → Analytics → Enable (free tier is fine).
5. **Turn on bot protection** (before inviting lots of students):
   1. Cloudflare dashboard → Turnstile → Add widget. Hostname `israel-gap-year-finder.vercel.app` (add your own domain later), mode **Managed**.
   2. Vercel → add `TURNSTILE_SITE_KEY` = the **site key** (Production). Redeploy, open `/login` and check the security box appears.
   3. Only then: Supabase → Authentication → Attack Protection → enable CAPTCHA → Turnstile → paste the **secret key**.
6. **Faster email** (when ready): buy a domain, set up Resend on it, and put Resend's SMTP details in Supabase → Authentication → Emails → SMTP.
7. **Optional staging copy:** see `supabase/README.md`.
8. **Privacy page contact:** decide which email students should write to; it gets added to `/privacy`.
