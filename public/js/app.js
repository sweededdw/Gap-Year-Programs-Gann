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
  let current = { view: "quiz", id: null };
  let lastListView = "swipe"; // where "← Back" on a program page returns to
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "program" && byId[parts[1]]) current = { view: "detail", id: parts[1] };
    else if (parts[0] === "my-list") current = { view: "list", id: null };
    else if (parts[0] === "browse") current = { view: "finder", id: null };
    else if (parts[0] === "colleges") current = { view: "colleges", id: null };
    else if (parts[0] === "results") current = { view: quiz().done ? "results" : "quiz", id: null };
    else if (parts[0] === "start") current = { view: "quiz", id: null };
    else if (parts[0] === "swipe") current = { view: quiz().done ? "swipe" : "quiz", id: null };
    else current = { view: quiz().done ? "results" : "quiz", id: null };
    if (current.view !== "detail") lastListView = current.view;
    render();
  }
  const NAV_FOR = { quiz: "discover", swipe: "discover", results: "discover", finder: "finder", list: "my-list", colleges: "colleges" };
  function render() {
    if (current.view === "detail") renderDetail(byId[current.id]);
    else if (current.view === "list") renderList();
    else if (current.view === "quiz") renderQuiz();
    else if (current.view === "swipe") renderSwipe();
    else if (current.view === "colleges") renderColleges();
    else if (current.view === "results") renderResults();
    else renderFinder();
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === NAV_FOR[current.view]);
    });
    document.getElementById("saved-count").textContent = Object.keys(state.saved).filter((k) => state.saved[k] && byId[k]).length;
  }

  // ---------- Finder ----------
  const FILTER_GROUPS = [
    { key: "orientation", title: "Jewish community", options: L.orientation, match: (p, v) => p.orientation === v },
    { key: "focus", title: "Focus", options: L.focus, match: (p, v) => p.focus.indexOf(v) >= 0 },
    { key: "field", title: "Field", options: Object.keys(L.field).reduce((o, k) => ((o[k] = L.field[k][1]), o), {}), match: (p, v) => !!p.fields[v] },
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
      if (f.type && p.type !== f.type) return false;
      if (f.semester && !p.semesterOption) return false;
      if (f.credit && !p.credit) return false;
      if (q && (p.name + " " + p.operator + " " + p.base + " " + p.blurb).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const sort = f.sort || "featured";
    const dkey = (p) => { const nd = nextDeadline(p); return nd.kind === "date" ? nd.d.date : nd.kind === "rolling" ? "9998" : "9999"; };
    list.sort((a, b) =>
      sort === "cost" ? (a.costUSD == null ? 1e9 : a.costUSD) - (b.costUSD == null ? 1e9 : b.costUSD)
        : sort === "name" ? a.name.localeCompare(b.name)
        : sort === "featured" ? (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || D.programs.indexOf(a) - D.programs.indexOf(b)
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

  // ---------- Shared visuals: type badge + photo header ----------
  const TYPE_ORDER = ["gap", "mechina", "university", "movement", "service", "yeshiva", "seminary"];
  const TYPE_PLURAL = { gap: "Gap year programs", mechina: "Mechinot", university: "University", movement: "Youth movement", service: "Service", yeshiva: "Yeshivot", seminary: "Seminaries" };
  // Small line icons (inline SVG, inherit text color). Used instead of emoji.
  const SVG = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    cost: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  };
  function I(name, filled) {
    return '<svg class="ic" viewBox="0 0 24 24" width="1em" height="1em" fill="' + (filled ? "currentColor" : "none") +
      '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[name] + "</svg>";
  }
  function typeBadge(p) {
    const t = L.type[p.type] || L.type.gap;
    const g = p.gender === "men" ? " · Men only" : p.gender === "women" ? " · Women only" : "";
    return '<span class="type-badge t-' + p.type + '">' + esc(t[1]) + g + "</span>";
  }
  // A photo from the program's own site when we have one; otherwise an illustrated gradient.
  // If a photo fails to load, the illustration takes over automatically.
  function photoBox(p, cls, inner) {
    return '<div class="ph ' + cls + " g-" + p.orientation + (p.photo ? " has-photo" : "") + '">' +
      (p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-photo\');this.remove()">' : "") +
      '<div class="ph-mark" aria-hidden="true">' + esc(p.short) + "</div>" + (inner || "") + "</div>";
  }
  function compactCost(p) {
    if (p.costUSD != null) return "$" + String(Math.round(p.costUSD / 100) / 10).replace(/\.0$/, "") + "k";
    const nis = /₪\s?([\d,]+)/.exec(p.costText);
    if (nis) return "₪" + Math.round(+nis[1].replace(/,/g, "") / 1000) + "k";
    return "Price TBD";
  }
  function ratingsBox(p) {
    const prefs = quiz().answers.prefs;
    const keys = Object.keys(L.categories);
    return '<div class="fields-box ratings"><h3>How it rates <span class="small muted" style="font-weight:400">· 1–5 · ≈ = our estimate from the program type</span></h3>' +
      keys.map((k) => {
        const c = L.categories[k], r = p.profile[k], want = prefs[k] && +prefs[k].weight ? prefs[k].want : 0;
        const dots = [1, 2, 3, 4, 5].map((n) => '<span class="rdot' + (r && n <= r.v ? " on" : "") + (want === n ? " want" : "") + '"></span>').join("");
        return '<div class="rrow"><span class="rl">' + esc(c.label) + '</span><span class="rdots" title="' + esc(c.low + " → " + c.high) + '">' + dots + "</span>" +
          '<span class="rv small">' + (r ? (r.est ? "≈" : "") + r.v + " · " + esc(r.v <= 2 ? c.low : r.v >= 4 ? c.high : "In between") : '<span class="muted">Unknown</span>') + "</span></div>";
      }).join("") +
      '<p class="small muted" style="margin-top:6px">Learning style: <strong>' + esc(L.learning[p.learning]) + "</strong>" +
      (Object.keys(prefs).some((k) => +(prefs[k] || {}).weight) ? ' · <span class="rdot want" style="display:inline-block;vertical-align:middle"></span> marks what you asked for' : "") + "</p></div>";
  }
  function fieldsBox(p) {
    const keys = Object.keys(p.fields || {});
    if (!keys.length) return "";
    const picked = (quiz().answers.field || []);
    return '<div class="fields-box"><h3>Fields you can explore</h3><ul>' +
      keys.map((k) => '<li class="' + (picked.indexOf(k) >= 0 ? "match" : "") + '"><div><strong>' + esc(L.field[k][1]) + "</strong>" +
        (picked.indexOf(k) >= 0 ? ' <span class="chip ok">✓ your pick</span>' : "") + '<div class="small muted">' + esc(p.fields[k]) + "</div></div></li>").join("") +
      "</ul></div>";
  }
  function websiteLink(p, cls, extra) {
    return '<a class="' + cls + '" href="' + esc(p.website) + '" target="_blank" rel="noopener"' + (extra || "") + ">" +
      (p.websiteLabel ? esc(p.websiteLabel) : "Website") + " ↗</a>";
  }

  function renderFinder() {
    const f = filters();
    const list = filtered();
    const up = upcomingDeadlines(45);
    const activeFilters = FILTER_GROUPS.reduce((n, g) => n + f[g.key].length, 0) + (f.semester ? 1 : 0) + (f.credit ? 1 : 0);
    const typeCount = (t) => D.programs.filter((p) => p.type === t).length;
    $app.innerHTML =
      '<div class="browse-head"><div><h1>All programs</h1>' +
      '<p class="muted">' + D.programs.length + ' Israel gap years. Not sure where to start? <a href="#/start">Take the 1-minute quiz</a>.</p></div></div>' +
      (up.length
        ? '<div class="upcoming-strip" aria-label="Upcoming deadlines"><span class="us-label">Coming up</span>' +
          up.map((it) =>
            '<a href="#/program/' + it.p.id + '"><strong>' + fmtDate(it.date, { month: "short", day: "numeric" }) + "</strong> " +
            esc(it.count > 1 ? it.d.label + " (" + it.count + ")" : it.p.name) + "</a>"
          ).join("") + "</div>"
        : "") +
      '<div class="type-tabs" role="tablist" aria-label="Program type">' +
      '<button class="ttab' + (!f.type ? " on" : "") + '" data-act="type-tab" data-value="">All <span>' + D.programs.length + "</span></button>" +
      TYPE_ORDER.map((t) => '<button class="ttab' + (f.type === t ? " on" : "") + '" data-act="type-tab" data-value="' + t + '">' + TYPE_PLURAL[t] + " <span>" + typeCount(t) + "</span></button>").join("") +
      "</div>" +
      '<div class="toolbar"><input class="search" type="search" placeholder="Search by name or city…" aria-label="Search programs" data-act="search" value="' + esc(f.q || "") + '">' +
      '<select class="select" aria-label="Sort" data-act="sort">' +
      [["featured", "Featured"], ["deadline", "Next deadline"], ["cost", "Lowest tuition"], ["name", "A–Z"]].map((o) => '<option value="' + o[0] + '"' + ((f.sort || "featured") === o[0] ? " selected" : "") + ">Sort: " + o[1] + "</option>").join("") +
      '</select><button class="btn' + (f.open ? " on" : "") + '" data-act="toggle-filters" aria-expanded="' + !!f.open + '">' + I("sliders") + ' More filters' + (activeFilters ? ' <span class="count-pill">' + activeFilters + "</span>" : "") + "</button></div>" +
      (f.open
        ? '<section class="card filters-panel" aria-label="More filters">' +
          FILTER_GROUPS.filter((g) => g.key !== "gender").map((g) =>
            '<div class="fgroup"><h3>' + g.title + '</h3><div class="fchips">' +
            Object.keys(g.options).map((k) =>
              '<button class="fchip' + (f[g.key].indexOf(k) >= 0 ? " on" : "") + '" aria-pressed="' + (f[g.key].indexOf(k) >= 0) + '" data-act="filter" data-group="' + g.key + '" data-value="' + k + '">' + esc(g.options[k]) + "</button>"
            ).join("") + "</div></div>"
          ).join("") +
          '<div class="fgroup"><h3>Must have</h3><div class="fchips">' +
          '<label class="check"><input type="checkbox" data-act="toggle" data-key="semester"' + (f.semester ? " checked" : "") + "> Semester option</label>" +
          '<label class="check"><input type="checkbox" data-act="toggle" data-key="credit"' + (f.credit ? " checked" : "") + "> College credit</label></div></div>" +
          '<div class="filters-foot"><button class="btn ghost sm" data-act="clear-filters">Clear all</button><button class="btn sm primary" data-act="toggle-filters">Show ' + list.length + " programs</button></div></section>"
        : "") +
      (list.length ? '<div class="bgrid">' + list.map(card).join("") + "</div>" : '<div class="card empty">No programs match. <button class="btn sm" data-act="clear-filters">Clear filters</button></div>');
  }

  function card(p) {
    const saved = !!state.saved[p.id];
    const pr = progress(p);
    const nd = nextDeadline(p);
    const dl = nd.kind === "date" ? fmtDate(nd.d.date, { month: "short", day: "numeric" }) + " " + countdown(nd.d.date) : nd.kind === "rolling" ? "Rolling" : "Not posted";
    return (
      '<article class="card bcard" data-href="#/program/' + p.id + '">' +
      photoBox(p, "bcard-photo",
        typeBadge(p) +
        '<button class="heart' + (saved ? " on" : "") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove from" : "Save to") + ' my list">' + I("heart", saved) + "</button>") +
      '<div class="bcard-body">' +
      '<h3><a href="#/program/' + p.id + '">' + esc(p.name) + "</a></h3>" +
      '<p class="small muted">' + I("pin") + " " + esc(p.base) + "</p>" +
      '<div class="bcard-facts"><span title="' + esc(p.costText) + '">' + I("cost") + " " + esc(compactCost(p)) + "</span><span>" + I("cal") + " " + esc(p.length.split(" · ")[0].split(" (")[0]) + "</span><span>" + I("clock") + " " + dl + "</span></div>" +
      (saved && pr.done > 0 ? '<div class="progress-bar" title="Your application: ' + pr.pct + '%"><span style="width:' + pr.pct + '%"></span></div>' : "") +
      '<div class="bcard-actions">' + websiteLink(p, "btn sm") + '<a class="btn ghost sm" href="#/program/' + p.id + '">Details →</a></div>' +
      "</div></article>"
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
      (a.rolling ? '<div class="callout warn" style="margin-bottom:12px"><span aria-hidden="true">' + I("alert") + '</span><div><strong>Rolling admissions.</strong> Spots go to complete applications as they arrive, and popular programs can fill months before any posted date. Apply as early as you can.</div></div>' : "") +
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
          : '<div class="callout bad small" style="margin-top:6px">' + I("alert") + ' Renew before you apply for the visa. It should stay valid until at least ' + fmtDate(need) + ", 6 months past the program's approximate end.</div>";
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
      '<div class="callout warn" style="margin-top:12px"><span aria-hidden="true">' + I("alert") + '</span><div><strong>Dual citizens / children of Israelis:</strong> ' + esc(a.visa.dualCitizen) + "</div></div>" +
      '<label class="check" style="margin-top:12px"><input type="checkbox"' + (s.visaDone ? " checked" : "") + bindAttr(["visaDone"]) + "> My visa (or Israeli passport and army-status paperwork) is sorted</label>";

    // ---- 10. College deferral (shared across programs)
    const conflicts = p.credit === true
      ? state.colleges.map((c) => collegeInfo(c.name)).filter((ci) => ci && ci.creditLevel === "none")
      : [];
    const defBody =
      '<ul class="plain small">' + D.deferralGuidance.map((g) => "<li>" + esc(g) + "</li>").join("") + "</ul>" +
      (conflicts.length
        ? '<div class="callout bad" style="margin-top:12px"><span aria-hidden="true">' + I("alert") + '</span><div><strong>Credit conflict:</strong> this program offers college credit, but ' +
          conflicts.map((c) => esc(c.name)).join(", ") + " " + (conflicts.length > 1 ? "don't" : "doesn't") +
          " allow credit-bearing study during a deferral. Skip the credit option or ask the college before you enroll.</div></div>"
        : "") +
      '<p class="small muted" style="margin-top:12px">Your colleges appear on every program page, so you only enter them once. <a href="#/colleges">See every college\'s gap year policy →</a></p>' +
      (state.colleges.length
        ? '<div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>College</th><th>Gap year policy</th><th>Request deferral by</th><th>Status</th><th></th></tr></thead><tbody>' +
          state.colleges.map((c, i) => {
            const ci = collegeInfo(c.name);
            return '<tr><td><input class="input" placeholder="College" aria-label="College name" list="college-list" value="' + esc(c.name || "") + '"' + bindAttr(["colleges", i, "name"], "g") + ">" +
              (ci ? '<div style="margin-top:4px">' + deferBadge(ci) + " " + creditBadge(ci) + ' <a class="small" href="' + esc(ci.source) + '" target="_blank" rel="noopener">source ↗</a></div>' : "") + "</td>" +
              '<td><input class="input" placeholder="e.g. Allowed; no outside credit" aria-label="Gap year policy" value="' + esc(c.policy || "") + '"' + bindAttr(["colleges", i, "policy"], "g") + "></td>" +
              '<td><input class="input" type="date" aria-label="Deferral request deadline" value="' + esc(c.deadline || "") + '"' + bindAttr(["colleges", i, "deadline"], "g") + ">" + (c.deadline ? " " + countdown(c.deadline) : "") + "</td>" +
              "<td>" + statusSelect(["colleges", i, "status"], c.status, DEFER_STATUS, "g", "Deferral status") + "</td>" +
              '<td><button class="btn ghost sm" data-act="del-college" data-i="' + i + '" aria-label="Remove college">✕</button></td></tr>';
          }).join("") + "</tbody></table></div>"
        : "") +
      '<datalist id="college-list">' + COLLEGES.colleges.map((c) => '<option value="' + esc(c.name) + '">').join("") + "</datalist>" +
      '<div class="inline-form"><input class="input" id="new-college" list="college-list" placeholder="Start typing a college (e.g. Tufts)" aria-label="Add a college">' +
      '<button class="btn sm" data-act="add-college">+ Add college</button></div>';

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
      '<a class="back" href="' + ({ list: "#/my-list", finder: "#/browse", results: "#/results" }[lastListView] || "#/swipe") + '">← ' + ({ list: "Saved programs", finder: "All programs", results: "Your top 3" }[lastListView] || "Back to swiping") + "</a>" +
      (p.photo ? photoBox(p, "detail-banner", "") : "") +
      '<header class="card school-head' + (p.photo ? " with-banner" : "") + '"><span class="logo o-' + p.orientation + '">' + esc(p.short) + '</span><div class="info">' + typeBadge(p) + "<h1>" + esc(p.name) + "</h1>" +
      '<p class="muted">' + esc(p.operator) + " · " + esc(p.base) + "</p>" +
      '<div class="chips"><span class="chip accent">' + esc(L.orientation[p.orientation]) + '</span><span class="chip">' + esc(L.gender[p.gender]) + '</span><span class="chip">' + esc(L.israeliPeers[p.israeliPeers]) + "</span>" +
      (p.credit ? '<span class="chip">College credit</span>' : "") + (p.semesterOption ? '<span class="chip">Semester option</span>' : "") + "</div></div>" +
      '<div class="actions"><button class="btn' + (saved ? "" : " primary") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '">' + (saved ? I("heart", true) + " On my list" : I("heart") + " Add to my list") + "</button>" +
      '<a class="btn" href="' + esc(p.website) + '" target="_blank" rel="noopener">' + (p.websiteLabel ? esc(p.websiteLabel) : "Official website") + " ↗</a></div></header>" +
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
      '<div class="fact"><div class="k">College credit</div><div class="v">' + (p.credit === true ? "Yes" : p.credit === false ? "No" : "Not researched") + '</div></div><div class="fact"><div class="k">Israeli peers</div><div class="v">' + esc(L.israeliPeers[p.israeliPeers]) + "</div></div>" +
      '<div class="fact"><div class="k">Website</div><div class="v"><a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) + " ↗</a></div></div></div>" + fieldsBox(p) + ratingsBox(p) + "</section>" +
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
            return '<tr><td><a href="#/program/' + p.id + '" style="display:flex;gap:10px;align-items:center;color:var(--text)"><span class="logo sm o-' + p.orientation + '">' + esc(p.short) + "</span><span><strong>" + esc(p.name) + '</strong><br><span class="small muted">' + esc(L.type[p.type][1]) + " · " + esc(L.orientation[p.orientation]) + "</span></span></a></td>" +
              "<td>" + deadlineSummary(p) + "</td><td>" + esc(shortCost(p)) + "</td>" +
              '<td style="min-width:120px"><div class="small">' + pr.pct + '%</div><div class="progress-bar"><span style="width:' + pr.pct + '%"></span></div></td>' +
              "<td>" + esc(resultLabel(ps(p.id).result)) + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<div class="card empty">Nothing saved yet. Tap the heart on any program to add it here.</div>');
  }

  // ---------- College gap year policies ----------
  const COLLEGES = window.GYF_COLLEGES || { colleges: [], notFound: [] };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  function collegeInfo(name) {
    const n = norm(name);
    if (n.length < 3) return null;
    return COLLEGES.colleges.find((c) => norm(c.name) === n) || null;
  }
  const DEFER_LABEL = { yes: ["ok", "Deferral allowed"], case: ["warn", "Case-by-case"], no: ["bad", "No deferrals"], open: ["ok", "Open enrollment"] };
  const CREDIT_LABEL = { none: ["bad", "No college credit"], limited: ["warn", "Limited credit"], unclear: ["muted", "Credit rule not stated"] };
  const deferBadge = (c) => { const l = DEFER_LABEL[c.deferral] || ["muted", "Not stated"]; return '<span class="pbadge ' + l[0] + '">' + l[1] + "</span>"; };
  const creditBadge = (c) => { const l = CREDIT_LABEL[c.creditLevel] || CREDIT_LABEL.unclear; return '<span class="pbadge ' + l[0] + '">' + l[1] + "</span>"; };
  function collegeSummary(c) {
    return [DEFER_LABEL[c.deferral] ? DEFER_LABEL[c.deferral][1] : "", c.deadline ? "request by " + c.deadline : "", c.credit || ""].filter(Boolean).join(" · ");
  }
  const COLLEGE_TABS = [["all", "All"], ["public", "Public"], ["private", "Private"], ["defer", "Allows deferral"], ["nocredit", "No college credit"]];
  function hillelLine(c) {
    const h = c.hillel;
    if (!h) return "";
    return '<p class="hillel-line small">' + (h.rank ? "Hillel #" + h.rank + " · " : "") + Number(h.jewish).toLocaleString("en-US") + " Jewish undergrads · " + esc(h.type) + "</p>";
  }
  function renderColleges() {
    const q = norm(state.collegeQuery || "");
    const tab = state.collegeTab || "all";
    const rank = (c) => (c.hillel && c.hillel.rank) || 999;
    const list = COLLEGES.colleges.filter((c) => {
      if (q && norm(c.name).indexOf(q) < 0) return false;
      const t = c.hillel && c.hillel.type;
      if (tab === "public" && t !== "Public") return false;
      if (tab === "private" && t !== "Private") return false;
      if (tab === "defer" && !(c.deferral === "yes" || c.deferral === "case" || c.deferral === "open")) return false;
      if (tab === "nocredit" && c.creditLevel !== "none") return false;
      return true;
    }).sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
    const notFound = (COLLEGES.notFound || []).map((n) => (typeof n === "string" ? { name: n } : n))
      .filter((n) => (!q || norm(n.name).indexOf(q) >= 0) && (tab === "all" || (tab === "public" && n.hillel && n.hillel.type === "Public") || (tab === "private" && n.hillel && n.hillel.type === "Private")))
      .sort((x, y) => rank(x) - rank(y));
    $app.innerHTML =
      '<div class="browse-head"><div><h1>College gap year policies</h1>' +
      '<p class="muted">The ' + (COLLEGES.top || 100) + ' colleges with the most Jewish students (Hillel International, 2025): whether you can defer for a gap year, when to ask, and how gap-year credits and grades are treated. Researched ' + fmtDate(COLLEGES.asOf) + " from each college's own website. Always confirm with the college.</p></div></div>" +
      '<div class="callout info" style="margin-bottom:14px"><span aria-hidden="true">' + I("info") + '</span><div><strong>Why credit matters:</strong> Israel programs that give college credit (Year Course, Kivunim, Aardvark/JTS, TAU, Hebrew U, Bar-Ilan) can clash with colleges marked <span class="pbadge bad">No college credit</span>. Skip the credit option or get written approval first.</div></div>' +
      '<div class="type-tabs" role="tablist">' + COLLEGE_TABS.map((t) => '<button class="ttab' + (tab === t[0] ? " on" : "") + '" data-act="college-tab" data-value="' + t[0] + '">' + t[1] + "</button>").join("") + "</div>" +
      '<div class="toolbar"><input class="search" type="search" placeholder="Search colleges…" aria-label="Search colleges" data-act="college-search" value="' + esc(state.collegeQuery || "") + '"><span class="results-count">' + list.length + " with published policies</span></div>" +
      '<div class="college-grid">' + list.map((c) =>
        '<article class="card college">' +
        '<div class="college-head"><h3>' + esc(c.name) + "</h3>" + hillelLine(c) + '<div class="chips">' + deferBadge(c) + creditBadge(c) + (c.noApplyingElsewhere ? '<span class="pbadge warn">Can\'t apply elsewhere</span>' : "") + "</div></div>" +
        '<dl class="college-facts">' +
        "<div><dt>Request by</dt><dd>" + (c.deadline ? esc(c.deadline) + (c.deadlineDate ? " " + countdown(c.deadlineDate) : "") : '<span class="muted">Not stated</span>') + "</dd></div>" +
        "<div><dt>How long</dt><dd>" + esc(c.length || "Not stated") + "</dd></div>" +
        '<div class="wide"><dt>How to ask</dt><dd>' + esc(c.how || "Not stated") + (c.deposit ? " Requires your enrollment deposit." : "") + "</dd></div>" +
        '<div class="wide"><dt>Credit during the gap year</dt><dd>' + esc(c.credit || "Not stated. Ask admissions.") + "</dd></div>" +
        (c.grades ? '<div class="wide"><dt>Grades & credits from the gap year</dt><dd>' + esc(c.grades) + "</dd></div>" : "") +
        (c.israel ? '<div class="wide"><dt>Israel programs</dt><dd>' + esc(c.israel) + "</dd></div>" : "") +
        "</dl>" +
        (c.quote ? '<blockquote class="college-quote">“' + esc(c.quote) + "”</blockquote>" : "") +
        (c.note ? '<p class="small" style="color:var(--warn)">' + I("alert") + ' ' + esc(c.note) + "</p>" : "") +
        (c.source ? '<a class="small" href="' + esc(c.source) + '" target="_blank" rel="noopener">Source: ' + esc(c.source.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]) + " ↗</a>" : "") + "</article>"
      ).join("") + "</div>" +
      (notFound.length
        ? '<section class="card" style="padding:16px;margin-top:16px"><h3 style="font-size:15px">No published policy found (' + notFound.length + ')</h3><p class="small muted" style="margin-top:4px">We couldn\'t find a current official gap year policy for these. Ask the college\'s admissions office directly:</p><p class="small" style="margin-top:8px">' +
          notFound.map((n) => esc(n.name) + (n.hillel && n.hillel.rank ? ' <span class="muted">(#' + n.hillel.rank + ")</span>" : "")).join(" · ") + "</p></section>"
        : "");
  }

  // ---------- Discover: quick quiz ----------
  // ---------- Matching model ----------
  // 1) Dealbreakers knock programs out before scoring (religious environment, setting, budget, length).
  // 2) For each category the user picks what they want (1–5) and how much they care (weight 0–3).
  // 3) Fit per category = 1 − |want − program rating| / 4. Match = weighted average of fits.
  const CATS = L.categories;
  // Screen 2: one row per category, a 1–5 scale (with short end labels) or "Don't care".
  const PREF_ROWS = [
    ["academics", "Light", "Intense"],
    ["social", "Quiet", "Lively"],
    ["internships", "None", "A big part"],
    ["service", "A little", "A lot"],
    ["independence", "Dorm & meals", "Own apartment"],
    ["peers", "Americans", "Israelis"],
    ["adventure", "Chill", "Lots"],
  ];
  const BUDGET_MAX = { u15: 15000, "15-25": 25000, "25-35": 35000, o35: Infinity };
  // Screen 1: dealbreakers. Anything left blank doesn't filter.
  const DEAL = {
    orientation: { q: "Which communities feel right?", multi: true,
      options: [["pluralistic", "", "Pluralistic"], ["conservative", "", "Conservative"], ["reform", "", "Reform"], ["mo-coed", "", "Modern Orthodox"], ["orthodox", "", "Yeshiva / seminary"], ["secular", "", "Secular"]] },
    budget: { q: "Tuition budget", multi: false,
      options: [["u15", "", "Up to $15k"], ["15-25", "", "Up to $25k"], ["25-35", "", "Up to $35k"], ["o35", "", "No limit"]] },
    gender: { q: "Setting", multi: false, options: [["coed", "", "Co-ed"], ["men", "", "Men's"], ["women", "", "Women's"]] },
    hebrew: { q: "Your Hebrew right now", multi: false, anyLabel: "Skip",
      options: [["none", "", "None yet"], ["basic", "", "Basics"], ["conversational", "", "Conversational"], ["fluent", "", "Fluent"]] },
    must: { q: "Must-haves", multi: true, options: [["semester", "", "Semester option"], ["credit", "", "College credit"]] },
  };
  const TOTAL_STEPS = 2;
  // Hebrew level → the program Hebrew rating (1–5) that suits it. Programs far above your level score lower;
  // English-friendly programs cost a fluent speaker a little. A beginner skips programs taught fully in Hebrew (rating 5).
  const HEB_TARGET = { none: 2, basic: 3, conversational: 4, fluent: 5 };
  const HEB_NAME = { none: "none yet", basic: "basics", conversational: "conversational", fluent: "fluent" };
  function hebrewFit(level, r) { const t = HEB_TARGET[level]; return r > t ? Math.max(0, 1 - (r - t) / 3) : 1 - (t - r) / 6; }

  function quiz() {
    let q = state.quiz;
    if (!q || q.v !== 3) q = state.quiz = { v: 3, step: 0, done: false, answers: {} }; // older quiz format: start fresh
    const a = q.answers;
    a.deal = a.deal || {};
    a.prefs = a.prefs || {};
    a.field = a.field || [];
    a.city = a.city || [];
    return q;
  }

  function catLabel(k) {
    if (CATS[k]) return CATS[k].label;
    if (k === "learning") return "Learning style";
    if (k === "city") return "Location";
    if (k === "hebrewLevel") return "Hebrew level";
    if (k.indexOf("field:") === 0) return L.field[k.slice(6)][1];
    return k;
  }

  function matches(answers) {
    const a = answers || quiz().answers;
    const d = a.deal || {}, prefs = a.prefs || {};
    const out = [];
    D.programs.forEach((p) => {
      // --- dealbreakers ---
      if (d.orientation && d.orientation.length && d.orientation.indexOf(p.orientation) < 0) return;
      if (d.gender && d.gender.length && p.gender !== d.gender[0]) return;
      if (d.budget && d.budget.length && p.costUSD != null && p.costUSD > BUDGET_MAX[d.budget[0]]) return;
      if (d.must && d.must.indexOf("semester") >= 0 && !p.semesterOption) return;
      if (d.must && d.must.indexOf("credit") >= 0 && p.credit !== true) return;
      const heb = d.hebrew && d.hebrew[0], hr = p.profile.hebrew;
      if (heb === "none" && hr && hr.v >= 5) return;
      // --- weighted fit ---
      let totW = 0, tot = 0;
      const parts = [];
      const add = (k, w, fit, extra) => { totW += w; tot += w * fit; parts.push(Object.assign({ k, w, fit }, extra || {})); };
      Object.keys(CATS).forEach((k) => {
        const pref = prefs[k];
        if (k === "hebrew") return; // asked as your current level on screen 1 instead
        if (!pref || !pref.want || !+pref.weight) return;
        const r = p.profile[k];
        if (!r) return add(k, +pref.weight, 0.5, { unknown: true, want: pref.want });
        add(k, +pref.weight, 1 - Math.abs(pref.want - r.v) / 4, { want: pref.want, have: r.v, est: r.est });
      });
      if (heb && hr) add("hebrewLevel", 2, hebrewFit(heb, hr.v), { level: heb, have: hr.v, est: hr.est });
      if (a.learning && a.learning !== "any") {
        const fit = p.learning === a.learning ? 1 : p.learning === "both" || a.learning === "both" ? 0.6 : 0;
        add("learning", 2, fit);
      }
      if (a.city.length) add("city", 2, a.city.some((c) => p.cities.indexOf(c) >= 0) ? 1 : 0);
      a.field.forEach((f) => add("field:" + f, 2, p.fields[f] ? 1 : 0));
      const score = totW ? tot / totW : 0;
      const strong = parts.filter((x) => x.fit >= 0.75).sort((x, y) => y.w * y.fit - x.w * x.fit);
      const weak = parts.filter((x) => x.fit <= 0.25 && x.w >= 2).sort((x, y) => y.w - x.w);
      out.push({ p, score, pct: totW ? Math.round(score * 100) : null, parts, strong, weak,
        reasons: strong.slice(0, 5).map((x) => catLabel(x.k)) });
    });
    const dkey = (p) => { const nd = nextDeadline(p); return nd.kind === "date" ? nd.d.date : "9999"; };
    out.sort((x, y) => y.score - x.score || (dkey(x.p) < dkey(y.p) ? -1 : 1));
    return out;
  }

  const PROPER = /^(Jewish|Hebrew|Israel|Middle|Tel|Jerusalem|Torah|Kibbutz)\b/;
  function listPhrase(arr) {
    const l = arr.map((s) => (PROPER.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)));
    return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1];
  }
  function whyLine(m) {
    if (!m.parts.length) return "Fits your dealbreakers. Add preferences to rank it.";
    const s = m.strong.slice(0, 2).map((x) => catLabel(x.k));
    return s.length ? "Matched on " + listPhrase(s) + "." : "A partial match on your preferences.";
  }

  function choiceGroup(key, def, picked, act) {
    return '<div class="qgroup"><h3>' + esc(def.q) + "</h3>" + (def.sub ? '<p class="small muted">' + esc(def.sub) + "</p>" : "") +
      '<div class="qchips">' +
      '<button class="qchip any' + (!picked.length ? " on" : "") + '" aria-pressed="' + !picked.length + '" data-act="' + act + '" data-key="' + key + '" data-value="__any">' + (def.anyLabel || "Any") + "</button>" +
      def.options.map((o) => {
        const on = picked.indexOf(o[0]) >= 0;
        return '<button class="qchip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-act="' + act + '" data-key="' + key + '" data-value="' + o[0] + '">' + esc(o[2]) + "</button>";
      }).join("") + "</div></div>";
  }
  function prefRow(row) {
    const k = row[0], c = CATS[k];
    const pref = quiz().answers.prefs[k] || {};
    return '<div class="prow' + (pref.want ? " active" : "") + '"><span class="prow-label">' + esc(c.label) + "</span>" +
      '<div class="prow-scale"><span class="pend">' + esc(row[1]) + '</span><div class="pnums" role="group" aria-label="' + esc(c.label) + ': 1 = ' + esc(row[1]) + ", 5 = " + esc(row[2]) + '">' +
      [1, 2, 3, 4, 5].map((n) => {
        const on = pref.want === n;
        return '<button class="pnum' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-act="pref-pick" data-key="' + k + '" data-value="' + n + '">' + n + "</button>";
      }).join("") +
      '</div><span class="pend">' + esc(row[2]) + "</span></div>" +
      '<button class="popt dc' + (!pref.want ? " on" : "") + '" aria-pressed="' + !pref.want + '" data-act="pref-pick" data-key="' + k + '" data-value="0">Don\'t care</button>' +
      "</div>";
  }

  function renderQuiz() {
    const q = quiz();
    const a = q.answers;
    if (q.step === 0) {
      $app.innerHTML =
        '<section class="quiz quiz-intro">' +
        "<h1>Find your year in Israel</h1>" +
        '<p class="muted">Two quick screens, then your top 3 matches.</p>' +
        '<button class="btn primary big" data-act="quiz-next">Start →</button>' +
        '<p class="small muted">or <a href="#/browse">browse all ' + D.programs.length + " programs</a>" +
        (q.done ? ' · <a href="#/results">back to my top 3</a>' : "") + "</p></section>";
      return;
    }
    const count = matches().length;
    const last = q.step === TOTAL_STEPS;
    let body;
    if (q.step === 1) {
      body = "<h1>The basics</h1>" +
        '<p class="muted">These rule programs out. Leave a group on "Any" if it doesn\'t matter.</p>' +
        Object.keys(DEAL).map((k) => choiceGroup(k, DEAL[k], a.deal[k] || [], "deal-pick")).join("");
    } else {
      body = "<h1>What matters to you?</h1>" +
        '<p class="muted">Rate each from 1 to 5, or "Don\'t care".</p>' +
        '<div class="prows">' + PREF_ROWS.map(prefRow).join("") + "</div>" +
        '<details class="extras"' + (a.field.length || a.city.length ? " open" : "") + "><summary>Optional: a field or city you have in mind</summary>" +
        choiceGroup("field", { q: "Field (up to 3)", anyLabel: "Don't care", options: Object.keys(L.field).map((k) => [k, L.field[k][0], L.field[k][1]]) }, a.field, "field-pick") +
        choiceGroup("city", { q: "Where", anyLabel: "Don't care", options: [["jerusalem", "", "Jerusalem"], ["tel-aviv", "", "Tel Aviv"], ["kibbutz", "", "Kibbutz"], ["north", "", "The North"], ["abroad", "", "Travel abroad"]] }, a.city, "city-pick") +
        "</details>";
    }
    $app.innerHTML =
      '<section class="quiz">' +
      '<div class="quiz-top"><button class="btn ghost sm" data-act="quiz-back">← Back</button>' +
      '<div class="quiz-dots" aria-label="Step ' + q.step + " of " + TOTAL_STEPS + '">' +
      Array.from({ length: TOTAL_STEPS }, (_, i) => '<span class="' + (i < q.step - 1 ? "done" : i === q.step - 1 ? "now" : "") + '"></span>').join("") +
      '</div><span class="small muted">' + q.step + " / " + TOTAL_STEPS + "</span></div>" +
      body +
      '<div class="quiz-foot"><span class="live-count"><strong>' + count + "</strong> program" + (count === 1 ? "" : "s") + " fit your basics</span>" +
      '<button class="btn primary" data-act="' + (last ? "quiz-finish" : "quiz-next") + '"' + (last && !count ? " disabled" : "") + ">" +
      (last ? "See my top 3 →" : "Next →") + "</button></div>" +
      (count === 0 ? '<div class="callout warn" style="margin-top:14px">No programs fit all of these. Try adding a community or raising the budget.</div>' : "") +
      "</section>";
  }

  // ---------- Results: top 3 with breakdown ----------
  function breakdownRows(m) {
    return m.parts.slice().sort((x, y) => y.w - x.w || y.fit - x.fit).map((x) => {
      const c = CATS[x.k];
      const cls = x.fit >= 0.75 ? "good" : x.fit >= 0.5 ? "ok" : "bad";
      const mark = x.fit >= 0.75 ? "✓" : x.fit >= 0.5 ? "~" : "✕";
      return '<li class="' + cls + '"><span class="bm">' + mark + "</span>" + esc(catLabel(x.k)) +
        (c && !x.unknown ? '<span class="bv">you ' + x.want + " · " + (x.est ? "≈" : "") + x.have + "</span>" : "") +
        (x.k === "hebrewLevel" ? '<span class="bv">you: ' + HEB_NAME[x.level] + " · program " + (x.est ? "≈" : "") + x.have + "/5</span>" : "") + "</li>";
    }).join("");
  }
  function renderResults() {
    const all = matches();
    const top = all.slice(0, 3);
    if (!top.length) { $app.innerHTML = '<section class="quiz quiz-intro"><h1>No programs pass your dealbreakers</h1><button class="btn primary" data-act="retake">Change my answers</button></section>'; return; }
    $app.innerHTML =
      '<section class="results">' +
      '<div class="results-head"><div><h1>Your top 3</h1><p class="muted">Best fits out of ' + all.length + " programs.</p></div>" +
      '<div class="swipe-head-actions"><button class="btn ghost sm" data-act="retake">Change answers</button><button class="btn sm" data-act="restart">' + I("undo") + ' Retake quiz</button></div></div>' +
      '<div class="top3">' + top.map((m, i) => {
        const p = m.p, saved = !!state.saved[p.id];
        return '<article class="card topcard">' +
          photoBox(p, "top-photo", '<span class="rank">#' + (i + 1) + "</span>" + typeBadge(p) +
            '<button class="heart' + (saved ? " on" : "") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '" aria-label="Save">' + I("heart", saved) + "</button>") +
          '<div class="topcard-body"><div class="tc-title"><h2><a href="#/program/' + p.id + '">' + esc(p.name) + "</a></h2>" +
          (m.pct != null ? '<span class="match-pill">' + m.pct + "% match</span>" : "") + "</div>" +
          '<p class="why">' + esc(whyLine(m)) + "</p>" +
          (m.weak.length ? '<p class="small weak">Weaker on ' + esc(listPhrase(m.weak.slice(0, 1).map((x) => catLabel(x.k)))) + ".</p>" : "") +
          (m.parts.length ? '<details class="more"><summary>See breakdown</summary><ul class="blist">' + breakdownRows(m) + "</ul></details>" : "") +
          '<div class="bcard-actions">' + websiteLink(p, "btn sm") + '<a class="btn sm primary" href="#/program/' + p.id + '">Details →</a></div>' +
          "</div></article>";
      }).join("") + "</div>" +
      '<div class="results-foot"><a class="btn primary big" href="#/swipe">Swipe through all ' + all.length + " matches →</a>" +
      '<p class="small muted">In a breakdown, "you 5 · ≈4" = you wanted 5, the program rates about 4 (≈ = our estimate).</p></div>' +
      "</section>";
  }

  // ---------- Discover: swipe deck ----------
  function deck() {
    const passed = state.passed || {};
    return matches().filter((m) => !state.saved[m.p.id] && !passed[m.p.id]);
  }
  function swipeCard(m, i) {
    const p = m.p;
    const nd = nextDeadline(p);
    const deadline = nd.kind === "date" ? fmtDate(nd.d.date, { month: "short", day: "numeric" }) + " " + countdown(nd.d.date) : nd.kind === "rolling" ? "Rolling — apply early" : "Not posted yet";
    return (
      '<article class="scard' + (i === 0 ? " top" : "") + '" data-id="' + p.id + '" style="--i:' + i + '"' + (i === 0 ? ' tabindex="0" aria-label="' + esc(p.name) + '"' : ' aria-hidden="true"') + ">" +
      '<div class="scard-hero ph g-' + p.orientation + (p.photo ? " has-photo" : "") + '">' +
      (p.photo ? '<img src="' + esc(p.photo) + '" alt="" draggable="false" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-photo\');this.remove()">' : "") +
      '<span class="stamp like" aria-hidden="true">SAVE</span><span class="stamp nope" aria-hidden="true">PASS</span>' +
      (m.pct != null ? '<span class="scard-match">' + m.pct + "% match</span>" : "") +
      '<div class="scard-mark ph-mark" aria-hidden="true">' + esc(p.short) + "</div>" +
      '<div class="scard-title">' + typeBadge(p) + ' <span class="scard-tag">' + esc(L.orientation[p.orientation]) + "</span><h2>" + esc(p.name) + "</h2>" +
      "<p>" + I("pin") + " " + esc(p.base) + "</p></div></div>" +
      '<div class="scard-body">' +
      '<div class="scard-stats"><div>' + I("cost") + "<strong>" + esc(shortCost(p)) + "</strong></div><div>" + I("cal") + "<strong>" + esc(p.length.split(" · ")[0]) + '</strong></div><div>' + I("clock") + "<strong>" + deadline + "</strong></div></div>" +
      '<p class="scard-blurb">' + esc(p.blurb) + "</p>" +
      (m.reasons.length ? '<div class="chips">' + m.reasons.slice(0, 5).map((r) => '<span class="chip ok">✓ ' + esc(r) + "</span>").join("") + "</div>" : "") +
      '<div class="scard-links">' +
      '<a class="btn sm" href="' + esc(p.website) + '" target="_blank" rel="noopener" tabindex="' + (i === 0 ? 0 : -1) + '">' + (p.websiteLabel ? esc(p.websiteLabel) : "Visit website") + " ↗</a>" +
      '<a class="btn ghost sm" href="#/program/' + p.id + '" tabindex="' + (i === 0 ? 0 : -1) + '">Full details →</a></div>' +
      "</div></article>"
    );
  }
  function renderSwipe() {
    const all = matches();
    const d = deck();
    const savedHere = all.filter((m) => state.saved[m.p.id]).length;
    const seen = all.length - d.length;
    const hist = (state.swipeHistory || []).length;
    if (!d.length) {
      $app.innerHTML =
        '<section class="quiz quiz-intro"><h1>' + (all.length ? "You've seen all your matches" : "No matches yet") + "</h1>" +
        '<p class="muted">' + (all.length ? "You saved <strong>" + savedHere + "</strong> of " + all.length + " programs." : "Try the quiz again with fewer must-haves.") + "</p>" +
        '<div class="end-actions">' +
        (savedHere ? '<a class="btn primary big" href="#/my-list">See my saved programs</a>' : "") +
        (all.length > savedHere ? '<button class="btn" data-act="swipe-reset">Review the ones I passed</button>' : "") +
        '<button class="btn" data-act="retake">Change answers</button><button class="btn" data-act="restart">' + I("undo") + ' Retake quiz</button><a class="btn ghost" href="#/browse">Browse all programs</a></div>' +
        (hist ? '<p class="small"><button class="btn ghost sm" data-act="swipe-undo">' + I("undo") + ' Undo last swipe</button></p>' : "") + "</section>";
      return;
    }
    $app.innerHTML =
      '<section class="swipe">' +
      '<div class="swipe-head"><div><h1>Your matches</h1><p class="small muted">' + (seen + 1) + " of " + all.length + " · " + savedHere + ' saved</p></div>' +
      '<div class="swipe-head-actions"><a class="btn ghost sm" href="#/results">Top 3</a><button class="btn ghost sm" data-act="retake">Change answers</button></div></div>' +
      '<div class="swipe-stage">' + d.slice(0, 3).map(swipeCard).reverse().join("") + "</div>" +
      '<div class="swipe-actions">' +
      '<button class="sbtn small" data-act="swipe-undo"' + (hist ? "" : " disabled") + ' aria-label="Undo last swipe" title="Undo">' + I("undo") + '</button>' +
      '<button class="sbtn nope" data-act="swipe-pass" aria-label="Pass" title="Pass (←)">' + I("x") + '</button>' +
      '<button class="sbtn small info" data-act="swipe-info" aria-label="See full details" title="Details (↑)">' + I("info") + '</button>' +
      '<button class="sbtn like" data-act="swipe-like" aria-label="Save for later" title="Save (→)">' + I("heart", true) + '</button>' +
      "</div>" +
      '<p class="swipe-hint small muted">Drag the card right to save, left to pass, or tap it for full details. Arrow keys work too.</p>' +
      "</section>";
    bindDrag();
  }

  let animating = false;
  // After a trackpad swipe, ignore wheel events until the trackpad's momentum stream goes quiet,
  // so one swipe never carries over to the next card.
  let wheelLocked = false, wheelUnlockTimer = null;
  function lockWheel() {
    wheelLocked = true;
    clearTimeout(wheelUnlockTimer);
    wheelUnlockTimer = setTimeout(() => { wheelLocked = false; }, 250);
  }
  function decide(kind) {
    const card = $app.querySelector(".scard.top");
    if (!card || animating) return;
    const id = card.dataset.id;
    animating = true;
    card.style.transition = "transform .28s ease-in, opacity .28s ease-in";
    card.style.transform = "translate(" + (kind === "like" ? 140 : -140) + "%, 30px) rotate(" + (kind === "like" ? 22 : -22) + "deg)";
    card.style.opacity = "0";
    card.style.setProperty(kind === "like" ? "--like" : "--nope", 1);
    setTimeout(() => {
      animating = false;
      if (kind === "like") state.saved[id] = true;
      else (state.passed = state.passed || {})[id] = true;
      state.swipeHistory = (state.swipeHistory || []).concat([{ id: id, kind: kind }]).slice(-30);
      save();
      render();
    }, 260);
  }
  function undoSwipe() {
    const h = state.swipeHistory || [];
    const lastMove = h.pop();
    if (!lastMove) return;
    if (lastMove.kind === "like") delete state.saved[lastMove.id];
    else if (state.passed) delete state.passed[lastMove.id];
    save();
    if (current.view !== "swipe") location.hash = "#/swipe"; else render();
  }
  function bindDrag() {
    const card = $app.querySelector(".scard.top");
    if (!card) return;
    let sx = 0, sy = 0, dx = 0, dy = 0, down = false;
    card.addEventListener("pointerdown", (e) => {
      if (animating || e.button > 0 || e.target.closest("a, button")) return; // let links work normally
      down = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      card.setPointerCapture(e.pointerId);
      card.style.transition = "none";
    });
    card.addEventListener("pointermove", (e) => {
      if (!down) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = "translate(" + dx + "px," + dy * 0.4 + "px) rotate(" + dx / 16 + "deg)";
      card.style.setProperty("--like", Math.max(0, Math.min(1, dx / 110)));
      card.style.setProperty("--nope", Math.max(0, Math.min(1, -dx / 110)));
    });
    const end = () => {
      if (!down) return;
      down = false;
      if (dx > 100) return decide("like");
      if (dx < -100) return decide("pass");
      card.style.transition = "transform .2s ease";
      card.style.transform = "";
      card.style.setProperty("--like", 0);
      card.style.setProperty("--nope", 0);
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) location.hash = "#/program/" + card.dataset.id; // a tap opens details
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);

    // Two-finger trackpad swipe (Mac) and horizontal mouse wheels: the card follows your fingers.
    const stage = $app.querySelector(".swipe-stage");
    let wx = 0, idle = null;
    stage.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scrolling still scrolls the page
      e.preventDefault(); // also stops the browser's swipe-to-go-back gesture
      if (animating || wheelLocked) { lockWheel(); return; } // still inside the last swipe's momentum
      wx -= e.deltaX;
      card.style.transition = "none";
      card.style.transform = "translate(" + wx + "px,0) rotate(" + wx / 16 + "deg)";
      card.style.setProperty("--like", Math.max(0, Math.min(1, wx / 110)));
      card.style.setProperty("--nope", Math.max(0, Math.min(1, -wx / 110)));
      clearTimeout(idle);
      if (Math.abs(wx) > 120) {
        lockWheel();
        return decide(wx > 0 ? "like" : "pass");
      }
      idle = setTimeout(() => { // fingers lifted before the threshold: spring back
        wx = 0;
        card.style.transition = "transform .2s ease";
        card.style.transform = "";
        card.style.setProperty("--like", 0);
        card.style.setProperty("--nope", 0);
      }, 180);
    }, { passive: false });
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = "#/program/" + card.dataset.id; });
  }
  document.addEventListener("keydown", (e) => {
    if (current.view !== "swipe" || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); decide("like"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); decide("pass"); }
    else if (e.key === "ArrowUp") { const c = $app.querySelector(".scard.top"); if (c) { e.preventDefault(); location.hash = "#/program/" + c.dataset.id; } }
    else if ((e.key === "z" && (e.metaKey || e.ctrlKey)) || e.key === "Backspace") { e.preventDefault(); undoSwipe(); }
  });

  function quizAct(act, el) {
    const q = quiz();
    const a = q.answers;
    const k = el && el.dataset.key, v = el && el.dataset.value;
    if (v === "__any") { // "Any" / "No preference" clears that group
      if (act === "deal-pick") a.deal[k] = [];
      else if (act === "field-pick") a.field = [];
      else if (act === "city-pick") a.city = [];
      save(); const y0 = window.scrollY; render(); window.scrollTo(0, y0); return;
    }
    if (act === "deal-pick") {
      const def = DEAL[k];
      let arr = (a.deal[k] || []).slice();
      const i = arr.indexOf(v);
      if (def.multi) { if (i >= 0) arr.splice(i, 1); else arr.push(v); }
      else arr = i >= 0 ? [] : [v];
      a.deal[k] = arr;
    } else if (act === "pref-pick") {
      const cur = a.prefs[k] && a.prefs[k].want;
      a.prefs[k] = !+v || cur === +v ? { want: 0, weight: 0 } : { want: +v, weight: 2 };
    }
    else if (act === "city-pick") { const i = a.city.indexOf(v); if (i >= 0) a.city.splice(i, 1); else a.city.push(v); }
    else if (act === "field-pick") { const i = a.field.indexOf(v); if (i >= 0) a.field.splice(i, 1); else { if (a.field.length >= 3) a.field.shift(); a.field.push(v); } }
    else if (act === "quiz-next") { q.step = Math.min(TOTAL_STEPS, q.step + 1); save(); render(); window.scrollTo(0, 0); return; }
    else if (act === "quiz-back") { q.step = Math.max(0, q.step - 1); save(); render(); window.scrollTo(0, 0); return; }
    else if (act === "quiz-finish") {
      q.done = true; q.step = 0;
      state.passed = {}; state.swipeHistory = [];
      save();
      if (location.hash === "#/results") route(); else location.hash = "#/results";
      window.scrollTo(0, 0);
      return;
    }
    save();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y); // keep your place while tapping options
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
    if (!el) {
      const cardEl = e.target.closest("[data-href]");
      if (cardEl && !e.target.closest("a, button, input, label")) location.hash = cardEl.dataset.href;
      return;
    }
    if (el.tagName === "INPUT" || el.tagName === "SELECT") return;
    const act = el.dataset.act;
    const s = current.id ? ps(current.id) : null;
    e.preventDefault();
    e.stopPropagation();
    if (/^(quiz-|deal-pick|pref-pick|city-pick|field-pick)/.test(act)) return quizAct(act, el);
    if (act === "swipe-like") return decide("like");
    if (act === "swipe-pass") return decide("pass");
    if (act === "swipe-undo") return undoSwipe();
    if (act === "swipe-info") { const c = $app.querySelector(".scard.top"); if (c) location.hash = "#/program/" + c.dataset.id; return; }
    if (act === "swipe-reset") { state.passed = {}; save(); return render(); }
    if (act === "restart") {
      if (!confirm("Start the quiz over? Your answers will be cleared. Saved programs stay saved.")) return;
      state.quiz = { v: 3, step: 1, done: false, answers: {} };
      state.passed = {}; state.swipeHistory = [];
      save();
      if (location.hash === "#/start") render(); else location.hash = "#/start";
      window.scrollTo(0, 0);
      return;
    }
    if (act === "retake") {
      quiz().step = 1;
      save();
      if (location.hash === "#/start") render(); else location.hash = "#/start";
      return;
    }
    if (act === "college-tab") { state.collegeTab = el.dataset.value; save(); return render(); }
    if (act === "type-tab") { filters().type = el.dataset.value || ""; save(); return render(); }
    if (act === "toggle-filters") { filters().open = !filters().open; save(); return render(); }
    if (act === "save") {
      state.saved[el.dataset.id] = !state.saved[el.dataset.id];
      if (!state.saved[el.dataset.id]) delete state.saved[el.dataset.id];
    } else if (act === "filter") {
      const arr = filters()[el.dataset.group];
      const i = arr.indexOf(el.dataset.value);
      if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.value);
    } else if (act === "clear-filters") {
      state.filters = { sort: (state.filters || {}).sort, type: (state.filters || {}).type };
    } else if (act === "add-rec") {
      s.recs.push({ name: "", role: "", status: "" });
    } else if (act === "del-rec") {
      s.recs.splice(+el.dataset.i, 1);
    } else if (act === "add-college") {
      const inp = document.getElementById("new-college");
      const name = inp ? inp.value.trim() : "";
      const ci = collegeInfo(name);
      state.colleges.push({
        name: ci ? ci.name : name,
        policy: ci ? collegeSummary(ci) : "",
        deadline: ci && ci.deadlineDate ? ci.deadlineDate : "",
        status: "",
      });
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
    } else if (el.dataset.act === "college-search") {
      state.collegeQuery = el.value;
      const pos = el.selectionStart;
      render();
      const c = $app.querySelector('[data-act="college-search"]');
      if (c) { c.focus(); c.setSelectionRange(pos, pos); }
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
