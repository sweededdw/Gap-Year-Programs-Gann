// Home › Contact: the site's email, and a form for suggesting what to add.
// Suggestions go to the `suggestions` table (supabase/migrations/0007_suggestions.sql; admins read
// them on the admin page). If that can't be reached, the same message opens as an email instead.
(function () {
  "use strict";
  const EMAIL = "israelgapyearfinder@gmail.com";
  const KINDS = [["program", "A program"], ["feature", "A feature"], ["fix", "A fix"], ["other", "Something else"]];
  const PROMPTS = {
    program: "Which program, and a link to its site if you have one",
    feature: "What would make the site more useful to you?",
    fix: "What's wrong, and on which page?",
    other: "Tell us anything",
  };
  const MAX = 2000, PER_DAY = 5, LIMIT_KEY = "gyf:suggest-log";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = (d) => '<svg class="ic" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const MAIL = ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>');
  const COPY = ICON('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>');
  const CHECK = ICON('<path d="m5 12 5 5 9-10"/>');

  let kind = "feature", sent = false;

  function recent() {
    try {
      const day = Date.now() - 864e5;
      return JSON.parse(localStorage.getItem(LIMIT_KEY) || "[]").filter((t) => t > day);
    } catch (e) { return []; }
  }
  function logSend() {
    try { const r = recent(); r.push(Date.now()); localStorage.setItem(LIMIT_KEY, JSON.stringify(r)); } catch (e) { /* storage off */ }
  }
  function mailto(subject, body) {
    return "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + (body ? "&body=" + encodeURIComponent(body) : "");
  }
  function label(k) { const f = KINDS.find((x) => x[0] === k); return f ? f[1] : "Suggestion"; }

  function formHtml() {
    if (sent) {
      return '<div class="ct-done" role="status">' + '<span class="ct-done-ic">' + CHECK + "</span>" +
        "<div><strong>Thanks, we got it.</strong><p class=\"small muted\">We read every suggestion.</p></div>" +
        '<button class="btn sm" type="button" data-ct="again">Send another</button></div>';
    }
    return '<form class="ct-form" novalidate>' +
      '<div class="ct-kinds qseg" role="radiogroup" aria-label="What are you suggesting?">' +
      KINDS.map((k) => '<button type="button" class="qchip' + (k[0] === kind ? " on" : "") + '" role="radio" aria-checked="' + (k[0] === kind) + '" data-ct="kind" data-k="' + k[0] + '">' + k[1] + "</button>").join("") +
      "</div>" +
      '<label class="field">Your suggestion<textarea class="input ct-msg" name="message" rows="5" maxlength="' + MAX + '" placeholder="' + esc(PROMPTS[kind]) + '" required></textarea></label>' +
      '<label class="field"><span>Your email <span class="ct-opt">(optional, if you\'d like a reply)</span></span><input class="input" type="email" name="contact" maxlength="200" autocomplete="email" placeholder="you@example.com" /></label>' +
      // Left empty by people; bots that fill every field are ignored.
      '<label class="ct-hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>' +
      '<p class="ct-note small" role="status" hidden></p>' +
      '<button class="btn primary" type="submit">Send suggestion</button>' +
      "</form>";
  }

  function render($app, ctx) {
    sent = false;
    $app.insertAdjacentHTML("beforeend",
      '<section class="contact-page">' +
      '<header class="ct-head"><h1>Contact</h1><p class="muted">Questions, ideas, or something we got wrong.</p></header>' +
      '<div class="ct-grid">' +
      '<section class="ct-card ct-email" aria-labelledby="ct-email-h">' +
      '<h2 id="ct-email-h">Email us</h2>' +
      '<p class="ct-addr">' + EMAIL + "</p>" +
      '<p class="small muted">We reply within a few days.</p>' +
      '<div class="ct-actions"><a class="btn primary" href="' + mailto("Israel Gap Year Finder") + '">' + MAIL + " Write an email</a>" +
      '<button class="btn copy-btn" type="button" data-ct="copy"><span class="cp-a">' + COPY + ' Copy address</span><span class="cp-b" aria-hidden="true">' + CHECK + " Copied</span></button></div>" +
      "</section>" +
      '<section class="ct-card ct-suggest" id="suggest" aria-labelledby="ct-suggest-h">' +
      '<h2 id="ct-suggest-h">Suggest something to add</h2>' +
      '<p class="small muted">A program we\'re missing, a feature you\'d use, or a detail to fix.</p>' +
      '<div class="ct-form-wrap">' + formHtml() + "</div>" +
      "</section>" +
      "</div></section>");
    wire($app.querySelector(".contact-page"), ctx || {});
  }

  // motion.js gives the kind buttons one sliding highlight (.seg-pill) but only places it when the page is
  // drawn; this page doesn't redraw on a pick, so move it to the picked button here (it glides via CSS).
  function placePill(wrap) {
    const seg = wrap.querySelector(".ct-kinds"), pill = seg && seg.querySelector(".seg-pill"), on = seg && seg.querySelector(".qchip.on");
    if (!pill || !on) return;
    pill.style.width = on.offsetWidth + "px";
    pill.style.height = on.offsetHeight + "px";
    pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
  }

  function wire(root, ctx) {
    const wrap = root.querySelector(".ct-form-wrap");
    const repaint = () => { wrap.innerHTML = formHtml(); };
    const onResize = () => { if (!root.isConnected) return window.removeEventListener("resize", onResize); placePill(wrap); };
    window.addEventListener("resize", onResize);
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ct]");
      if (!b) return;
      const act = b.dataset.ct;
      if (act === "kind") {
        kind = b.dataset.k;
        wrap.querySelectorAll('[data-ct="kind"]').forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        placePill(wrap);
        const ta = wrap.querySelector(".ct-msg"); if (ta) ta.placeholder = PROMPTS[kind];
      } else if (act === "again") {
        sent = false; repaint();
        const ta = wrap.querySelector(".ct-msg"); if (ta) ta.focus();
      } else if (act === "copy") {
        const done = () => { b.classList.add("copied"); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("copied"), 1800); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(EMAIL).then(done, () => window.prompt("Copy this address:", EMAIL));
        else window.prompt("Copy this address:", EMAIL);
      }
    });
    root.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, note = f.querySelector(".ct-note"), btn = f.querySelector('[type="submit"]');
      const message = f.message.value.trim(), contact = f.contact.value.trim();
      const say = (text, bad, html) => { note.hidden = false; note.classList.toggle("bad", !!bad); if (html) note.innerHTML = html; else note.textContent = text; };
      if (f.website.value) { sent = true; return repaint(); } // a bot: pretend it went through
      if (message.length < 3) { say("Write a few words first.", true); f.message.focus(); return; }
      if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) { say("That email doesn't look right. Leave it empty if you don't want a reply.", true); f.contact.focus(); return; }
      const subject = "Suggestion: " + label(kind);
      const emailBody = message + (contact ? "\n\nReply to: " + contact : "");
      const fallback = (why) => say("", true, esc(why) + ' <a href="' + esc(mailto(subject, emailBody)) + '">Send it by email instead</a>.');
      if (recent().length >= PER_DAY) return fallback("That's the most suggestions for one day from this browser.");
      const sb = ctx.sb && ctx.sb();
      if (!sb) return fallback("Couldn't reach the server.");
      btn.disabled = true; btn.textContent = "Sending…";
      let res;
      try {
        res = await sb.from("suggestions").insert({ kind: kind, message: message.slice(0, MAX), contact: contact || null, page: (location.pathname + location.hash).slice(0, 300) });
      } catch (err) { res = { error: err }; }
      btn.disabled = false; btn.textContent = "Send suggestion";
      if (res && res.error) return fallback("Couldn't send it here.");
      logSend();
      sent = true; repaint();
      const d = wrap.querySelector(".ct-done"); if (d) d.setAttribute("tabindex", "-1"), d.focus();
    });
  }

  window.GYF_CONTACT = { render: render, EMAIL: EMAIL };
})();
