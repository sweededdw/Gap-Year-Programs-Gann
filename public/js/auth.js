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
    login: { title: "Log in", sub: "Welcome back. Log in to see all the programs.", button: "Log in", pw: "Password", auto: "current-password" },
    signup: { title: "Create your account", sub: "Free. Browse every Israel gap year program and track your applications.", button: "Create account", pw: "Password (at least 8 characters)", auto: "new-password" },
    forgot: { title: "Reset your password", sub: "Enter your email and we'll send you a link to choose a new password.", button: "Send reset link", pw: "", auto: "" },
    reset: { title: "Choose a new password", sub: "Pick a new password for your account.", button: "Save new password", pw: "New password (at least 8 characters)", auto: "new-password" },
  };
  let mode = query.get("mode") === "signup" ? "signup" : "login";
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
        theme: "dark",
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
    document.title = c.title + " · Israel Gap Year Finder";
    if (!keepMessage) hideMsg();
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
  const goToApp = () => location.replace("/");

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
    a.addEventListener("click", (e) => { e.preventDefault(); setMode(a.dataset.mode); })
  );

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
