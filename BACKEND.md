# Backend, security, email and data

How accounts, data and email work, and the dashboard settings to check. The site uses its own Supabase project, **Gap Year Finder** (`boeoagusepvnpuhtdagy`). Accounts are separate from ApplicationMaxer.

## What's in place (checked 2026-11-25)
- **Accounts:** Supabase Auth, email and password only (no other providers turned on). Signup requires email confirmation, and the site asks for passwords of at least 8 characters.
- **Data:** one row per student in `public.gap_year_trackers` (`supabase/schema.sql`), protected by row-level security. Logged-out requests to read or write it are refused (checked: both return `42501 permission denied`). Each row is capped at about 500 KB.
- **Saving across devices:** a save only goes through if the account copy hasn't changed since this device last read it. If another device or tab saved first, the student chooses **Load the newer version** or **Keep mine**, so one device can't silently overwrite another.
- **Student controls:** the account menu has **Download my data** (a JSON file) and **Delete my saved data** (clears the account copy and this browser's copy).
- **Keys:** the browser only ever gets the publishable key from `/api/config`. The service-role key is never in the repo, the browser or `/api/config`.
- **Security headers** (`vercel.json`; the local dev server sends the same ones):
  - **Content-Security-Policy:** scripts only from this site and the pinned supabase-js on jsdelivr; data only to `*.supabase.co`; no inline scripts or event handlers; no framing.
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
6. **Bot protection (optional):** Supabase supports CAPTCHA, such as Cloudflare Turnstile, on signup and login. It needs a site key and a small code change on the login page; ask when you want it.
7. **Database → Backups:** the free plan has no point-in-time recovery. Students can use **Download my data** in the meantime; a paid plan adds daily backups.

## Not built yet
- **Deleting the login itself** (not just the saved data). This needs a server function that uses the service-role key as a Vercel environment variable, never `NEXT_PUBLIC_`. Until then, delete an account in Supabase → Authentication → Users.
- **A privacy page** saying what's stored (name, email, saved programs and progress) and how to delete it. Worth adding before inviting students broadly.
