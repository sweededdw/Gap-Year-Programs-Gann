/* Israel Gap Year Finder — app logic (no build step, no dependencies). */
(function () {
  "use strict";

  const D = window.GYF_DATA;
  const L = D.labels;
  const byId = {};
  D.programs.forEach((p) => (byId[p.id] = p));
  const $app = document.getElementById("app");

  // ---------- Persistence ----------
  // On the website: accounts are Supabase Auth; progress is saved to the
  // `gap_year_trackers` table (one row per user, protected by row-level security).
  // Opened as a plain file (file://): no accounts, progress stays in this browser.
  const HAS_BACKEND = /^https?:$/.test(location.protocol) && typeof window.GYF_SB === "function";
  const TABLE = "gap_year_trackers";
  const STORE_KEY = "gyf:v1";
  const blankState = () => ({ saved: {}, colleges: [], p: {}, filters: {} });
  let state = blankState();
  let sb = null;
  let userId = null;
  let remoteOk = false;
  let saveTimer = null;

  const localKey = () => STORE_KEY + (userId ? ":" + userId : "");
  function loadLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === "object") return Object.assign(blankState(), s);
      }
    } catch (e) { /* storage blocked: run without persistence */ }
    return blankState();
  }
  function saveLocal() {
    try { localStorage.setItem(localKey(), JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function banner(text) {
    const b = document.getElementById("banner");
    b.textContent = text;
    b.hidden = !text;
  }
  function pushRemote() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!sb || !remoteOk) return Promise.resolve();
    return sb
      .from(TABLE)
      .upsert({ user_id: userId, state: state, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) banner("Couldn't save your latest changes to your account. They're kept in this browser, and we'll retry on your next change.");
        else banner("");
      });
  }
  function save() {
    saveLocal(); // always keep a local copy as a safety net
    if (sb && remoteOk) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(pushRemote, 500); // batch rapid typing into one request
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveTimer) pushRemote(); });
  function ps(id) {
    const s = (state.p[id] = state.p[id] || {});
    s.parts = s.parts || {};
    s.extraParts = s.extraParts || [];
    s.essays = s.essays || {};
    s.customEssays = s.customEssays || [];
    s.recs = s.recs || [];
    s.docs = s.docs || {};
    s.aid = s.aid || {};
    return s;
  }

  // ---------- Helpers ----------
  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TODAY = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(s, opts) {
    const d = typeof s === "string" ? parseDate(s) : s;
    return d ? d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" }) : "";
  }
  function daysUntil(s) {
    const d = parseDate(s);
    return d ? Math.round((d - TODAY) / 86400000) : null;
  }
  function countdown(s) {
    const n = daysUntil(s);
    if (n === null) return "";
    if (n < 0) return '<span class="cd past">passed</span>';
    if (n === 0) return '<span class="cd urgent">today</span>';
    const cls = n <= 14 ? "urgent" : n <= 45 ? "soon" : "";
    return '<span class="cd ' + cls + '">in ' + n + " day" + (n === 1 ? "" : "s") + "</span>";
  }
  const money = (n) => "$" + Number(n).toLocaleString("en-US");
  const shortCost = (p) => p.costText.split(" · ")[0];
  const bindAttr = (path, scope) => ' data-scope="' + (scope || "p") + '" data-bind="' + esc(JSON.stringify(path)) + '"';

  function setPath(root, path, value) {
    let o = root;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (o[k] == null) o[k] = typeof path[i + 1] === "number" ? [] : {};
      o = o[k];
    }
    o[path[path.length - 1]] = value;
  }

  const PART_STATUS = [["", "Not started"], ["progress", "In progress"], ["submitted", "Submitted"]];
  const REC_STATUS = [["", "Not asked"], ["asked", "Asked"], ["submitted", "Submitted"]];
  const AID_STATUS = [["", "Not started"], ["progress", "In progress"], ["submitted", "Submitted"], ["awarded", "Awarded"]];
  const DEFER_STATUS = [["", "Not requested"], ["requested", "Requested"], ["approved", "Approved"], ["denied", "Denied"]];
  const RESULT_STATUS = [["", "Not applied yet"], ["applied", "Applied, waiting"], ["accepted", "Accepted"], ["waiting", "Waitlisted"], ["rejected", "Not accepted"], ["withdrew", "Withdrew"]];

  function statusSelect(path, value, opts, scope, label) {
    const v = value || "";
    return (
      '<select class="status s-' + (v || "none") + '" aria-label="' + esc(label || "Status") + '"' + bindAttr(path, scope) + ">" +
      opts.map((o) => '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + o[1] + "</option>").join("") +
      "</select>"
    );
  }

  // ---------- Derived data ----------
  function nextDeadline(p) {
    const future = p.app.deadlines.filter((d) => d.date && daysUntil(d.date) >= 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (future.length) return { kind: "date", d: future[0] };
    if (p.app.rolling) return { kind: "rolling" };
    return { kind: "unknown", d: p.app.deadlines[0] || null };
  }
  function deadlineSummary(p) {
    const nd = nextDeadline(p);
    if (nd.kind === "date") return fmtDate(nd.d.date, { month: "short", day: "numeric" }) + " " + countdown(nd.d.date);
    if (nd.kind === "rolling") return '<span class="pill rolling">Rolling</span>';
    return '<span class="muted">Not posted</span>';
  }
  function allParts(p) {
    return p.app.portal.parts.concat(ps(p.id).extraParts);
  }
  function allEssays(p) {
    const s = ps(p.id);
    const out = p.app.essays.items.map((e, i) => ({ status: s.essays[i] }));
    s.customEssays.forEach((e) => out.push({ status: e.status }));
    return out;
  }
  function progress(p) {
    const s = ps(p.id);
    let done = 0, total = 0;
    const tally = (v, half) => { total++; if (v === "submitted" || v === true) done++; else if (v && half.indexOf(v) >= 0) done += 0.5; };
    allParts(p).forEach((n) => tally(s.parts[n], ["progress"]));
    allEssays(p).forEach((e) => tally(e.status, ["progress"]));
    s.recs.forEach((r) => tally(r.status, ["asked"]));
    p.app.documents.forEach((d) => tally(!!s.docs[d.name], []));
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // ---------- Router ----------
  let current = { view: "finder", id: null };
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "program" && byId[parts[1]]) current = { view: "detail", id: parts[1] };
    else if (parts[0] === "my-list") current = { view: "list", id: null };
    else current = { view: "finder", id: null };
    render();
  }
  function render() {
    if (current.view === "detail") renderDetail(byId[current.id]);
    else if (current.view === "list") renderList();
    else renderFinder();
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", (a.dataset.nav === "my-list") === (current.view === "list") && current.view !== "detail");
    });
    document.getElementById("saved-count").textContent = Object.keys(state.saved).filter((k) => state.saved[k] && byId[k]).length;
  }

  // ---------- Finder ----------
  const FILTER_GROUPS = [
    { key: "orientation", title: "Jewish community", options: L.orientation, match: (p, v) => p.orientation === v },
    { key: "focus", title: "Focus", options: L.focus, match: (p, v) => p.focus.indexOf(v) >= 0 },
    { key: "city", title: "Where", options: L.city, match: (p, v) => p.cities.indexOf(v) >= 0 },
    { key: "israeliPeers", title: "Israeli peers", options: L.israeliPeers, match: (p, v) => p.israeliPeers === v },
    { key: "gender", title: "Setting", options: L.gender, match: (p, v) => p.gender === v },
    {
      key: "budget", title: "Tuition (USD)",
      options: { u15: "Under $15k", "15-25": "$15k–25k", "25-35": "$25k–35k", o35: "$35k+" },
      match: (p, v) => {
        if (p.costUSD == null) return true; // unpublished prices stay visible; flagged on the card
        const c = p.costUSD;
        return v === "u15" ? c < 15000 : v === "15-25" ? c >= 15000 && c < 25000 : v === "25-35" ? c >= 25000 && c < 35000 : c >= 35000;
      },
    },
  ];
  function filters() {
    const f = (state.filters = state.filters || {});
    FILTER_GROUPS.forEach((g) => (f[g.key] = f[g.key] || []));
    return f;
  }
  function filtered() {
    const f = filters();
    const q = (f.q || "").trim().toLowerCase();
    let list = D.programs.filter((p) => {
      for (const g of FILTER_GROUPS) {
        const sel = f[g.key];
        if (sel.length && !sel.some((v) => g.match(p, v))) return false;
      }
      if (f.semester && !p.semesterOption) return false;
      if (f.credit && !p.credit) return false;
      if (q && (p.name + " " + p.operator + " " + p.base + " " + p.blurb).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const sort = f.sort || "deadline";
    const dkey = (p) => { const nd = nextDeadline(p); return nd.kind === "date" ? nd.d.date : nd.kind === "rolling" ? "9998" : "9999"; };
    list.sort((a, b) =>
      sort === "cost" ? (a.costUSD == null ? 1e9 : a.costUSD) - (b.costUSD == null ? 1e9 : b.costUSD)
        : sort === "name" ? a.name.localeCompare(b.name)
        : dkey(a) < dkey(b) ? -1 : dkey(a) > dkey(b) ? 1 : a.name.localeCompare(b.name)
    );
    return list;
  }

  function upcomingDeadlines(limitDays) {
    const items = [];
    D.programs.forEach((p) => {
      p.app.deadlines.forEach((d) => {
        const n = daysUntil(d.date);
        if (n !== null && n >= 0 && n <= limitDays) items.push({ p, d, date: d.date });
      });
    });
    items.sort((a, b) => (a.date < b.date ? -1 : 1));
    // Collapse identical joint-application deadlines into one tile.
    const seen = {};
    return items.filter((it) => {
      const k = it.date + "|" + it.d.label;
      if (it.d.label.indexOf("Joint") === 0) { if (seen[k]) { seen[k].count++; return false; } seen[k] = it; it.count = 1; }
      return true;
    });
  }

  function renderFinder() {
    const f = filters();
    const list = filtered();
    const up = upcomingDeadlines(45);
    $app.innerHTML =
      '<div class="hero-intro"><div><h1>Find your year in Israel</h1>' +
      "<p>" + D.programs.length + " programs across the Jewish spectrum, from pluralistic and Conservative to Modern Orthodox yeshivot and seminaries. Filter to your fit, then open a program to track its application.</p></div></div>" +
      (up.length
        ? '<section class="card upcoming" aria-label="Upcoming deadlines"><h2>Deadlines in the next 45 days</h2><div class="upcoming-list">' +
          up.map((it) =>
            '<a class="upcoming-item" href="#/program/' + it.p.id + '"><span class="date">' + fmtDate(it.date, { month: "short", day: "numeric" }) + " " + countdown(it.date) + "</span>" +
            '<span class="small">' + esc(it.count > 1 ? it.d.label + " (" + it.count + " programs)" : it.p.name) + "</span>" +
            '<span class="small muted">' + esc(it.count > 1 ? "e.g. " + it.p.name : it.d.label) + "</span></a>"
          ).join("") + "</div></section>"
        : "") +
      '<div class="finder"><aside class="card filters" aria-label="Filters"><h2>Filters <button class="btn ghost sm" data-act="clear-filters">Clear</button></h2>' +
      FILTER_GROUPS.map((g) =>
        '<div class="fgroup"><h3>' + g.title + '</h3><div class="fchips">' +
        Object.keys(g.options).map((k) =>
          '<button class="fchip' + (f[g.key].indexOf(k) >= 0 ? " on" : "") + '" aria-pressed="' + (f[g.key].indexOf(k) >= 0) + '" data-act="filter" data-group="' + g.key + '" data-value="' + k + '">' + esc(g.options[k]) + "</button>"
        ).join("") + "</div></div>"
      ).join("") +
      '<div class="fgroup"><h3>Must have</h3>' +
      '<label class="check"><input type="checkbox" data-act="toggle" data-key="semester"' + (f.semester ? " checked" : "") + "> Semester option</label>" +
      '<label class="check"><input type="checkbox" data-act="toggle" data-key="credit"' + (f.credit ? " checked" : "") + "> College credit</label></div>" +
      "</aside><section>" +
      '<div class="toolbar"><input class="search" type="search" placeholder="Search programs…" aria-label="Search programs" data-act="search" value="' + esc(f.q || "") + '">' +
      '<select class="select" aria-label="Sort" data-act="sort">' +
      [["deadline", "Next deadline"], ["cost", "Tuition: low to high"], ["name", "Name"]].map((o) => '<option value="' + o[0] + '"' + ((f.sort || "deadline") === o[0] ? " selected" : "") + ">Sort: " + o[1] + "</option>").join("") +
      '</select><span class="results-count">' + list.length + " program" + (list.length === 1 ? "" : "s") + "</span></div>" +
      (list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<div class="card empty">No programs match these filters. Try clearing one.</div>') +
      "</section></div>";
  }

  function card(p) {
    const saved = !!state.saved[p.id];
    const pr = progress(p);
    return (
      '<a class="card prog" href="#/program/' + p.id + '">' +
      '<div class="prog-top"><span class="logo sm o-' + p.orientation + '">' + esc(p.short) + "</span><div><h3>" + esc(p.name) + "</h3><p>" + esc(p.operator) + "</p></div>" +
      '<button class="star' + (saved ? " on" : "") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove from" : "Add to") + ' my list">' + (saved ? "★" : "☆") + "</button></div>" +
      '<div class="chips"><span class="chip accent">' + esc(L.orientation[p.orientation]) + '</span><span class="chip">' + esc(L.gender[p.gender]) + "</span>" +
      p.cities.slice(0, 3).map((c) => '<span class="chip">' + esc(L.city[c]) + "</span>").join("") + "</div>" +
      '<dl class="mini"><div><dt>Tuition</dt><dd>' + (p.costUSD != null || p.costText.indexOf("₪") >= 0 ? esc(shortCost(p)) : '<span class="muted">' + esc(shortCost(p)) + "</span>") + "</dd></div>" +
      "<div><dt>Next deadline</dt><dd>" + deadlineSummary(p) + "</dd></div>" +
      '<div class="wide"><dt>Length</dt><dd>' + esc(p.length) + "</dd></div>" +
      (saved && pr.done > 0 ? '<div class="wide"><dt>Your application · ' + pr.pct + '%</dt><dd><div class="progress-bar"><span style="width:' + pr.pct + '%"></span></div></dd></div>' : "") +
      "</dl></a>"
    );
  }

  // ---------- Program detail ("school page") ----------
  const SECTIONS = [
    ["deadlines", "Deadlines"], ["portal", "Application portal"], ["essays", "Essays & short answers"], ["interview", "Interview"],
    ["recs", "Recommendations"], ["docs", "Documents"], ["fees", "Fees"], ["aid", "Financial aid"], ["visa", "Visa"],
    ["deferral", "College deferral"], ["decision", "Decision"],
  ];

  function badge(kind, text) {
    const t = text || { verified: "Published", partial: "Partly published", missing: "Not published", neutral: "Standard" }[kind];
    return '<span class="badge ' + kind + '">' + esc(t) + "</span>";
  }
  function section(i, key, title, badgeHtml, body) {
    return '<section class="card sec" id="sec-' + key + '"><div class="sec-head"><span class="sec-num">' + (i + 1) + "</span><h2>" + esc(title) + "</h2>" + badgeHtml + "</div>" + body + "</section>";
  }
  function unknown(text) {
    return '<p class="muted">' + esc(text || "Not published. Check the program's application portal.") + "</p>";
  }

  function sectionStatus(p) {
    // For the sidebar checklist: how far along is each section (none / some / done)?
    const s = ps(p.id);
    const frac = (vals) => (vals.length === 0 ? null : vals.filter((v) => v === "done").length === vals.length ? "done" : vals.some((v) => v !== "none") ? "some" : "none");
    const st = (v, half) => (v === "submitted" || v === "awarded" || v === "approved" || v === true ? "done" : v && half.indexOf(v) >= 0 ? "some" : "none");
    return {
      deadlines: null,
      portal: frac(allParts(p).map((n) => st(s.parts[n], ["progress"]))),
      essays: frac(allEssays(p).map((e) => st(e.status, ["progress"]))),
      interview: s.interviewDate || s.interviewNotes ? "some" : "none",
      recs: frac(s.recs.map((r) => st(r.status, ["asked"]))) || "none",
      docs: frac(p.app.documents.map((d) => st(!!s.docs[d.name], []))),
      fees: s.feePaid && (s.depositPaid || !p.app.fees.deposit) ? "done" : s.feePaid || s.depositPaid ? "some" : "none",
      aid: frac(aidItems(p).map((a) => st(s.aid[a.key], ["progress", "submitted"]))),
      visa: s.visaDone ? "done" : "none",
      deferral: frac(state.colleges.map((c) => st(c.status, ["requested"]))) || "none",
      decision: s.result === "accepted" || s.committed ? "done" : s.result ? "some" : "none",
    };
  }

  function aidItems(p) {
    return p.app.aid.program.map((name) => ({ key: "program:" + name, name, amount: null, deadline: null, url: null, kind: "Program" }))
      .concat(p.app.aid.outside.map((a) => ({ key: "outside:" + a.name, name: a.name, amount: a.amount, deadline: a.deadline, url: a.url, kind: "Outside" })));
  }

  function renderDetail(p) {
    const s = ps(p.id);
    const a = p.app;
    const saved = !!state.saved[p.id];
    const pr = progress(p);
    const nd = nextDeadline(p);

    // ---- 1. Deadlines
    const dlBody =
      (a.rolling ? '<div class="callout warn" style="margin-bottom:12px"><span aria-hidden="true">⚠</span><div><strong>Rolling admissions.</strong> Spots go to complete applications as they arrive, and popular programs can fill months before any posted date. Apply as early as you can.</div></div>' : "") +
      (a.deadlines.length
        ? '<div class="rows">' + a.deadlines.map((d) =>
            '<div class="row date-row"><div class="when">' + (d.date ? fmtDate(d.date) : '<span class="muted">Date not posted</span>') + '</div><div class="grow"><div class="title">' + esc(d.label) + ' <span class="pill ' + d.type + '">' + esc(d.type === "other" ? "Other" : d.type) + "</span></div>" +
            (d.note ? '<div class="sub">' + esc(d.note) + "</div>" : "") + "</div>" + (d.date ? countdown(d.date) : "") + "</div>"
          ).join("") + "</div>"
        : unknown("No deadlines published yet. Check the program site, and treat it as rolling until you hear otherwise."));
    const dlBadge = a.deadlines.some((d) => d.date) || a.rolling ? badge("verified") : a.deadlines.length ? badge("partial") : badge("missing");

    // ---- 2. Portal
    const portalUrl = a.portal.url || s.portalUrl;
    const portalBody =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">' +
      (portalUrl ? '<a class="btn primary" href="' + esc(portalUrl) + '" target="_blank" rel="noopener">Open ' + esc(a.portal.label) + " ↗</a>" : '<span class="muted">Portal link not published.</span>') +
      "</div>" +
      (!a.portal.url ? '<label class="field" style="margin-bottom:14px">Your portal link<input class="input" type="url" placeholder="https://…" value="' + esc(s.portalUrl || "") + '"' + bindAttr(["portalUrl"]) + "></label>" : "") +
      '<div class="rows">' +
      allParts(p).map((n, i) => {
        const extraIdx = i - a.portal.parts.length;
        return '<div class="row"><div class="grow title">' + esc(n) + "</div>" + statusSelect(["parts", n], s.parts[n], PART_STATUS, "p", n + " status") +
          (extraIdx >= 0 ? '<button class="btn ghost sm" data-act="del-part" data-i="' + extraIdx + '" aria-label="Remove ' + esc(n) + '">✕</button>' : "") + "</div>";
      }).join("") +
      '</div><div class="inline-form"><input class="input" id="np-name" placeholder="Add a part (e.g. transcript upload)" aria-label="New application part"><button class="btn sm" data-act="add-part">Add part</button></div>';

    // ---- 3. Essays
    const essayRows = a.essays.items.map((e, i) =>
      '<div class="row" style="align-items:flex-start"><div class="grow"><div class="prompt"><q>' + esc(e.prompt) + '</q><br><span class="limit">' + esc(e.limit || "No limit stated") + "</span></div></div>" +
      statusSelect(["essays", i], s.essays[i], PART_STATUS, "p", "Essay " + (i + 1) + " status") + "</div>"
    ).concat(s.customEssays.map((e, i) =>
      '<div class="row" style="align-items:flex-start"><div class="grow"><div class="prompt"><q>' + esc(e.prompt) + '</q><br><span class="limit">' + esc(e.limit || "No limit entered") + '</span> <span class="small muted">· added by you</span></div></div>' +
      statusSelect(["customEssays", i, "status"], e.status, PART_STATUS, "p", "Prompt status") +
      '<button class="btn ghost sm" data-act="del-essay" data-i="' + i + '" aria-label="Remove prompt">✕</button></div>'
    ));
    const essaysBody =
      (a.essays.verified ? '<p class="note" style="margin:0 0 12px">' + esc(a.essays.note) + "</p>" : '<div class="callout info" style="margin-bottom:12px"><span aria-hidden="true">ℹ</span><div>' + esc(a.essays.note) + " Paste each prompt below exactly as written so you can track it here.</div></div>") +
      (essayRows.length ? '<div class="rows">' + essayRows.join("") + "</div>" : "") +
      '<div class="inline-form"><input class="input" id="ce-prompt" placeholder="Paste a prompt word for word" aria-label="Essay prompt"><input class="input" id="ce-limit" placeholder="Word limit" style="flex:0 1 140px" aria-label="Word limit"><button class="btn sm" data-act="add-essay">Add prompt</button></div>';

    // ---- 4. Interview
    const iv = a.interview;
    const interviewBody =
      '<div class="kv" style="margin-bottom:12px"><div><div class="k">Interview</div><div class="v">' + (iv.required === true ? "Yes" : iv.required === false ? "No" : "Not stated") + "</div></div>" +
      '<div style="grid-column:span 2"><div class="k">Format</div><div class="v" style="font-weight:500">' + esc(iv.format || iv.note || "Not published") + "</div></div></div>" +
      '<div class="form-grid"><label class="field">Your interview date<input class="input" type="date" value="' + esc(s.interviewDate || "") + '"' + bindAttr(["interviewDate"]) + "></label></div>" +
      '<label class="field" style="margin-top:10px">Prep notes<textarea class="textarea" placeholder="Why this program? What do you want to ask them? Stories to tell…"' + bindAttr(["interviewNotes"]) + ">" + esc(s.interviewNotes || "") + "</textarea></label>";

    // ---- 5. Recommendations
    const rc = a.recs;
    const recsBody =
      '<div class="kv" style="margin-bottom:12px"><div><div class="k">How many</div><div class="v">' + (rc.count != null ? rc.count : "Not stated") + "</div></div>" +
      '<div style="grid-column:span 2"><div class="k">From whom</div><div class="v" style="font-weight:500">' + esc(rc.from || rc.note || "Not published") + "</div></div></div>" +
      (s.recs.length
        ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Recommender</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
          s.recs.map((r, i) =>
            '<tr><td><input class="input" placeholder="Name" aria-label="Recommender name" value="' + esc(r.name || "") + '"' + bindAttr(["recs", i, "name"]) + "></td>" +
            '<td><input class="input" placeholder="e.g. Tanakh teacher" aria-label="Recommender role" value="' + esc(r.role || "") + '"' + bindAttr(["recs", i, "role"]) + "></td>" +
            "<td>" + statusSelect(["recs", i, "status"], r.status, REC_STATUS, "p", "Recommendation status") + "</td>" +
            '<td><button class="btn ghost sm" data-act="del-rec" data-i="' + i + '" aria-label="Remove recommender">✕</button></td></tr>'
          ).join("") + "</tbody></table></div>"
        : "") +
      '<div class="inline-form"><button class="btn sm" data-act="add-rec">+ Add recommender</button></div>';

    // ---- 6. Documents
    const passportItem = (d) => {
      let check = "";
      if (s.passportExpiry) {
        const end = parseDate(p.endDate);
        const need = new Date(end.getFullYear(), end.getMonth() + 6, end.getDate());
        const exp = parseDate(s.passportExpiry);
        check = exp && exp >= need
          ? '<div class="callout ok small" style="margin-top:6px">✓ Valid through ' + fmtDate(need) + ", 6 months past the program's approximate end (" + fmtDate(end) + ").</div>"
          : '<div class="callout bad small" style="margin-top:6px">⚠ Renew before you apply for the visa. It should stay valid until at least ' + fmtDate(need) + ", 6 months past the program's approximate end.</div>";
      }
      return '<label class="field" style="margin-top:6px;max-width:260px">Passport expiration date<input class="input" type="date" value="' + esc(s.passportExpiry || "") + '"' + bindAttr(["passportExpiry"]) + "></label>" + check;
    };
    const docsBody = p.app.documents.map((d) =>
      '<div class="doc-check"><input type="checkbox" id="doc-' + esc(d.name) + '"' + (s.docs[d.name] ? " checked" : "") + bindAttr(["docs", d.name]) + '><div class="grow"><label for="doc-' + esc(d.name) + '" class="title" style="font-weight:600;cursor:pointer">' + esc(d.name) + '</label><div class="sub muted small">' + esc(d.note) + "</div>" +
      (d.isPassport ? passportItem(d) : "") + "</div></div>"
    ).join("");

    // ---- 7. Fees
    const fe = a.fees;
    const feesBody =
      '<div class="kv"><div><div class="k">Application fee</div><div class="v">' + esc(fe.application || "Not published") + "</div></div>" +
      '<div><div class="k">Deposit</div><div class="v">' + esc(fe.deposit || "Not published") + "</div></div>" +
      '<div><div class="k">Deposit deadline</div><div class="v">' + (fe.depositDeadline ? fmtDate(fe.depositDeadline) + " " + countdown(fe.depositDeadline) : "Not published") + "</div></div></div>" +
      (fe.note ? '<p class="note">' + esc(fe.note) + "</p>" : "") +
      '<label class="check" style="margin-top:12px"><input type="checkbox"' + (s.feePaid ? " checked" : "") + bindAttr(["feePaid"]) + "> Application fee paid</label>" +
      '<label class="check"><input type="checkbox"' + (s.depositPaid ? " checked" : "") + bindAttr(["depositPaid"]) + "> Deposit paid</label>";

    // ---- 8. Aid
    const aid = aidItems(p);
    const aidBody =
      '<div class="rows">' + aid.map((it) =>
        '<div class="row" style="align-items:flex-start"><div class="grow"><div class="title">' + esc(it.name) + ' <span class="chip">' + it.kind + "</span></div>" +
        (it.amount ? '<div class="sub">Amount: ' + esc(it.amount) + "</div>" : "") +
        (it.deadline ? '<div class="sub">Deadline: ' + esc(it.deadline) + "</div>" : "") +
        (it.url ? '<div class="sub"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">Details ↗</a></div>' : "") +
        "</div>" + statusSelect(["aid", it.key], s.aid[it.key], AID_STATUS, "p", it.name + " status") + "</div>"
      ).join("") + "</div>" +
      (!a.aid.program.length ? '<p class="note">This program has not published its own scholarships. Ask admissions directly.</p>' : "");

    // ---- 9. Visa
    const visaBody =
      '<div class="cols-2"><div class="col-box"><h4>Program handles</h4><p>' + esc(a.visa.program) + '</p></div><div class="col-box"><h4>You file</h4><p>' + esc(a.visa.student) + "</p></div></div>" +
      '<div class="callout warn" style="margin-top:12px"><span aria-hidden="true">⚠</span><div><strong>Dual citizens / children of Israelis:</strong> ' + esc(a.visa.dualCitizen) + "</div></div>" +
      '<label class="check" style="margin-top:12px"><input type="checkbox"' + (s.visaDone ? " checked" : "") + bindAttr(["visaDone"]) + "> My visa (or Israeli passport and army-status paperwork) is sorted</label>";

    // ---- 10. College deferral (shared across programs)
    const defBody =
      '<ul class="plain small">' + D.deferralGuidance.map((g) => "<li>" + esc(g) + "</li>").join("") + "</ul>" +
      '<p class="small muted" style="margin-top:12px">Your colleges appear on every program page, so you only enter them once.</p>' +
      (state.colleges.length
        ? '<div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>College</th><th>Gap year policy</th><th>Request deferral by</th><th>Status</th><th></th></tr></thead><tbody>' +
          state.colleges.map((c, i) =>
            '<tr><td><input class="input" placeholder="College" aria-label="College name" value="' + esc(c.name || "") + '"' + bindAttr(["colleges", i, "name"], "g") + "></td>" +
            '<td><input class="input" placeholder="e.g. Allowed; no outside credit" aria-label="Gap year policy" value="' + esc(c.policy || "") + '"' + bindAttr(["colleges", i, "policy"], "g") + "></td>" +
            '<td><input class="input" type="date" aria-label="Deferral request deadline" value="' + esc(c.deadline || "") + '"' + bindAttr(["colleges", i, "deadline"], "g") + ">" + (c.deadline ? " " + countdown(c.deadline) : "") + "</td>" +
            "<td>" + statusSelect(["colleges", i, "status"], c.status, DEFER_STATUS, "g", "Deferral status") + "</td>" +
            '<td><button class="btn ghost sm" data-act="del-college" data-i="' + i + '" aria-label="Remove college">✕</button></td></tr>'
          ).join("") + "</tbody></table></div>"
        : "") +
      '<div class="inline-form"><button class="btn sm" data-act="add-college">+ Add a college</button></div>';

    // ---- 11. Decision
    const dc = a.decision;
    const decisionBody =
      '<div class="form-grid">' +
      '<label class="field">Decision release' + (dc.release ? '<div class="v" style="color:var(--text)">' + fmtDate(dc.release) + "</div>" : '<input class="input" type="date" value="' + esc(s.release || "") + '"' + bindAttr(["release"]) + ">") + "</label>" +
      '<label class="field">Your result' + statusSelect(["result"], s.result, RESULT_STATUS, "p", "Your result") + "</label>" +
      '<label class="field">Commit deadline<input class="input" type="date" value="' + esc(s.commit || dc.commit || "") + '"' + bindAttr(["commit"]) + "></label></div>" +
      (dc.note ? '<p class="note">' + esc(dc.note) + "</p>" : "") +
      '<label class="check" style="margin-top:12px"><input type="checkbox"' + (s.committed ? " checked" : "") + bindAttr(["committed"]) + "> I've committed to this program</label>";

    const sections = [
      [dlBadge, dlBody],
      [a.portal.url ? badge("verified") : badge("missing"), portalBody],
      [a.essays.verified ? badge("verified", "Verbatim") : badge("missing"), essaysBody],
      [iv.required != null ? badge("verified") : badge("missing"), interviewBody],
      [rc.count != null ? badge("verified") : badge("missing"), recsBody],
      [badge("neutral", "Standard checklist"), docsBody],
      [fe.application && fe.deposit ? badge("verified") : fe.application || fe.deposit ? badge("partial") : badge("missing"), feesBody],
      [a.aid.program.length ? badge("verified") : badge("partial"), aidBody],
      [badge("neutral", "Masa A/2"), visaBody],
      [badge("neutral", "Your colleges"), defBody],
      [dc.release ? badge("verified") : dc.note ? badge("partial") : badge("missing"), decisionBody],
    ];

    // ---- Sidebar: progress, checklist, timeline, sources
    const status = sectionStatus(p);
    const tl = [];
    a.deadlines.forEach((d) => d.date && tl.push({ date: d.date, what: d.label }));
    if (a.fees.depositDeadline && !a.deadlines.some((d) => d.date === a.fees.depositDeadline)) tl.push({ date: a.fees.depositDeadline, what: "Deposit due" });
    if (s.interviewDate) tl.push({ date: s.interviewDate, what: "Your interview" });
    if (dc.release || s.release) tl.push({ date: dc.release || s.release, what: "Decision release" });
    if (s.commit || dc.commit) tl.push({ date: s.commit || dc.commit, what: "Commit deadline" });
    state.colleges.forEach((c) => c.deadline && tl.push({ date: c.deadline, what: "Deferral request: " + (c.name || "college") }));
    tl.sort((x, y) => (x.date < y.date ? -1 : 1));
    const R = 26, C = 2 * Math.PI * R;
    const ring =
      '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="7"/>' +
      '<circle cx="32" cy="32" r="' + R + '" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pr.pct / 100)).toFixed(1) + '" transform="rotate(-90 32 32)"/></svg>';

    $app.innerHTML =
      '<a class="back" href="#/">← All programs</a>' +
      '<header class="card school-head"><span class="logo o-' + p.orientation + '">' + esc(p.short) + '</span><div class="info"><h1>' + esc(p.name) + "</h1>" +
      '<p class="muted">' + esc(p.operator) + " · " + esc(p.base) + "</p>" +
      '<div class="chips"><span class="chip accent">' + esc(L.orientation[p.orientation]) + '</span><span class="chip">' + esc(L.gender[p.gender]) + '</span><span class="chip">' + esc(L.israeliPeers[p.israeliPeers]) + "</span>" +
      (p.credit ? '<span class="chip">College credit</span>' : "") + (p.semesterOption ? '<span class="chip">Semester option</span>' : "") + "</div></div>" +
      '<div class="actions"><button class="btn' + (saved ? "" : " primary") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '">' + (saved ? "★ On my list" : "☆ Add to my list") + "</button>" +
      '<a class="btn" href="' + esc(p.website) + '" target="_blank" rel="noopener">Website ↗</a></div></header>' +
      '<div class="card stats">' +
      '<div class="stat"><div class="label">Tuition</div><div class="value">' + esc(p.costUSD != null ? money(p.costUSD) : p.costText.indexOf("₪") >= 0 ? shortCost(p) : "—") + '</div><div class="sub">' + esc(p.costUSD != null ? shortCost(p) : p.costText.indexOf("₪") >= 0 ? "Priced in shekels" : p.costText) + "</div></div>" +
      '<div class="stat"><div class="label">Length</div><div class="value">' + esc(p.length.split(" · ")[0].split(" (")[0]) + '</div><div class="sub">' + esc(p.semesterOption ? "Semester option available" : "Full year") + "</div></div>" +
      '<div class="stat"><div class="label">Next deadline</div><div class="value">' + (nd.kind === "date" ? fmtDate(nd.d.date, { month: "short", day: "numeric" }) : nd.kind === "rolling" ? "Rolling" : "Not posted") + '</div><div class="sub">' + (nd.kind === "date" ? esc(nd.d.label) + " · " + countdown(nd.d.date) : nd.kind === "rolling" ? "Apply early, it can fill" : "Confirm with program") + "</div></div>" +
      '<div class="stat"><div class="label">Your application</div><div class="value">' + pr.pct + '%</div><div class="sub"><div class="progress-bar" style="margin-top:6px"><span style="width:' + pr.pct + '%"></span></div></div></div>' +
      "</div>" +
      '<nav class="tabs" aria-label="Page sections"><a href="#sec-overview" data-jump="sec-overview">Overview</a>' + SECTIONS.map((x) => '<a href="#sec-' + x[0] + '" data-jump="sec-' + x[0] + '">' + x[1] + "</a>").join("") + "</nav>" +
      '<div class="detail"><div class="sections">' +
      '<section class="card sec" id="sec-overview"><div class="sec-head"><h2>Overview</h2></div><p>' + esc(p.blurb) + "</p>" +
      '<div class="facts"><div class="fact"><div class="k">Community</div><div class="v">' + esc(L.orientation[p.orientation]) + '</div></div><div class="fact"><div class="k">Where</div><div class="v">' + esc(p.base) + "</div></div>" +
      '<div class="fact"><div class="k">Tuition</div><div class="v">' + esc(p.costText) + '</div></div><div class="fact"><div class="k">Focus</div><div class="v">' + esc(p.focus.map((f) => L.focus[f]).join(", ")) + "</div></div>" +
      '<div class="fact"><div class="k">College credit</div><div class="v">' + (p.credit === true ? "Yes" : p.credit === false ? "No" : "Not researched") + '</div></div><div class="fact"><div class="k">Israeli peers</div><div class="v">' + esc(L.israeliPeers[p.israeliPeers]) + "</div></div></div></section>" +
      '<h2 style="font-size:20px;margin:10px 0 0">Application</h2>' +
      sections.map((x, i) => section(i, SECTIONS[i][0], SECTIONS[i][1], x[0], x[1])).join("") +
      "</div>" +
      '<aside class="side">' +
      '<div class="card"><div class="ring">' + ring + '<div><div class="big">' + pr.pct + '%</div><div class="small muted">' + (pr.done % 1 ? pr.done.toFixed(1) : pr.done) + " of " + pr.total + " items done</div></div></div></div>" +
      '<div class="card"><h3>Checklist</h3><div class="toc">' + SECTIONS.map((x) => {
        const v = status[x[0]];
        return '<a href="#sec-' + x[0] + '" data-jump="sec-' + x[0] + '"><span>' + x[1] + "</span>" + (v ? '<span class="dot ' + v + '" aria-label="' + v + '"></span>' : "") + "</a>";
      }).join("") + "</div></div>" +
      '<div class="card"><h3>Key dates</h3>' + (tl.length ? '<div class="timeline">' + tl.map((t) =>
        '<div class="tl-item' + (daysUntil(t.date) < 0 ? " past" : "") + '"><div class="tl-date">' + fmtDate(t.date, { month: "short", day: "numeric" }) + '</div><div class="tl-what">' + esc(t.what) + "<br>" + countdown(t.date) + "</div></div>"
      ).join("") + "</div>" : '<p class="small muted">No dated deadlines yet. Add your interview, commit and college deferral dates and they will show up here.</p>') + "</div>" +
      '<div class="card"><h3>Sources</h3><p class="small muted">Researched ' + fmtDate(D.asOf) + ". Confirm details with the program.</p><div class=\"sources\">" +
      p.sources.map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>").join("") + "</div></div>" +
      "</aside></div>";
  }

  // ---------- My list ----------
  function renderList() {
    const list = D.programs.filter((p) => state.saved[p.id]);
    const resultLabel = (v) => (RESULT_STATUS.find((r) => r[0] === (v || "")) || RESULT_STATUS[0])[1];
    $app.innerHTML =
      '<div class="hero-intro"><div><h1>My list</h1><p>The programs you saved, sorted by next deadline. Open one to work on its application.</p></div></div>' +
      (list.length
        ? '<div class="card table-wrap"><table class="tbl list-table"><thead><tr><th>Program</th><th>Next deadline</th><th>Tuition</th><th>Progress</th><th>Result</th></tr></thead><tbody>' +
          list.sort((a, b) => {
            const k = (p) => { const nd = nextDeadline(p); return nd.kind === "date" ? nd.d.date : "9999"; };
            return k(a) < k(b) ? -1 : 1;
          }).map((p) => {
            const pr = progress(p);
            return '<tr><td><a href="#/program/' + p.id + '" style="display:flex;gap:10px;align-items:center;color:var(--text)"><span class="logo sm o-' + p.orientation + '">' + esc(p.short) + "</span><span><strong>" + esc(p.name) + '</strong><br><span class="small muted">' + esc(L.orientation[p.orientation]) + "</span></span></a></td>" +
              "<td>" + deadlineSummary(p) + "</td><td>" + esc(shortCost(p)) + "</td>" +
              '<td style="min-width:120px"><div class="small">' + pr.pct + '%</div><div class="progress-bar"><span style="width:' + pr.pct + '%"></span></div></td>' +
              "<td>" + esc(resultLabel(ps(p.id).result)) + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<div class="card empty">Nothing saved yet. Tap ☆ on any program to add it here.</div>');
  }

  // ---------- Events ----------
  function bound(el, value) {
    const path = JSON.parse(el.dataset.bind);
    if (el.dataset.scope === "g") setPath(state, path, value);
    else setPath(ps(current.id), path, value);
    save();
  }

  $app.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      e.preventDefault();
      const t = document.getElementById(jump.dataset.jump);
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    const act = el.dataset.act;
    const s = current.id ? ps(current.id) : null;
    e.preventDefault();
    e.stopPropagation();
    if (act === "save") {
      state.saved[el.dataset.id] = !state.saved[el.dataset.id];
      if (!state.saved[el.dataset.id]) delete state.saved[el.dataset.id];
    } else if (act === "filter") {
      const arr = filters()[el.dataset.group];
      const i = arr.indexOf(el.dataset.value);
      if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.value);
    } else if (act === "clear-filters") {
      state.filters = { sort: (state.filters || {}).sort };
    } else if (act === "add-rec") {
      s.recs.push({ name: "", role: "", status: "" });
    } else if (act === "del-rec") {
      s.recs.splice(+el.dataset.i, 1);
    } else if (act === "add-college") {
      state.colleges.push({ name: "", policy: "", deadline: "", status: "" });
    } else if (act === "del-college") {
      if (!confirm("Remove this college from every program page?")) return;
      state.colleges.splice(+el.dataset.i, 1);
    } else if (act === "add-essay") {
      const pr = document.getElementById("ce-prompt"), li = document.getElementById("ce-limit");
      if (!pr.value.trim()) { pr.focus(); return; }
      s.customEssays.push({ prompt: pr.value.trim(), limit: li.value.trim(), status: "" });
    } else if (act === "del-essay") {
      s.customEssays.splice(+el.dataset.i, 1);
    } else if (act === "add-part") {
      const np = document.getElementById("np-name");
      const v = np.value.trim();
      if (!v) { np.focus(); return; }
      if (allParts(byId[current.id]).indexOf(v) < 0) s.extraParts.push(v);
    } else if (act === "del-part") {
      s.extraParts.splice(+el.dataset.i, 1);
    } else return;
    save();
    render();
  });

  $app.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      const isText = el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "date" && el.type !== "checkbox");
      if (isText) return; // already saved on input; re-rendering on blur would swallow the next click
      bound(el, el.type === "checkbox" ? el.checked : el.value);
      render(); // selects, checkboxes and dates refresh progress, badges and the timeline
      return;
    }
    const act = el.dataset.act;
    if (act === "toggle") { filters()[el.dataset.key] = el.checked; save(); render(); }
    else if (act === "sort") { filters().sort = el.value; save(); render(); }
  });

  $app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.bind && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "date" && el.type !== "checkbox"))) {
      bound(el, el.value); // typing saves without re-rendering, so focus is kept
    } else if (el.dataset.act === "search") {
      filters().q = el.value;
      save();
      const pos = el.selectionStart;
      render();
      const s = $app.querySelector('[data-act="search"]');
      if (s) { s.focus(); s.setSelectionRange(pos, pos); }
    }
  });

  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  document.getElementById("as-of").textContent = fmtDate(D.asOf);
  document.getElementById("cycle").textContent = D.cycle;

  async function init() {
    if (!HAS_BACKEND) {
      state = loadLocal();
      return route();
    }
    try {
      sb = await window.GYF_SB();
    } catch (e) {
      // Not configured yet → the login page explains what's missing.
      if (e.setup) return location.replace("/login");
      state = loadLocal();
      banner("Couldn't reach the server, so changes are only saved in this browser for now.");
      return route();
    }
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return location.replace("/login");
    const user = sess.session.user;
    userId = user.id;
    document.getElementById("user-name").textContent = (user.user_metadata && user.user_metadata.name) || user.email;
    document.getElementById("account").hidden = false;
    document.getElementById("logout").addEventListener("click", async () => {
      await pushRemote();
      await sb.auth.signOut();
      location.replace("/login");
    });
    sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("/login"); });

    const { data: row, error } = await sb.from(TABLE).select("state").eq("user_id", userId).maybeSingle();
    if (error) {
      remoteOk = false;
      state = loadLocal();
      banner("Your progress is being saved in this browser only, because the account database isn't set up yet (run supabase/schema.sql).");
    } else {
      remoteOk = true;
      const local = loadLocal();
      if (row && row.state && typeof row.state === "object") state = Object.assign(blankState(), row.state);
      else if (Object.keys(local.saved).length || Object.keys(local.p).length) { state = local; save(); } // first sync
      document.getElementById("storage-note").textContent = "Your tracking data is saved to your account.";
    }
    route();
  }
  init();
})();
