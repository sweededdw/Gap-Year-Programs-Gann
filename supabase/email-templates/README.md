# Email templates (Supabase Auth)

Paste each file into **Supabase → Authentication → Emails → Templates** for the Gap Year Finder project (`boeoagusepvnpuhtdagy`). Use these subject lines:

| Template in Supabase | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your email for Israel Gap Year Finder |
| Reset password | `reset-password.html` | Reset your Israel Gap Year Finder password |
| Change email address | `change-email.html` | Confirm your new email for Israel Gap Year Finder |
| Magic link | `magic-link.html` | Your Israel Gap Year Finder login link |

- `{{ .ConfirmationURL }}` is filled in by Supabase. Keep it exactly as written.
- The logo is a PNG hosted on the site (`/static/logo-email.png`), because Gmail and Outlook don't show SVG images.
- Everything is table-based with inline styles, so it renders in Gmail, Outlook and Apple Mail.
