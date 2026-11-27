// Login / sign-up / forgot-password / reset-password page, backed by Supabase Auth.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const form = $("auth-form");
  const msg = $("msg");
  const submit = $("submit");

  // Read link state BEFORE the Supabase client consumes the URL hash.
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const arrivedForRecovery = hash.get("type") === "recovery";
  const linkError = hash.get("error_description") || query.get("error_description");

  // Email links come back here; the app itself lives at "/".
  const RETURN_URL = location.origin + "/login";

  const MODES = {
    start: { title: "Find your gap year", sub: "Every Israel gap year program in one place, free.", button: "", pw: "", auto: "", doc: "Log in or sign up" },
    login: { title: "Log in", sub: "Welcome back. Log in to pick up your list and applications.", button: "Log in", pw: "Password", auto: "current-password" },
    signup: { title: "Create your account", sub: "Free. Browse every Israel gap year program and track your applications.", button: "Create account", pw: "Password (at least 8 characters)", auto: "new-password" },
    forgot: { title: "Reset your password", sub: "Enter your email and we'll send you a link to choose a new password.", button: "Send reset link", pw: "", auto: "" },
    reset: { title: "Choose a new password", sub: "Pick a new password for your account.", button: "Save new password", pw: "New password (at least 8 characters)", auto: "new-password" },
  };
  // First visit: a short choice (email, guest, log in). Someone who has logged in on this device before goes
  // straight to Log in. ?mode=signup and ?mode=login open that form.
  const KNOWN = "gyf:has-account";
  const known = () => { try { return localStorage.getItem(KNOWN) === "1"; } catch (e) { return false; } };
  if (query.get("deleted") === "1") { try { localStorage.removeItem(KNOWN); } catch (e) { /* ignore */ } }
  let mode = query.get("mode") === "signup" ? "signup" : query.get("mode") === "login" || known() ? "login" : "start";
  let sb = null;

  // ---------- Bot protection (Cloudflare Turnstile) ----------
  // Off until TURNSTILE_SITE_KEY is set in Vercel. Then a small check appears above the button, and its
  // token goes with every sign-up, log-in and reset request; Supabase verifies it (Auth → Bot protection).
  let captcha = null; // { widget, token }
  function setupCaptcha(siteKey) {
    if (!siteKey) return;
    captcha = { widget: null, token: null };
    const box = document.createElement("div");
    box.className = "auth-captcha";
    submit.parentNode.insertBefore(box, submit);
    window.onTurnstileReady = () => {
      captcha.widget = window.turnstile.render(box, {
        sitekey: siteKey,
        theme: document.documentElement.getAttribute("data-theme") === "daylight" ? "light" : "dark",
        action: "auth",
        callback: (t) => { captcha.token = t; },
        "expired-callback": () => { captcha.token = null; },
        "error-callback": () => { captcha.token = null; },
      });
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileReady";
    s.async = true;
    s.addEventListener("error", () => show("bad", "Couldn't load the security check. Turn off any blocker for this site, then refresh."));
    document.head.appendChild(s);
  }
  // Each token works once, so get a fresh one after every attempt.
  const captchaToken = () => (captcha ? captcha.token || undefined : undefined);
  function resetCaptcha() {
    if (captcha && captcha.widget != null && window.turnstile) { captcha.token = null; window.turnstile.reset(captcha.widget); }
  }

  function setMode(m, keepMessage) {
    mode = m;
    const c = MODES[m];
    $("title").textContent = c.title;
    $("subtitle").textContent = c.sub;
    submit.textContent = c.button;
    $("pw-label").textContent = c.pw;
    $("password").setAttribute("autocomplete", c.auto || "off");
    document.querySelectorAll("[data-show]").forEach((el) => {
      el.hidden = el.dataset.show.split(" ").indexOf(m) < 0;
    });
    document.title = (c.doc || c.title) + " · Israel Gap Year Finder";
    document.body.dataset.mode = m; // the photo shrinks on phones once a form is open
    if (!keepMessage) hideMsg();
    riseIn();
  }
  // Each screen's pieces come in one after another, a few hundredths of a second apart (CSS does the motion).
  function riseIn() {
    const items = [];
    Array.prototype.forEach.call(document.querySelector(".sheet-inner").children, (el) => {
      if (el.hidden) return;
      if (el.matches(".auth-form, .auth-choices")) Array.prototype.forEach.call(el.children, (c) => { if (!c.hidden) items.push(c); });
      else items.push(el);
    });
    items.forEach((el, i) => { el.classList.remove("rise"); el.style.setProperty("--i", i); });
    void document.body.offsetWidth; // restart the animation
    items.forEach((el) => el.classList.add("rise"));
  }
  function show(kind, text, action) {
    msg.className = "callout " + kind;
    msg.textContent = text;
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn sm";
      b.style.marginLeft = "auto";
      b.textContent = action.label;
      b.addEventListener("click", action.run);
      msg.appendChild(b);
    }
    msg.hidden = false;
  }
  function hideMsg() { msg.hidden = true; }
  function busy(on) {
    submit.disabled = on;
    submit.textContent = on ? "One moment…" : MODES[mode].button;
  }
  const goToApp = () => {
    try { localStorage.setItem(KNOWN, "1"); } catch (e) { /* ignore */ }
    location.replace("/");
  };

  function friendly(error) {
    const m = (error && error.message) || "Something went wrong. Please try again.";
    if (/invalid login credentials/i.test(m)) return "Email or password is incorrect.";
    if (/already registered|already been registered|already exists/i.test(m)) return "An account with that email already exists. Try logging in.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a few minutes and try again.";
    if (/password should be at least/i.test(m)) return "Password must be at least 8 characters.";
    if (/network|fetch/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
    if (/captcha/i.test(m)) return "The security check didn't go through. Complete it again and retry.";
    return m;
  }
  function resendAction(email) {
    return {
      label: "Resend email",
      run: async () => {
        if (captcha && !captcha.token) return show("bad", "Please finish the security check above the button, then press Resend again.");
        const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: RETURN_URL, captchaToken: captchaToken() } });
        resetCaptcha();
        show(error ? "bad" : "ok", error ? friendly(error) : "Sent again. Check your inbox (and spam folder).");
      },
    };
  }

  document.querySelectorAll("[data-mode]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setMode(a.dataset.mode);
      const first = { signup: "name", login: "email", forgot: "email" }[a.dataset.mode];
      if (first && matchMedia("(hover: hover)").matches) $(first).focus({ preventScroll: true }); // no keyboard pop-up on phones
    })
  );

  // Show / hide the password.
  $("pw-eye").addEventListener("click", () => {
    const pw = $("password"), show = pw.type === "password";
    pw.type = show ? "text" : "password";
    $("pw-eye").setAttribute("aria-pressed", String(show));
    $("pw-eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  // Google / Apple buttons, only for the providers switched on in Supabase (Authentication → Sign In / Providers).
  const PROVIDERS = {
    google: { label: "Continue with Google", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/><path d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/></svg>' },
    apple: { label: "Continue with Apple", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M16.37 12.62c-.02-2.33 1.9-3.45 1.99-3.5a4.3 4.3 0 0 0-3.37-1.82c-1.43-.15-2.8.84-3.53.84-.73 0-1.85-.82-3.04-.8a4.5 4.5 0 0 0-3.8 2.31c-1.63 2.82-.42 6.98 1.16 9.27.78 1.12 1.7 2.37 2.9 2.33 1.17-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.73 1.25-.02 2.04-1.14 2.8-2.27a9.9 9.9 0 0 0 1.27-2.61 4.06 4.06 0 0 1-2.42-3.73zM14.06 5.77A4.1 4.1 0 0 0 15 2.8a4.2 4.2 0 0 0-2.73 1.41 3.9 3.9 0 0 0-.97 2.84 3.46 3.46 0 0 0 2.76-1.28z"/></svg>' },
  };
  async function setupProviders(cfg) {
    if (!cfg || !cfg.url || !cfg.key) return;
    let on = {};
    try {
      const r = await fetch(cfg.url.replace(/\/$/, "") + "/auth/v1/settings", { headers: { apikey: cfg.key } });
      if (r.ok) on = (await r.json()).external || {};
    } catch (e) { return; } // can't tell: show email only
    const box = $("providers");
    Object.keys(PROVIDERS).filter((k) => on[k]).forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn auth-choice auth-provider p-" + k;
      b.innerHTML = PROVIDERS[k].icon + "<span>" + PROVIDERS[k].label + "</span>";
      b.addEventListener("click", async () => {
        b.disabled = true;
        const { error } = await sb.auth.signInWithOAuth({ provider: k, options: { redirectTo: RETURN_URL } });
        if (error) { b.disabled = false; show("bad", friendly(error)); }
      });
      box.appendChild(b);
    });
    if (box.children.length) { box.hidden = false; if (mode === "start") riseIn(); }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return;
    const name = $("name").value.trim();
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (mode === "signup" && !name) return show("bad", "Please enter your name.");
    if (mode !== "reset" && !validEmail) return show("bad", "Please enter a valid email address.");
    if ((mode === "signup" || mode === "reset") && password.length < 8) return show("bad", "Password must be at least 8 characters.");
    if (mode === "login" && !password) return show("bad", "Please enter your password.");
    if (captcha && mode !== "reset" && !captcha.token) return show("bad", "Please finish the security check above the button.");

    busy(true);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken() } });
        if (error) {
          if (/email not confirmed/i.test(error.message)) show("warn", "Please confirm your email first. Check your inbox for the link.", resendAction(email));
          else show("bad", friendly(error));
          return;
        }
        return goToApp();
      }
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: RETURN_URL, captchaToken: captchaToken() } });
        if (error) return show("bad", friendly(error));
        if (data.session) return goToApp(); // email confirmation is turned off in Supabase
        $("password").value = "";
        setMode("login", true);
        $("email").value = email;
        return show("ok", "Almost done! We sent a confirmation link to " + email + ". Click it and you'll be logged in.", resendAction(email));
      }
      if (mode === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: RETURN_URL, captchaToken: captchaToken() });
        if (error) return show("bad", friendly(error));
        return show("ok", "If an account exists for " + email + ", a reset link is on its way. Check your inbox.");
      }
      if (mode === "reset") {
        const { error } = await sb.auth.updateUser({ password });
        if (error) return show("bad", friendly(error));
        show("ok", "Password saved. Taking you to the programs…");
        return setTimeout(goToApp, 900);
      }
    } catch (err) {
      show("bad", friendly(err));
    } finally {
      busy(false);
      if (mode !== "reset") resetCaptcha();
    }
  });

  // Continue as a guest: the site works without an account; the list stays in this browser.
  $("guest").addEventListener("click", () => {
    try { localStorage.setItem("gyf:guest", "1"); } catch (e) { /* the ?guest=1 below still works for this visit */ }
    location.replace("/?guest=1");
  });

  async function init() {
    setMode(arrivedForRecovery ? "reset" : mode, true);
    if (linkError) {
      show("bad", /expired|invalid/i.test(linkError) ? "That link has expired or was already used. Request a new one below." : linkError);
      if (/expired|invalid/i.test(linkError)) setMode("forgot", true);
    }
    try {
      sb = await window.GYF_SB();
    } catch (err) {
      submit.disabled = true;
      show("bad", err.setup
        ? "This site isn't connected to its database yet. The owner needs to add " + (err.missing || []).join(" and ") + " in Vercel and redeploy."
        : "Couldn't reach the server. Refresh to try again.");
      return;
    }
    setupCaptcha(window.GYF_CONFIG && window.GYF_CONFIG.turnstileSiteKey);
    setupProviders(window.GYF_CONFIG);
    if (query.get("deleted") === "1") show("ok", "Your account and everything saved in it were deleted.");
    sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset", true);
    });
    const { data } = await sb.auth.getSession();
    // Already logged in (or just clicked a confirmation link) → straight to the app.
    if (data.session && !arrivedForRecovery && mode !== "reset") goToApp();
  }
  init();
})();
