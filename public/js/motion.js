/*
 * Motion touches, adapted by hand from Watermelon UI's animated components (MIT, ui.watermelon.sh).
 * Their originals are React + Motion; these are plain DOM + CSS so they fit this site.
 *   1. Sliding nav pill        (continuous-tabs)  — the active-page highlight glides between links
 *   2. Heart pop               (save-toggle)      — saving a program pops the heart with a small burst
 *   3. Rolling counter         (stepper)          — the Saved count rolls up or down when it changes
 *   4. Quick search            (command-search)   — Ctrl/Cmd+K or "/" opens a palette of programs and pages
 *   5. Shimmer                 (shimmer-button)   — pure CSS, in styles.css
 *   6. Pointer glow on cards, a rolling live count, and typographer's quotes in drawn text
 * Everything is cosmetic: if this file fails to load, the site works the same, just without motion.
 */
(function () {
  "use strict";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- 1. Sliding nav pill ----------
  const nav = document.querySelector(".topnav");
  let pill = null;
  function placePill(animate) {
    if (!nav) return;
    const active = nav.querySelector("a.active");
    // Phones show the menu as a grid of tiles; the pill only makes sense on the one-row desktop bar.
    const oneRow = getComputedStyle(nav).display === "flex";
    if (!active || !oneRow) { if (pill) pill.style.opacity = "0"; if (nav.classList.contains("has-pill")) nav.classList.remove("has-pill"); return; }
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "nav-pill";
      pill.setAttribute("aria-hidden", "true");
      nav.prepend(pill);
      animate = false;
    }
    const wasHidden = pill.style.opacity === "0" || !nav.classList.contains("has-pill");
    if (!animate || wasHidden) pill.classList.add("no-anim");
    pill.style.width = active.offsetWidth + "px";
    pill.style.height = active.offsetHeight + "px";
    pill.style.transform = "translate(" + active.offsetLeft + "px," + active.offsetTop + "px)";
    pill.style.opacity = "1";
    if (!nav.classList.contains("has-pill")) nav.classList.add("has-pill");
    if (pill.classList.contains("no-anim")) { void pill.offsetWidth; pill.classList.remove("no-anim"); }
  }
  if (nav) {
    // app.js toggles .active on the links after each route; follow it.
    // React only to the links (their .active class, or a link being moved). placePill changes the
    // pill's and the nav's own classes; reacting to those would loop forever.
    new MutationObserver((recs) => {
      const relevant = recs.some((r) => r.type === "attributes" ? r.target.tagName === "A"
        : [...r.addedNodes, ...r.removedNodes].some((n) => n.tagName === "A"));
      if (relevant) placePill(true);
    }).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
    window.addEventListener("resize", () => placePill(false));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placePill(false));
    placePill(false);
  }

  // ---------- 2. Heart pop ----------
  // app.js redraws the page after a save, so remember what was clicked and animate the fresh button.
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('[data-act="save"]');
    if (!b) return;
    const id = b.dataset.id, isIcon = b.classList.contains("heart");
    requestAnimationFrame(() => {
      const fresh = [...document.querySelectorAll('[data-act="save"][data-id="' + CSS.escape(id) + '"]')]
        .find((x) => x.classList.contains("heart") === isIcon);
      if (!fresh || fresh.getAttribute("aria-pressed") !== "true" || reduce) return;
      const svg = fresh.querySelector("svg");
      if (svg) { svg.classList.remove("pop"); void svg.getBoundingClientRect(); svg.classList.add("pop"); }
      burst(svg || fresh);
    });
  }, true);
  function burst(target) {
    const r = target.getBoundingClientRect();
    const box = document.createElement("span");
    box.className = "heart-burst";
    box.setAttribute("aria-hidden", "true");
    box.style.left = r.left + r.width / 2 + "px";
    box.style.top = r.top + r.height / 2 + "px";
    for (let i = 0; i < 8; i++) {
      const d = document.createElement("i");
      d.style.setProperty("--a", (i * 45 + 22) + "deg");
      box.appendChild(d);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 700);
  }

  // ---------- 3. Rolling counter ----------
  const count = document.getElementById("saved-count");
  if (count) {
    let last = parseInt(count.textContent, 10) || 0, busy = false;
    new MutationObserver(() => {
      if (busy) return;
      const now = parseInt(count.textContent, 10);
      if (isNaN(now) || now === last) return;
      const dir = now > last ? "up" : "down";
      last = now;
      if (reduce) return;
      busy = true;
      count.innerHTML = '<span class="roll roll-' + dir + '">' + now + "</span>";
      count.classList.remove("bump"); void count.offsetWidth; count.classList.add("bump");
      busy = false;
    }).observe(count, { childList: true, characterData: true, subtree: true });
  }

  // ---------- 4. Quick search (Ctrl/Cmd+K or "/") ----------
  const PAGES = [
    { t: "Discover", s: "Quiz and swipe", h: "#/swipe" },
    { t: "Browse all programs", s: "Every program, with filters", h: "#/browse" },
    { t: "Compare", s: "Side by side", h: "#/compare" },
    { t: "Colleges", s: "Gap year and credit policies", h: "#/colleges" },
    { t: "Community", s: "Youth groups and student groups", h: "#/community" },
    { t: "Saved", s: "Your list", h: "#/my-list" },
    { t: "Home", s: "", h: "#/" },
  ];
  const TYPE = { gap: "Gap year", mechina: "Mechina", university: "University", movement: "Youth movement", service: "Service", aliyah: "Aliyah & IDF", yeshiva: "Yeshiva", seminary: "Seminary" };
  let pal = null, items = [], sel = 0, lastFocus = null;

  function programs() {
    const d = window.GYF_DATA;
    return (d && d.programs) || [];
  }
  function score(q, hay) {
    // Simple ranking: every word must appear; earlier and word-start hits rank higher.
    let total = 0;
    for (const w of q) {
      const i = hay.indexOf(w);
      if (i < 0) return -1;
      total += (i === 0 ? 0 : /\s/.test(hay[i - 1]) ? 5 : 20) + i / 100;
    }
    return total;
  }
  function results(raw) {
    const q = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const lab = ((window.GYF_DATA || {}).labels || {});
    const cities = (p) => (p.cities || []).map((c) => (lab.city && lab.city[c]) || c).join(", ");
    const pages = PAGES.map((p) => ({ kind: "Pages", t: p.t, s: p.s, h: p.h, hay: (p.t + " " + p.s).toLowerCase() }));
    const progs = programs().map((p) => ({
      kind: "Programs", t: p.name, s: [TYPE[p.type], cities(p), p.operator].filter(Boolean).join(" · "),
      h: "#/program/" + p.id, hay: [p.name, p.short, p.operator, TYPE[p.type], cities(p), (p.cities || []).join(" "), p.orientation].join(" ").toLowerCase(),
    }));
    if (!q.length) return pages.slice(0, 6).concat(progs.slice(0, 6));
    const rank = (arr) => arr.map((x) => [score(q, x.hay), x]).filter((x) => x[0] >= 0).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return rank(progs).slice(0, 8).concat(rank(pages).slice(0, 4));
  }
  function build() {
    pal = document.createElement("div");
    pal.className = "qs";
    pal.hidden = true;
    pal.innerHTML =
      '<div class="qs-back" data-qs-close></div>' +
      '<div class="qs-panel" role="dialog" aria-modal="true" aria-label="Search programs and pages">' +
      '<div class="qs-field"><svg class="ic" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input class="qs-input" type="text" placeholder="Search programs, cities, pages" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="qs-list" aria-autocomplete="list" />' +
      '<kbd class="qs-kbd">Esc</kbd></div>' +
      '<div class="qs-list" id="qs-list" role="listbox"></div>' +
      '<div class="qs-foot"><span><kbd>&uarr;</kbd><kbd>&darr;</kbd> move</span><span><kbd>Enter</kbd> open</span></div>' +
      "</div>";
    document.body.appendChild(pal);
    const input = pal.querySelector(".qs-input");
    input.addEventListener("input", () => { sel = 0; draw(input.value); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); go(items[sel]); }
      else if (e.key === "Tab") e.preventDefault(); // keep focus in the dialog
    });
    pal.addEventListener("click", (e) => {
      if (e.target.closest("[data-qs-close]")) return close();
      const row = e.target.closest("[data-qs-i]");
      if (row) go(items[+row.dataset.qsI]);
    });
    pal.addEventListener("mousemove", (e) => {
      const row = e.target.closest("[data-qs-i]");
      if (row && +row.dataset.qsI !== sel) { sel = +row.dataset.qsI; mark(); }
    });
  }
  function draw(q) {
    items = results(q);
    const list = pal.querySelector(".qs-list");
    if (!items.length) { list.innerHTML = '<p class="qs-empty">No matches for "' + esc(q) + '"</p>'; return; }
    let html = "", kind = "";
    items.forEach((x, i) => {
      if (x.kind !== kind) { kind = x.kind; html += '<div class="qs-sec">' + kind + "</div>"; }
      html += '<div class="qs-row" role="option" id="qs-o' + i + '" data-qs-i="' + i + '" style="--i:' + Math.min(i, 10) + '">' +
        '<span class="qs-t">' + esc(x.t) + "</span>" + (x.s ? '<span class="qs-s">' + esc(x.s) + "</span>" : "") + "</div>";
    });
    list.innerHTML = html;
    mark();
  }
  function mark() {
    pal.querySelectorAll(".qs-row").forEach((r) => r.setAttribute("aria-selected", String(+r.dataset.qsI === sel)));
    const on = pal.querySelector('.qs-row[aria-selected="true"]');
    pal.querySelector(".qs-input").setAttribute("aria-activedescendant", on ? on.id : "");
    if (on) on.scrollIntoView({ block: "nearest" });
  }
  function move(d) { if (!items.length) return; sel = (sel + d + items.length) % items.length; mark(); }
  function go(x) {
    if (!x) return;
    close();
    if (location.hash === x.h) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = x.h;
  }
  function open() {
    if (!pal) build();
    if (!pal.hidden) return;
    lastFocus = document.activeElement;
    pal.hidden = false;
    document.documentElement.classList.add("qs-lock");
    requestAnimationFrame(() => pal.classList.add("on"));
    const input = pal.querySelector(".qs-input");
    input.value = ""; sel = 0; draw("");
    input.focus();
  }
  function close() {
    if (!pal || pal.hidden) return;
    pal.classList.remove("on");
    document.documentElement.classList.remove("qs-lock");
    setTimeout(() => { pal.hidden = true; }, reduce ? 0 : 160);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal && !pal.hidden ? close() : open(); }
    else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(); }
    else if (e.key === "Escape" && pal && !pal.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);

  // ---------- 6. Pointer glow on cards, the rolling live count, typographer's quotes ----------
  const app = document.getElementById("app");
  if (app) {
    // The "N programs fit" count rolls up or down as answers narrow it.
    let lastLive = null;
    const liveCount = () => {
      const el = app.querySelector(".live-count strong");
      if (!el) { lastLive = null; return; }
      const n = parseInt(el.textContent, 10);
      if (lastLive != null && n !== lastLive && !reduce) el.classList.add("roll", n > lastLive ? "roll-up" : "roll-down");
      lastLive = n;
    };
    new MutationObserver(liveCount).observe(app, { childList: true });
    liveCount();
    // Typographer's quotes and apostrophes in everything the app draws (program text included). Only text nodes
    // change, never markup, attributes or anything the student is typing.
    const curl = (t) => t
      .replace(/(^|[\s(\[{\u2014\u2013-])"/g, "$1\u201c").replace(/"/g, "\u201d")
      .replace(/(^|[\s(\[{\u2014\u2013-])'(?=\d0s)/g, "$1\u2019")
      .replace(/(^|[\s(\[{\u2014\u2013-])'/g, "$1\u2018").replace(/'/g, "\u2019");
    const curlIn = (root) => {
      if (root.nodeType === 3) { if (/["']/.test(root.nodeValue)) root.nodeValue = curl(root.nodeValue); return; }
      if (root.nodeType !== 1) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (/["']/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest("textarea, pre, code, script, style, [contenteditable]")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      const hits = []; while (w.nextNode()) hits.push(w.currentNode);
      hits.forEach((n) => { n.nodeValue = curl(n.nodeValue); });
    };
    new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(curlIn))).observe(app, { childList: true, subtree: true });
    curlIn(app);
    // A soft light follows the pointer across cards.
    if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
      app.addEventListener("pointermove", (e) => {
        const c = e.target.closest && e.target.closest(".bcard, .org-tile");
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", (e.clientX - r.left) + "px");
        c.style.setProperty("--my", (e.clientY - r.top) + "px");
      }, { passive: true });
    }
  }

  // A search button in the top bar, so the palette is findable without the shortcut.
  const tools = document.querySelector(".topbar-tools");
  if (tools) {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qs-open";
    btn.setAttribute("aria-label", "Search programs (" + (mac ? "Command" : "Control") + " K)");
    btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<span class="qs-open-label">Search</span><kbd class="qs-open-kbd">' + (mac ? "&#8984;K" : "Ctrl K") + "</kbd>";
    btn.addEventListener("click", open);
    tools.prepend(btn);
  }
})();
