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
    else if (parts[0] === "compare") {
      if (parts[1]) { state.compare = parts[1].split(",").filter((id) => byId[id]).slice(0, 3); save(); }
      current = { view: "compare", id: null };
    }
    else if (parts[0] === "results") current = { view: quiz().done ? "results" : "quiz", id: null };
    else if (parts[0] === "start") current = { view: "quiz", id: null };
    else if (parts[0] === "swipe") current = { view: quiz().done ? "swipe" : "quiz", id: null };
    else current = { view: quiz().done ? "results" : "quiz", id: null };
    if (current.view !== "detail") lastListView = current.view;
    render();
  }
  const NAV_FOR = { quiz: "discover", swipe: "discover", results: "discover", finder: "finder", list: "my-list", colleges: "colleges", compare: "compare" };
  function render() {
    if (current.view === "detail") renderDetail(byId[current.id]);
    else if (current.view === "list") renderList();
    else if (current.view === "quiz") renderQuiz();
    else if (current.view === "swipe") renderSwipe();
    else if (current.view === "colleges") renderColleges();
    else if (current.view === "compare") renderCompare();
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
  ];
  // Tuition slider (quiz + Browse): $10k–$40k in $1k steps; the top position means no limit.
  const BUDGET_MIN = 10000, BUDGET_TOP = 40000;
  const budgetLabel = (v) => (!v ? "No limit" : "Up to $" + Number(v).toLocaleString("en-US"));
  const budgetValue = (el) => (+el.value >= BUDGET_TOP ? null : +el.value);
  function budgetSlider(act, val, label) {
    return '<div class="budget-slider"><div class="bs-val">' + budgetLabel(val) + "</div>" +
      '<input type="range" class="range" min="' + BUDGET_MIN + '" max="' + BUDGET_TOP + '" step="1000" value="' + (val || BUDGET_TOP) + '" data-act="' + act + '" aria-label="' + esc(label) + '" aria-valuetext="' + budgetLabel(val) + '">' +
      '<div class="bs-ends small muted"><span>$10k</span><span>$25k</span><span>No limit</span></div></div>';
  }
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
      if (f.maxCost && p.costUSD != null && p.costUSD > f.maxCost) return false;
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
  const TYPE_ORDER = ["gap", "mechina", "university", "movement", "service", "aliyah", "yeshiva", "seminary"];
  const TYPE_PLURAL = { gap: "Gap year programs", mechina: "Mechinot", university: "University", movement: "Youth movement", service: "Service", aliyah: "Aliyah & IDF", yeshiva: "Yeshivot", seminary: "Seminaries" };
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
    chev: '<path d="m6 9 6 6 6-6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
    meals: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    candle: '<path d="M12 2c1 2 2 3 2 4.5a2 2 0 0 1-4 0C10 5 11 4 12 2Z"/><rect x="9" y="10" width="6" height="12" rx="1"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    quote: '<path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 5M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
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
    const gbp = /£\s?([\d,]+)/.exec(p.costText);
    if (gbp) return "£" + String(Math.round(+gbp[1].replace(/,/g, "") / 100) / 10).replace(/\.0$/, "") + "k";
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
    const activeFilters = FILTER_GROUPS.reduce((n, g) => n + f[g.key].length, 0) + (f.semester ? 1 : 0) + (f.credit ? 1 : 0) + (f.maxCost ? 1 : 0);
    const typeCount = (t) => D.programs.filter((p) => p.type === t).length;
    const filterSummary = (f.type ? TYPE_PLURAL[f.type] : "All types") + (activeFilters ? " · " + activeFilters + " more" : "") + " · " + list.length + " shown";
    $app.innerHTML =
      '<div class="browse-head"><div><h1>All programs</h1>' +
      '<p class="muted">' + D.programs.length + ' Israel gap years. Not sure where to start? <a href="#/start">Take the 1-minute quiz</a>.</p></div></div>' +
      '<div class="toolbar"><input class="search" type="search" placeholder="Search by name or city…" aria-label="Search programs" data-act="search" value="' + esc(f.q || "") + '">' +
      '<select class="select" aria-label="Sort" data-act="sort">' +
      [["featured", "Featured"], ["deadline", "Next deadline"], ["cost", "Lowest tuition"], ["name", "A–Z"]].map((o) => '<option value="' + o[0] + '"' + ((f.sort || "featured") === o[0] ? " selected" : "") + ">Sort: " + o[1] + "</option>").join("") +
      "</select></div>" +
      '<div class="dbars">' +
      // --- Filters bar ---
      '<div class="dbar-wrap"><button class="dbar" data-act="toggle-filters" aria-expanded="' + !!f.open + '">' + I("sliders") +
      '<span class="dt">Filters</span><span class="ds">' + esc(filterSummary) + "</span>" +
      (activeFilters + (f.type ? 1 : 0) ? '<span class="count-pill">' + (activeFilters + (f.type ? 1 : 0)) + "</span>" : "") + I("chev") + "</button>" +
      (f.open
        ? '<section class="dpanel filters-panel" aria-label="Filters">' +
          '<div class="fgroup wide"><h3>Program type</h3><div class="fchips">' +
          '<button class="fchip' + (!f.type ? " on" : "") + '" aria-pressed="' + !f.type + '" data-act="type-tab" data-value="">All <span class="muted">' + D.programs.length + "</span></button>" +
          TYPE_ORDER.map((t) => '<button class="fchip' + (f.type === t ? " on" : "") + '" aria-pressed="' + (f.type === t) + '" data-act="type-tab" data-value="' + t + '">' + TYPE_PLURAL[t] + ' <span class="muted">' + typeCount(t) + "</span></button>").join("") +
          "</div></div>" +
          FILTER_GROUPS.filter((g) => g.key !== "gender").map((g) =>
            '<div class="fgroup"><h3>' + g.title + '</h3><div class="fchips">' +
            Object.keys(g.options).map((k) =>
              '<button class="fchip' + (f[g.key].indexOf(k) >= 0 ? " on" : "") + '" aria-pressed="' + (f[g.key].indexOf(k) >= 0) + '" data-act="filter" data-group="' + g.key + '" data-value="' + k + '">' + esc(g.options[k]) + "</button>"
            ).join("") + "</div></div>"
          ).join("") +
          '<div class="fgroup"><h3>Tuition (USD)</h3>' + budgetSlider("cost-range", f.maxCost, "Maximum tuition") + "</div>" +
          '<div class="fgroup"><h3>Must have</h3><div class="fchips">' +
          '<label class="check"><input type="checkbox" data-act="toggle" data-key="semester"' + (f.semester ? " checked" : "") + "> Semester option</label>" +
          '<label class="check"><input type="checkbox" data-act="toggle" data-key="credit"' + (f.credit ? " checked" : "") + "> College credit</label></div></div>" +
          '<div class="filters-foot"><button class="btn ghost sm" data-act="clear-filters">Clear all</button><button class="btn sm primary" data-act="toggle-filters">Show ' + list.length + " programs</button></div></section>"
        : "") + "</div>" +
      // --- Upcoming deadlines bar ---
      (up.length
        ? '<div class="dbar-wrap"><button class="dbar" data-act="toggle-deadlines" aria-expanded="' + !!f.dlOpen + '">' + I("clock") +
          '<span class="dt">Upcoming deadlines</span><span class="ds">Next: ' + fmtDate(up[0].date, { month: "short", day: "numeric" }) + " · " + esc(up[0].count > 1 ? up[0].d.label : up[0].p.name) + "</span>" +
          '<span class="count-pill">' + up.length + "</span>" + I("chev") + "</button>" +
          (f.dlOpen
            ? '<ul class="dpanel dl-list dl-upcoming" aria-label="Upcoming deadlines">' +
              up.map((it) =>
                '<li><a href="#/program/' + it.p.id + '"><span class="dl-date">' + fmtDate(it.date, { month: "short", day: "numeric" }) + "</span>" +
                '<span class="dl-name">' + esc(it.count > 1 ? it.d.label + " (" + it.count + " programs)" : it.p.name) + "</span>" + countdown(it.date) + "</a></li>"
              ).join("") + "</ul>"
            : "") + "</div>"
        : "") +
      "</div>" +
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
      (p.audienceTag ? '<p class="aud-tag">' + I("users") + " " + esc(p.audienceTag) + "</p>" : "") +
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

  // ---------- Time charts ----------
  // Hours a week by category (time.js). Bars share one fixed scale (TIME_SCALE) so programs compare honestly.
  const TIME = window.GYF_TIME || {};
  const TCATS = [["rel", "Religious study"], ["acad", "Academic classes"], ["intern", "Internships"], ["vol", "Volunteering"], ["other", "Other structured time"]];
  const TIME_SCALE = 50;
  const tTotal = (t) => TCATS.reduce((n, c) => n + (t[c[0]] || 0), 0);
  const tPub = (t, k) => (t.pub || []).indexOf(k) >= 0;
  const tVal = (t, k) => (tPub(t, k) ? "" : "≈") + (t[k] || 0) + " h";
  function stackBar(t, cls) {
    const tot = tTotal(t) || 1;
    return '<div class="tstack ' + (cls || "") + '" role="img" aria-label="' + esc(TCATS.filter((c) => t[c[0]]).map((c) => c[1] + " " + Math.round((t[c[0]] / tot) * 100) + "%").join(", ")) + '">' +
      TCATS.filter((c) => t[c[0]]).map((c) => {
        const pct = (t[c[0]] / tot) * 100;
        return '<span class="seg c-' + c[0] + '" style="flex:' + t[c[0]] + '" data-tip="' + esc(c[1] + ": " + tVal(t, c[0]) + " a week (" + Math.round(pct) + "%)") + '">' +
          (pct >= 14 && cls !== "tstack-sm" ? '<b>' + Math.round(pct) + "%</b>" : "") + "</span>";
      }).join("") + "</div>";
  }
  function timeSection(p) {
    const t = TIME[p.id];
    if (!t) return null;
    const tot = tTotal(t), anyPub = (t.pub || []).length > 0;
    const rows = TCATS.map((c) => {
      const v = t[c[0]] || 0;
      return '<div class="trow"><span class="tlabel"><i class="key c-' + c[0] + '"></i>' + c[1] + '</span><span class="ttrack"><span class="tbar c-' + c[0] + '" style="width:' + Math.min(100, (v / TIME_SCALE) * 100).toFixed(1) + '%" data-tip="' + esc(c[1] + ": " + tVal(t, c[0]) + " a week") + '"></span></span><span class="tval">' + (v ? tVal(t, c[0]) : '<span class="muted">0</span>') + "</span></div>";
    }).join("");
    return ["time", "Time breakdown",
      '<div class="viz">' +
      '<div class="thead"><div class="hero"><span class="hero-n">' + (TCATS.every((c) => !t[c[0]] || tPub(t, c[0])) ? "" : "≈") + tot + '</span><span class="hero-u">structured hours a week</span></div>' +
      '<span class="pbadge ' + (anyPub ? "ok" : "muted") + '">' + (anyPub ? "Partly from the published schedule" : "Our estimate") + "</span></div>" +
      '<h4 class="viz-h">Hours a week by activity</h4><div class="trows">' + rows + '</div><div class="taxis"><span>0</span><span>' + TIME_SCALE / 2 + ' h</span><span>' + TIME_SCALE + " h</span></div>" +
      '<h4 class="viz-h">Total time: how the week splits</h4>' + stackBar(t) +
      '<ul class="tlegend">' + TCATS.filter((c) => t[c[0]]).map((c) => '<li><i class="key c-' + c[0] + '"></i>' + c[1] + " <strong>" + Math.round((t[c[0]] / tot) * 100) + "%</strong></li>").join("") + "</ul>" +
      '<p class="small muted viz-note">' + esc(t.note) + " Free time isn't counted. ≈ = our estimate; numbers without ≈ come from the program's published schedule.</p>" +
      '<button class="btn sm" data-act="cmp-add" data-id="' + p.id + '">Compare with other programs →</button>' +
      "</div>"];
  }

  // ---------- Compare (head to head) ----------
  const CMP_MAX = 3;
  const cmpList = () => (state.compare = (state.compare || []).filter((id) => byId[id]).slice(0, CMP_MAX));
  function renderCompare() {
    const ids = cmpList();
    const P = ids.map((id) => byId[id]);
    const prefs = quiz().answers.prefs || {};
    const answered = Object.keys(prefs).filter((k) => prefs[k] && prefs[k].want);
    const showSame = !!state.cmpSame;
    const n = P.length;
    const opts = (sel) => '<option value="">' + (sel ? "Change program…" : "Add a program…") + "</option>" +
      TYPE_ORDER.map((ty) => '<optgroup label="' + esc(TYPE_PLURAL[ty]) + '">' + D.programs.filter((q) => q.type === ty).map((q) => '<option value="' + q.id + '"' + (q.id === sel ? " selected" : "") + ">" + esc(q.name) + "</option>").join("") + "</optgroup>").join("");
    const slots = [];
    for (let i = 0; i < CMP_MAX; i++) slots.push(P[i] || null);
    const wins = slots.map(() => []);   // per column: labels of rows it leads outright
    let hidden = 0;
    // One row. spec.vals = numbers for ranking (null = n/a); spec.lead = "max" | "min";
    // spec.tag = word on the winner chip; spec.win = what the scoreboard says the winner is best at.
    const row = (label, cell, spec) => {
      spec = spec || {};
      const texts = slots.map((q, i) => (q ? cell(q, i) : ""));
      const live = texts.filter((t, i) => slots[i]);
      const same = n > 1 && live.every((t) => t === live[0]);
      if (same && !showSame && !spec.keep) { hidden++; return ""; }
      let leader = -1;
      if (spec.lead && spec.vals) {
        const v = spec.vals.map((x, i) => (slots[i] ? x : null));
        const ok = v.filter((x) => x != null);
        if (ok.length > 1) {
          const best = spec.lead === "min" ? Math.min.apply(null, ok) : Math.max.apply(null, ok);
          const at = v.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0);
          if (at.length === 1) { leader = at[0]; if (spec.win) wins[leader].push(spec.win); }
        }
      }
      return '<tr><th class="rowh" scope="row">' + label + "</th>" + slots.map((q, i) =>
        "<td" + (i === leader ? ' class="lead"' : leader >= 0 && q ? ' class="lose"' : "") + ">" + texts[i] +
        (i === leader && spec.tag ? '<span class="win-tag">' + spec.tag + "</span>" : "") + "</td>").join("") + "</tr>";
    };
    const group = (title, sub) => '<tr class="grp"><th colspan="' + (CMP_MAX + 1) + '">' + title + (sub ? ' <span class="grp-sub">' + sub + "</span>" : "") + "</th></tr>";
    const v = (fn) => slots.map((q) => (q ? fn(q) : null));
    const tm = (q) => TIME[q.id];
    const det = (q) => DETAILS[q.id] || {};
    const nd = (q) => { const x = nextDeadline(q); return x.kind === "date" ? fmtDate(x.d.date, { month: "short", day: "numeric" }) + " " + countdown(x.d.date) : x.kind === "rolling" ? "Rolling" : '<span class="muted">Not posted</span>'; };
    const PEERS = { none: 1, some: 2, integrated: 3 };
    let basics = "", time = "", ratings = "", more = "";
    if (n) {
      basics =
        row("Tuition", (q) => '<span title="' + esc(q.costText) + '">' + esc(compactCost(q)) + "</span>", { lead: "min", vals: v((q) => q.costUSD), tag: "Lowest", win: "Lowest tuition", keep: true }) +
        row("Length", (q) => esc(q.length.split(" · ")[0].split(" (")[0])) +
        row("Next deadline", nd) +
        row("Israeli peers", (q) => esc(L.israeliPeers[q.israeliPeers]), { lead: "max", vals: v((q) => PEERS[q.israeliPeers]), tag: "Most", win: "Most Israeli contact" }) +
        row("College credit", (q) => (q.credit === true ? "Yes" : q.credit === false ? "No" : '<span class="muted">Not researched</span>'), { lead: "max", vals: v((q) => (q.credit === true ? 1 : q.credit === false ? 0 : null)), win: "College credit" }) +
        row("Semester option", (q) => (q.semesterOption ? "Yes" : "No"), { lead: "max", vals: v((q) => (q.semesterOption ? 1 : 0)), win: "Semester option" }) +
        row("Community", (q) => esc(L.orientation[q.orientation])) +
        row("Setting", (q) => esc(L.gender[q.gender])) +
        row("Where", (q) => esc(q.base.split(" (")[0]));
      // time: bars scaled to the row's own max so the winner's bar is the longest
      time = TCATS.map((c) => {
        const vals = v((q) => (tm(q) ? tm(q)[c[0]] || 0 : null));
        const mx = Math.max.apply(null, vals.filter((x) => x != null).concat([1]));
        return row('<i class="key c-' + c[0] + '"></i>' + c[1], (q) => {
          const t = tm(q); if (!t) return '<span class="muted">Not enough info</span>';
          const x = t[c[0]] || 0;
          return '<span class="cval">' + (x ? tVal(t, c[0]) : "0 h") + '</span><span class="cbar"><span class="tbar c-' + c[0] + '" style="width:' + ((x / mx) * 100).toFixed(1) + '%" data-tip="' + esc(q.short + " · " + c[1] + ": " + tVal(t, c[0]) + " a week") + '"></span></span>';
        }, c[0] === "other" ? {} : { lead: "max", vals, tag: "Most", win: "Most " + c[1].toLowerCase() });
      }).join("") +
        row("Week split", (q) => (tm(q) ? stackBar(tm(q), "tstack-sm") + '<span class="small muted">≈' + tTotal(tm(q)) + " h a week</span>" : '<span class="muted">—</span>'), { keep: true });
      const rkeys = answered.length ? answered : [];
      const ratingRow = (k) => {
        const c = L.categories[k], want = prefs[k] && prefs[k].want;
        return row(esc(c.label) + (want ? '<div class="small muted">you: ' + want + "</div>" : ""), (q) => {
          const rt = q.profile[k];
          if (!rt) return '<span class="muted">Unknown</span>';
          return '<span class="rdots">' + [1, 2, 3, 4, 5].map((x) => '<span class="rdot' + (x <= rt.v ? " on" : "") + '"></span>').join("") + '</span> <span class="cval">' + (rt.est ? "≈" : "") + rt.v + "</span>";
        }, want ? { lead: "max", vals: v((q) => (q.profile[k] ? -Math.abs(q.profile[k].v - want) : null)), tag: "Closest to you", win: c.label + " (your pick)" } : {});
      };
      ratings = rkeys.map(ratingRow).join("");
      const otherKeys = Object.keys(L.categories).filter((k) => rkeys.indexOf(k) < 0);
      const clip = (t) => (t ? '<span class="clip">' + esc(t) + "</span>" : '<span class="muted">Not published</span>');
      more =
        otherKeys.map(ratingRow).join("") +
        row("Housing", (q) => clip(det(q).housing)) +
        row("Meals", (q) => clip(det(q).meals)) +
        row("Internships", (q) => { const it = det(q).internships; return it && it.offered ? "Yes" + (it.hours ? '<div class="small muted">' + esc(it.hours) + "</div>" : "") : it && it.offered === false ? "No" : '<span class="muted">Not stated</span>'; }) +
        row("Tracks", (q) => { const tr = det(q).tracks || []; return tr.length ? esc(tr.map((x) => x.name).join(", ")) : '<span class="muted">—</span>'; }) +
        row("Interview", (q) => (q.app.interview.required === true ? "Yes" : q.app.interview.required === false ? "No" : '<span class="muted">Not stated</span>')) +
        row("Deposit", (q) => (q.app.fees.deposit ? esc(q.app.fees.deposit) : '<span class="muted">Not published</span>'));
    }
    const ms = n ? matches() : [];
    const matchPct = (q) => { const m = ms.find((x) => x.p.id === q.id); return m && m.pct != null && answered.length ? m.pct : null; };
    const pcts = slots.map((q) => (q ? matchPct(q) : null));
    const bestPct = Math.max.apply(null, pcts.filter((x) => x != null).concat([-1]));
    const soloBest = pcts.filter((x) => x === bestPct).length === 1;
    const most = Math.max.apply(null, wins.map((w) => w.length));
    const head = '<tr class="cmp-headrow"><th class="rowh"></th>' + slots.map((q, i) => '<th class="cmp-col">' +
      (q ? '<div class="cmp-top">' + (q.photo ? '<div class="cmp-ph" style="background-image:url(\'' + esc(q.photo) + '\')"></div>' : '<div class="cmp-ph ph g-' + q.orientation + '"><span>' + esc(q.short) + "</span></div>") +
          '<div class="cmp-id"><a class="cmp-name" href="#/program/' + q.id + '">' + esc(q.name) + "</a>" + typeBadge(q) + "</div>" +
          '<button class="cmp-x" data-act="cmp-remove" data-i="' + i + '" aria-label="Remove ' + esc(q.name) + '">' + I("x") + "</button></div>"
        : '<div class="cmp-empty">Add a program</div>') +
      '<select class="select sm" data-act="cmp-pick" data-i="' + i + '" aria-label="Program ' + (i + 1) + '">' + opts(q && q.id) + "</select></th>").join("") + "</tr>";
    const board = n > 1 ? '<tr class="cmp-board"><th class="rowh">Head to head</th>' + slots.map((q, i) => {
      if (!q) return "<td></td>";
      const w = wins[i], top = w.length === most && most > 0 && wins.filter((x) => x.length === most).length === 1;
      const p = pcts[i];
      return '<td class="' + (top ? "champ" : "") + '"><div class="score"><span class="score-n">' + w.length + '</span><span class="score-l">row' + (w.length === 1 ? "" : "s") + " won</span>" + (top ? '<span class="win-tag">Leads</span>' : "") + "</div>" +
        (p != null ? '<div class="small">' + (p === bestPct && soloBest ? "<strong>" + p + "% match</strong> · best for you" : p + "% match") + "</div>" : "") +
        (w.length ? '<div class="best-at">Best at: ' + esc(w.slice(0, 3).join(" · ")) + (w.length > 3 ? " +" + (w.length - 3) : "") + "</div>" : '<div class="best-at muted">No outright wins</div>') + "</td>";
    }).join("") + "</tr>" : "";
    $app.innerHTML =
      '<div class="browse-head cmp-headline"><div><h1>Compare programs</h1><p class="muted">Up to three programs head to head. The winner of each row is highlighted.</p></div>' +
      (n > 1 ? '<label class="check small"><input type="checkbox" data-act="cmp-same"' + (showSame ? " checked" : "") + "> Show rows where they're the same</label>" : "") + "</div>" +
      '<div class="card table-wrap cmp-wrap"><table class="cmp"><thead>' + head + "</thead><tbody>" + board +
      (n ? group("Basics") + basics + group("Time", "approx. hours a week · ≈ = our estimate") + time +
        (ratings ? group("Your quiz picks", "ratings 1–5") + ratings : "") : "") +
      "</tbody></table></div>" +
      (n ? '<details class="cmp-more"><summary>More details: ' + (answered.length ? "other ratings, " : "ratings, ") + "housing, meals, internships, applying</summary>" +
        '<div class="card table-wrap cmp-wrap"><table class="cmp"><tbody>' + more + "</tbody></table></div></details>" : "") +
      (n && hidden ? '<p class="small muted" style="margin-top:8px">' + hidden + " row" + (hidden === 1 ? " is" : "s are") + " hidden because the programs match.</p>" : "") +
      (n ? "" : '<div class="card empty" style="margin-top:12px">Choose programs above, or tap "Compare" on any program page. <a href="#/results">Compare your Top 3</a>.</div>') +
      (n ? '<p class="small muted" style="margin-top:8px">Share this comparison: <a href="#/compare/' + ids.join(",") + '">link</a></p>' : "");
  }

  // ---------- "The year" sections: daily life, internships & tracks, student stories ----------
  const DETAILS = (window.GYF_DETAILS && window.GYF_DETAILS.programs) || {};
  const STORIES = window.GYF_STORIES || {};
  function infoSection(key, title, body, sub) {
    return '<section class="card sec" id="sec-' + key + '"><div class="sec-head"><h2>' + esc(title) + "</h2>" + (sub ? '<span class="small muted">' + sub + "</span>" : "") + "</div>" + body + "</section>";
  }
  // Turn a details paragraph into bullets: schedules split on " · " (times in bold), prose by sentence and semicolon.
  function bulletList(t) {
    if (t.indexOf(" · ") >= 0) {
      return '<ul class="life-list sched">' + t.split(" · ").map((x) => {
        x = x.trim().replace(/\.$/, "");
        const m = /^(\d{1,2}:\d{2}(?:[–-]\d{1,2}:\d{2})?)\s+(.*)$/.exec(x);
        return "<li>" + (m ? '<strong class="t">' + esc(m[1]) + "</strong> <span>" + esc(m[2]) + "</span>" : '<span class="t"></span><span>' + esc(x.charAt(0).toUpperCase() + x.slice(1)) + "</span>") + "</li>";
      }).join("") + "</ul>";
    }
    const parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9₪$£"“'(])|;\s+/).map((x) => x.trim()).filter(Boolean);
    return '<ul class="life-list">' + parts.map((x) => {
      x = x.charAt(0).toUpperCase() + x.slice(1);
      if (!/[.!?)”"]$/.test(x)) x += ".";
      return "<li>" + esc(x) + "</li>";
    }).join("") + "</ul>";
  }
  function yearSections(p) {
    const d = DETAILS[p.id] || {};
    const out = [];
    const ts = timeSection(p);
    if (ts) out.push(ts);
    const life = [["cal", "A typical week", d.week], ["clock", "A typical day", d.day], ["home", "Housing", d.housing], ["meals", "Meals", d.meals],
      ["candle", "Shabbat & holidays", d.shabbat], ["map", "Trips & travel", d.trips], ["users", "Staff & support", d.staff], ["check", "Included in the price", d.included]].filter((x) => x[2]);
    if (life.length) out.push(["life", "Daily life", '<div class="life-grid">' + life.map((x) =>
      '<div class="life-item"><span class="life-ic">' + I(x[0]) + "</span><div><h4>" + x[1] + "</h4>" + bulletList(x[2]) + "</div></div>").join("") + "</div>"]);
    const it = d.internships, tracks = d.tracks || [];
    if ((it && it.offered) || tracks.length) {
      const title = it && it.offered && tracks.length ? "Internships & tracks" : it && it.offered ? "Internships" : "Tracks";
      out.push(["tracks", title,
        (it && it.offered
          ? '<div class="intern"><h4>' + I("work") + " How internships work</h4>" + (it.how ? "<p>" + esc(it.how) + "</p>" : "") +
            (it.hours ? '<p class="small"><strong>Time:</strong> ' + esc(it.hours) + "</p>" : "") +
            (it.sectors && it.sectors.length ? '<div class="chips" style="margin-top:8px">' + it.sectors.map((x) => '<span class="chip">' + esc(x) + "</span>").join("") + "</div>" : "") + "</div>"
          : "") +
        (tracks.length ? '<div class="track-grid">' + tracks.map((t) => '<div class="track"><h4>' + esc(t.name) + "</h4>" + (t.desc ? "<p>" + esc(t.desc) + "</p>" : "") + "</div>").join("") + "</div>" : "")]);
    }
    const st = STORIES[p.id] || {}, tm = st.testimonials || [], ct = st.contacts || [];
    out.push(["stories", "Student stories",
      (tm.length ? '<div class="quotes">' + tm.map((q) => '<figure class="quote">' + I("quote") + "<blockquote>" + esc(q.quote) + "</blockquote><figcaption>" + esc([q.name, q.year, q.school].filter(Boolean).join(" · ")) + "</figcaption></figure>").join("") + "</div>"
        : '<div class="placeholder">' + I("quote") + "<div><strong>Testimonials coming soon</strong><p class=\"small muted\">We're collecting short write-ups from students who did " + esc(p.short.length > 4 ? p.name : p.name) + ".</p></div></div>") +
      '<h4 class="contacts-h">Talk to someone who went</h4>' +
      (ct.length ? '<div class="contacts">' + ct.map((c) => '<div class="contact"><div><strong>' + esc(c.name) + "</strong>" + (c.role ? '<div class="small muted">' + esc(c.role) + "</div>" : "") + (c.note ? '<p class="small">' + esc(c.note) + "</p>" : "") + "</div>" +
          (c.email ? '<a class="btn sm" href="mailto:' + esc(c.email) + '">' + I("mail") + " Email</a>" : "") + "</div>").join("") + "</div>"
        : '<div class="placeholder">' + I("users") + '<div><strong>Alumni contacts coming soon</strong><p class="small muted">Past participants who are happy to answer questions will be listed here.</p></div></div>')]);
    return out;
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
      if (s.passportExpiry && !p.endDate) {
        check = '<div class="callout warn small" style="margin-top:6px">' + I("alert") + " This program hasn't published its end date. Keep your passport valid at least 6 months past the end of the year.</div>";
      } else if (s.passportExpiry) {
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

    const yearSecs = yearSections(p);
    const det = DETAILS[p.id];
    const allSources = p.sources.concat(det && det.sources ? det.sources.filter((u) => p.sources.indexOf(u) < 0) : []);
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
      (p.audienceTag ? '<p class="aud-tag">' + I("users") + " " + esc(p.audienceTag) + "</p>" : "") +
      '<p class="muted">' + esc(p.operator) + " · " + esc(p.base) + "</p>" +
      '<div class="chips"><span class="chip accent">' + esc(L.orientation[p.orientation]) + '</span><span class="chip">' + esc(L.gender[p.gender]) + '</span><span class="chip">' + esc(L.israeliPeers[p.israeliPeers]) + "</span>" +
      (p.credit ? '<span class="chip">College credit</span>' : "") + (p.semesterOption ? '<span class="chip">Semester option</span>' : "") + "</div></div>" +
      '<div class="actions"><button class="btn' + (saved ? "" : " primary") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '">' + (saved ? I("heart", true) + " On my list" : I("heart") + " Add to my list") + "</button>" +
      '<button class="btn" data-act="cmp-add" data-id="' + p.id + '">Compare</button>' +
      '<a class="btn" href="' + esc(p.website) + '" target="_blank" rel="noopener">' + (p.websiteLabel ? esc(p.websiteLabel) : "Official website") + " ↗</a></div></header>" +
      '<div class="card stats">' +
      '<div class="stat"><div class="label">Tuition</div><div class="value">' + esc(p.costUSD != null ? money(p.costUSD) : /[₪£]/.test(p.costText) ? shortCost(p) : "—") + '</div><div class="sub">' + esc(p.costUSD != null ? shortCost(p) : p.costText.indexOf("₪") >= 0 ? "Priced in shekels" : p.costText.indexOf("£") >= 0 ? "Priced in pounds" : p.costText) + "</div></div>" +
      '<div class="stat"><div class="label">Length</div><div class="value">' + esc(p.length.split(" · ")[0].split(" (")[0]) + '</div><div class="sub">' + esc(p.semesterOption ? "Semester option available" : "Full year") + "</div></div>" +
      '<div class="stat"><div class="label">Next deadline</div><div class="value">' + (nd.kind === "date" ? fmtDate(nd.d.date, { month: "short", day: "numeric" }) : nd.kind === "rolling" ? "Rolling" : "Not posted") + '</div><div class="sub">' + (nd.kind === "date" ? esc(nd.d.label) + " · " + countdown(nd.d.date) : nd.kind === "rolling" ? "Apply early, it can fill" : "Confirm with program") + "</div></div>" +
      '<div class="stat"><div class="label">Your application</div><div class="value">' + pr.pct + '%</div><div class="sub"><div class="progress-bar" style="margin-top:6px"><span style="width:' + pr.pct + '%"></span></div></div></div>' +
      "</div>" +
      '<nav class="tabs" aria-label="Page sections"><a href="#sec-overview" data-jump="sec-overview">Overview</a>' +
      yearSecs.map((x) => '<a href="#sec-' + x[0] + '" data-jump="sec-' + x[0] + '">' + x[1] + "</a>").join("") + SECTIONS.map((x) => '<a href="#sec-' + x[0] + '" data-jump="sec-' + x[0] + '">' + x[1] + "</a>").join("") + "</nav>" +
      '<div class="detail"><div class="sections">' +
      '<section class="card sec" id="sec-overview"><div class="sec-head"><h2>Overview</h2></div>' +
      (p.audience ? '<div class="callout warn" style="margin-bottom:12px"><span aria-hidden="true">' + I("users") + '</span><div><strong>Who it\'s for:</strong> ' + esc(p.audience) + "</div></div>" : "") +
      "<p>" + esc(p.blurb) + "</p>" +
      '<div class="facts"><div class="fact"><div class="k">Community</div><div class="v">' + esc(L.orientation[p.orientation]) + '</div></div><div class="fact"><div class="k">Where</div><div class="v">' + esc(p.base) + "</div></div>" +
      '<div class="fact"><div class="k">Tuition</div><div class="v">' + esc(p.costText) + '</div></div><div class="fact"><div class="k">Focus</div><div class="v">' + esc(p.focus.map((f) => L.focus[f]).join(", ")) + "</div></div>" +
      '<div class="fact"><div class="k">College credit</div><div class="v">' + (p.credit === true ? "Yes" : p.credit === false ? "No" : "Not researched") + '</div></div><div class="fact"><div class="k">Israeli peers</div><div class="v">' + esc(L.israeliPeers[p.israeliPeers]) + "</div></div>" +
      '<div class="fact"><div class="k">Website</div><div class="v"><a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) + " ↗</a></div></div></div>" + fieldsBox(p) + ratingsBox(p) + "</section>" +
      '<h2 class="group-h">The year</h2>' + yearSecs.map((x) => infoSection(x[0], x[1], x[2])).join("") +
      '<h2 class="group-h">Application</h2>' +
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
      allSources.map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>").join("") + "</div></div>" +
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
            return '<tr><td><a href="#/program/' + p.id + '" style="display:flex;gap:14px;align-items:center;color:var(--text)"><span class="logo sm o-' + p.orientation + '">' + esc(p.short) + "</span><span><strong>" + esc(p.name) + '</strong><br><span class="small muted">' + esc(L.type[p.type][1]) + " · " + esc(L.orientation[p.orientation]) + "</span></span></a></td>" +
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
  function hillelLine(c) {
    const h = c.hillel;
    if (!h) return "";
    return '<p class="hillel-line small">' + (h.rank ? "Hillel #" + h.rank + " · " : "") + Number(h.jewish).toLocaleString("en-US") + " Jewish undergrads · " + esc(h.type) + "</p>";
  }
  const APP_STATUS = [["", "Planning to apply"], ["applied", "Applied"], ["accepted", "Accepted"], ["waiting", "Waitlisted / deferred"], ["rejected", "Not accepted"], ["committed", "Committed"]];
  const APP_PLAN = [["", "Choose a plan"], ["ed", "Early Decision"], ["ed2", "Early Decision II"], ["ea", "Early Action"], ["rea", "Restrictive Early Action"], ["rd", "Regular Decision"], ["rolling", "Rolling"]];
  const notFoundList = () => (COLLEGES.notFound || []).map((n) => (typeof n === "string" ? { name: n } : n));
  const myIndex = (name) => state.colleges.findIndex((c) => norm(c.name) === norm(name));
  function policyFacts(c) {
    return '<dl class="college-facts">' +
      "<div><dt>Request deferral by</dt><dd>" + (c.deadline ? esc(c.deadline) + (c.deadlineDate ? " " + countdown(c.deadlineDate) : "") : '<span class="muted">Not stated</span>') + "</dd></div>" +
      "<div><dt>How long</dt><dd>" + esc(c.length || "Not stated") + "</dd></div>" +
      '<div class="wide"><dt>How to ask</dt><dd>' + esc(c.how || "Not stated") + (c.deposit ? " Requires your enrollment deposit." : "") + "</dd></div>" +
      '<div class="wide"><dt>Credit during the gap year</dt><dd>' + esc(c.credit || "Not stated. Ask admissions.") + "</dd></div>" +
      (c.grades ? '<div class="wide"><dt>Grades & credits from the gap year</dt><dd>' + esc(c.grades) + "</dd></div>" : "") +
      (c.israel ? '<div class="wide"><dt>Israel programs</dt><dd>' + esc(c.israel) + "</dd></div>" : "") +
      "</dl>" +
      (c.quote ? '<blockquote class="college-quote">“' + esc(c.quote) + "”</blockquote>" : "") +
      (c.note ? '<p class="small" style="color:var(--warn)">' + I("alert") + " " + esc(c.note) + "</p>" : "") +
      (c.source ? '<a class="small" href="' + esc(c.source) + '" target="_blank" rel="noopener">Source: ' + esc(c.source.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]) + " ↗</a>" : "");
  }
  function addButton(name) {
    return myIndex(name) >= 0
      ? '<span class="pbadge ok">In my colleges</span>'
      : '<button class="btn sm primary" data-act="col-add" data-name="' + esc(name) + '">+ Add to my colleges</button>';
  }
  // What to do next for one college, from its application and deferral status.
  function nextStep(c, ci) {
    const by = (d) => (d ? " by " + fmtDate(d, { month: "short", day: "numeric" }) + " " + countdown(d) : "");
    if (!c.app) return "Next: submit your application" + by(c.appDeadline);
    if (c.app === "applied") return "Waiting on a decision.";
    if (c.app === "waiting") return "Waitlisted or deferred. Send any update the college asks for.";
    if (c.app === "rejected") return "";
    if (ci && ci.deferral === "no") return "This college doesn't allow gap year deferrals. Ask admissions about reapplying.";
    if (!c.status) return "Next: request your gap year deferral" + by(c.deadline);
    if (c.status === "requested") return "Deferral requested. Waiting to hear back.";
    if (c.status === "approved") return "Deferral approved." + (ci && ci.creditLevel === "none" ? " Don't take college-credit courses during the year." : "");
    return "Deferral denied. Talk to admissions about your options.";
  }
  function myCollegeCard(c, i) {
    const ci = collegeInfo(c.name);
    const step = nextStep(c, ci);
    return '<article class="card mycol">' +
      '<div class="mycol-head"><div><h3>' + esc(c.name || "College") + "</h3>" + (ci ? hillelLine(ci) : "") +
      '<div class="chips">' + (ci ? deferBadge(ci) + creditBadge(ci) + (ci.noApplyingElsewhere ? '<span class="pbadge warn">Can\'t apply elsewhere</span>' : "") : '<span class="pbadge muted">No published gap year policy</span>') + "</div></div>" +
      '<button class="btn ghost sm" data-act="del-college" data-i="' + i + '" aria-label="Remove ' + esc(c.name) + '">' + I("x") + "</button></div>" +
      (step ? '<p class="mycol-next small">' + step + "</p>" : "") +
      '<div class="mycol-grid">' +
      '<label class="field"><span>Plan</span>' + statusSelect(["colleges", i, "plan"], c.plan, APP_PLAN, "g", "Application plan") + "</label>" +
      '<label class="field"><span>Application</span>' + statusSelect(["colleges", i, "app"], c.app, APP_STATUS, "g", "Application status") + "</label>" +
      '<label class="field"><span>Application due</span><input class="input" type="date" value="' + esc(c.appDeadline || "") + '"' + bindAttr(["colleges", i, "appDeadline"], "g") + "></label>" +
      '<label class="field"><span>Gap year deferral</span>' + statusSelect(["colleges", i, "status"], c.status, DEFER_STATUS, "g", "Deferral status") + "</label>" +
      '<label class="field"><span>Request deferral by</span><input class="input" type="date" value="' + esc(c.deadline || "") + '"' + bindAttr(["colleges", i, "deadline"], "g") + "></label>" +
      '<label class="field wide"><span>Notes</span><textarea class="textarea" rows="2" placeholder="Portal login, essays, who to email about the deferral…"' + bindAttr(["colleges", i, "notes"], "g") + ">" + esc(c.notes || "") + "</textarea></label>" +
      "</div>" +
      (ci ? '<details class="mycol-policy"><summary>Gap year policy</summary>' + policyFacts(ci) + "</details>" : "") +
      "</article>";
  }
  function renderColleges() {
    const raw = (state.collegeQuery || "").trim();
    const q = norm(raw);
    const rank = (c) => (c.hillel && c.hillel.rank) || 999;
    const mine = state.colleges;
    const count = (k, v) => mine.filter((c) => c[k] === v).length;
    const summary = mine.length
      ? [mine.length + " college" + (mine.length === 1 ? "" : "s"), count("app", "applied") + " applied", count("app", "accepted") + count("app", "committed") + " accepted", count("status", "approved") + " deferral" + (count("status", "approved") === 1 ? "" : "s") + " approved"].join(" · ")
      : "";
    let results = "";
    if (q.length >= 2) {
      const hits = COLLEGES.colleges.filter((c) => norm(c.name).indexOf(q) >= 0).sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
      const nf = notFoundList().filter((n) => norm(n.name).indexOf(q) >= 0).sort((x, y) => rank(x) - rank(y));
      const exact = hits.concat(nf).some((c) => norm(c.name) === q) || myIndex(raw) >= 0;
      results =
        '<p class="results-count" style="margin:2px 0 12px">' + (hits.length + nf.length ? hits.length + nf.length + " match" + (hits.length + nf.length === 1 ? "" : "es") : "No colleges in our list match “" + esc(raw) + "”.") + "</p>" +
        (hits.length ? '<div class="college-grid">' + hits.slice(0, 12).map((c) =>
          '<article class="card college"><div class="college-head"><div class="college-title"><h3>' + esc(c.name) + "</h3>" + addButton(c.name) + "</div>" + hillelLine(c) +
          '<div class="chips">' + deferBadge(c) + creditBadge(c) + (c.noApplyingElsewhere ? '<span class="pbadge warn">Can\'t apply elsewhere</span>' : "") + "</div></div>" +
          policyFacts(c) + "</article>").join("") + "</div>" + (hits.length > 12 ? '<p class="small muted" style="margin-top:8px">Showing 12 of ' + hits.length + ". Keep typing to narrow it down.</p>" : "") : "") +
        (nf.length ? '<div class="nf-list">' + nf.map((n) =>
          '<div class="nf-row"><div><strong>' + esc(n.name) + "</strong>" + (n.hillel && n.hillel.rank ? ' <span class="muted small">Hillel #' + n.hillel.rank + "</span>" : "") +
          '<p class="small muted">No published gap year policy found. Ask the admissions office directly.</p></div>' + addButton(n.name) + "</div>").join("") + "</div>" : "") +
        (!exact ? '<p style="margin-top:12px"><button class="btn sm" data-act="col-add" data-name="' + esc(raw) + '">+ Add “' + esc(raw) + "” as my own college</button></p>" : "");
    }
    $app.innerHTML =
      '<div class="browse-head"><div><h1>Colleges</h1>' +
      '<p class="muted">Track the colleges you\'re applying to and their gap year deferral rules. Policies come from each college\'s own website (researched ' + fmtDate(COLLEGES.asOf) + "). Always confirm with the college.</p></div></div>" +
      '<section class="mycols"><div class="sec-head"><h2>My colleges</h2>' + (summary ? '<span class="small muted">' + summary + "</span>" : "") + "</div>" +
      (mine.length ? '<div class="mycol-list">' + mine.map(myCollegeCard).join("") + "</div>"
        : '<div class="card empty">No colleges yet. Search below and add the schools you\'re applying to. Each one gets its own tracker for the application and the gap year deferral.</div>') +
      "</section>" +
      '<section class="colsearch"><div class="sec-head"><h2>Find a college</h2></div>' +
      '<input class="search" type="search" placeholder="Search by college name, e.g. Michigan" aria-label="Search colleges" data-act="college-search" value="' + esc(raw) + '">' +
      (q.length >= 2 ? results
        : '<p class="small muted" style="margin-top:10px">Type at least 2 letters. We have sourced policies for ' + COLLEGES.colleges.length + " colleges, including " + COLLEGES.colleges.filter((c) => c.hillel).length + " of the " + (COLLEGES.top || 100) + " with the most Jewish students (Hillel International).</p>" +
          '<div class="callout info" style="margin-top:12px"><span aria-hidden="true">' + I("info") + '</span><div><strong>Why credit matters:</strong> Israel programs that give college credit (Year Course, Kivunim, Aardvark/JTS, TAU, Hebrew U, Bar-Ilan) can clash with colleges marked <span class="pbadge bad">No college credit</span>. Skip the credit option or get written approval first.</div></div>') +
      "</section>";
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
  // Screen 1: dealbreakers. Anything left blank doesn't filter.
  const DEAL = {
    orientation: { q: "Which communities feel right?", multi: true,
      options: [["pluralistic", "", "Pluralistic"], ["conservative", "", "Conservative"], ["reform", "", "Reform"], ["mo-coed", "", "Modern Orthodox"], ["orthodox", "", "Yeshiva / seminary"], ["secular", "", "Secular"]] },
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
    if (a.deal.budget) { // older answers used budget chips
      if (a.deal.max === undefined) a.deal.max = { u15: 15000, "15-25": 25000, "25-35": 35000 }[a.deal.budget[0]] || null;
      delete a.deal.budget;
    }
    a.prefs = a.prefs || {};
    a.field = a.field || [];
    a.city = a.city || [];
    a.any = a.any || {}; // groups where the student explicitly chose "Any" / "Don't care" / "Skip"
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
      if (d.max && p.costUSD != null && p.costUSD > d.max) return;
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
    const anyOn = !picked.length && !!quiz().answers.any[key]; // nothing is pre-selected; "Any" lights up once you pick it
    return '<div class="qgroup"><h3>' + esc(def.q) + "</h3>" + (def.sub ? '<p class="small muted">' + esc(def.sub) + "</p>" : "") +
      '<div class="qchips">' +
      '<button class="qchip any' + (anyOn ? " on" : "") + '" aria-pressed="' + anyOn + '" data-act="' + act + '" data-key="' + key + '" data-value="__any">' + (def.anyLabel || "Any") + "</button>" +
      def.options.map((o) => {
        const on = picked.indexOf(o[0]) >= 0;
        return '<button class="qchip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-act="' + act + '" data-key="' + key + '" data-value="' + o[0] + '">' + esc(o[2]) + "</button>";
      }).join("") + "</div></div>";
  }
  function prefRow(row) {
    const k = row[0], c = CATS[k];
    const pref = quiz().answers.prefs[k] || {};
    return '<div class="prow' + (pref.want || pref.dc ? " active" : "") + '"><span class="prow-label">' + esc(c.label) + "</span>" +
      '<div class="prow-scale"><span class="pend">' + esc(row[1]) + '</span><div class="pnums" role="group" aria-label="' + esc(c.label) + ': 1 = ' + esc(row[1]) + ", 5 = " + esc(row[2]) + '">' +
      [1, 2, 3, 4, 5].map((n) => {
        const on = pref.want === n;
        return '<button class="pnum' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-act="pref-pick" data-key="' + k + '" data-value="' + n + '">' + n + "</button>";
      }).join("") +
      '</div><span class="pend">' + esc(row[2]) + "</span></div>" +
      '<button class="popt dc' + (!pref.want && pref.dc ? " on" : "") + '" aria-pressed="' + (!pref.want && !!pref.dc) + '" data-act="pref-pick" data-key="' + k + '" data-value="0">Don\'t care</button>' +
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
        '<p class="muted">These rule programs out. Pick "Any" or skip a group if it doesn\'t matter.</p>' +
        Object.keys(DEAL).map((k) => choiceGroup(k, DEAL[k], a.deal[k] || [], "deal-pick") +
          (k === "orientation" ? '<div class="qgroup"><h3>Tuition budget</h3>' + budgetSlider("budget-range", a.deal.max, "Maximum tuition") +
            '<p class="small muted" style="margin-top:4px">Programs that haven\'t posted a US-dollar price stay in.</p></div>' : "")).join("");
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
      '<div class="swipe-head-actions"><button class="btn ghost sm" data-act="retake">Change answers</button><button class="btn sm" data-act="cmp-top3">Compare these 3</button><button class="btn sm" data-act="restart">' + I("undo") + ' Retake quiz</button></div></div>' +
      '<div class="top3">' + top.map((m, i) => {
        const p = m.p, saved = !!state.saved[p.id];
        return '<article class="card topcard">' +
          photoBox(p, "top-photo", '<span class="rank">#' + (i + 1) + "</span>" + typeBadge(p) +
            '<button class="heart' + (saved ? " on" : "") + '" data-act="save" data-id="' + p.id + '" aria-pressed="' + saved + '" aria-label="Save">' + I("heart", saved) + "</button>") +
          '<div class="topcard-body"><div class="tc-title"><h2><a href="#/program/' + p.id + '">' + esc(p.name) + "</a></h2>" +
          (m.pct != null ? '<span class="match-pill">' + m.pct + "% match</span>" : "") + "</div>" +
          (p.audienceTag ? '<p class="aud-tag">' + I("users") + " " + esc(p.audienceTag) + "</p>" : "") +
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
      '<div class="scard-title">' + typeBadge(p) + ' <span class="scard-tag">' + esc(L.orientation[p.orientation]) + "</span>" +
      (p.audienceTag ? ' <span class="scard-tag aud">' + esc(p.audienceTag) + "</span>" : "") + "<h2>" + esc(p.name) + "</h2>" +
      "<p>" + I("pin") + " " + esc(p.base.split(" (")[0]) + "</p></div></div>" +
      '<div class="scard-body">' +
      '<div class="scard-stats"><div>' + I("cost") + "<strong>" + esc(compactCost(p)) + "</strong></div><div>" + I("cal") + "<strong>" + esc(p.length.split(" · ")[0].split(" (")[0]) + '</strong></div><div>' + I("clock") + "<strong>" + deadline + "</strong></div></div>" +
      (p.highlights.length ? '<ul class="scard-points">' + p.highlights.map((h) => "<li>" + esc(h) + "</li>").join("") + "</ul>" : '<p class="scard-blurb">' + esc(p.blurb) + "</p>") +
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
    if (v === "__any") { // "Any" / "Don't care" / "Skip": an explicit choice that clears the group
      a.any[k] = true;
      if (act === "deal-pick") a.deal[k] = [];
      else if (act === "field-pick") a.field = [];
      else if (act === "city-pick") a.city = [];
      save(); const y0 = window.scrollY; render(); window.scrollTo(0, y0); return;
    }
    if (/^(deal|field|city)-pick$/.test(act)) a.any[k] = false;
    if (act === "deal-pick") {
      const def = DEAL[k];
      let arr = (a.deal[k] || []).slice();
      const i = arr.indexOf(v);
      if (def.multi) { if (i >= 0) arr.splice(i, 1); else arr.push(v); }
      else arr = i >= 0 ? [] : [v];
      a.deal[k] = arr;
    } else if (act === "pref-pick") {
      const cur = a.prefs[k] && a.prefs[k].want;
      a.prefs[k] = !+v ? { want: 0, weight: 0, dc: true } : cur === +v ? { want: 0, weight: 0 } : { want: +v, weight: 2 };
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
    if (act === "type-tab") { filters().type = el.dataset.value || ""; save(); return render(); }
    if (act === "cmp-add") {
      const l = cmpList();
      if (l.indexOf(el.dataset.id) < 0) { if (l.length >= CMP_MAX) l.pop(); l.push(el.dataset.id); }
      save(); location.hash = "#/compare"; return;
    }
    if (act === "cmp-remove") { cmpList().splice(+el.dataset.i, 1); save(); return render(); }
    if (act === "cmp-top3") { state.compare = matches().slice(0, 3).map((m) => m.p.id); save(); location.hash = "#/compare"; return; }
    if (act === "toggle-filters") { filters().open = !filters().open; save(); return render(); }
    if (act === "toggle-deadlines") { filters().dlOpen = !filters().dlOpen; save(); return render(); }
    if (act === "save") {
      state.saved[el.dataset.id] = !state.saved[el.dataset.id];
      if (!state.saved[el.dataset.id]) delete state.saved[el.dataset.id];
    } else if (act === "filter") {
      const arr = filters()[el.dataset.group];
      const i = arr.indexOf(el.dataset.value);
      if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.value);
    } else if (act === "clear-filters") {
      const old = state.filters || {};
      state.filters = { sort: old.sort, type: old.type, open: old.open, dlOpen: old.dlOpen };
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
    } else if (act === "col-add") {
      const name = (el.dataset.name || "").trim();
      if (!name || myIndex(name) >= 0) return;
      const ci = collegeInfo(name);
      const nf = notFoundList().find((n) => norm(n.name) === norm(name));
      state.colleges.push({ name: ci ? ci.name : nf ? nf.name : name, policy: ci ? collegeSummary(ci) : "", deadline: ci && ci.deadlineDate ? ci.deadlineDate : "", status: "", app: "", plan: "", appDeadline: "", notes: "" });
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
    else if (act === "cmp-same") { state.cmpSame = el.checked; save(); render(); }
    else if (act === "cmp-pick") {
      const l = cmpList(), i = +el.dataset.i;
      if (el.value) { const at = l.indexOf(el.value); if (at >= 0) l.splice(at, 1); l.splice(Math.min(i, l.length), i < l.length ? 1 : 0, el.value); }
      state.compare = l.slice(0, CMP_MAX); save(); render();
    }
    else if (act === "cost-range") { // re-render the grid once the slider is released (or per arrow key)
      filters().maxCost = budgetValue(el); save();
      const y = window.scrollY; render(); window.scrollTo(0, y);
      const r = $app.querySelector('[data-act="cost-range"]'); if (r) r.focus();
    }
  });

  $app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.bind && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "date" && el.type !== "checkbox"))) {
      bound(el, el.value); // typing saves without re-rendering, so focus is kept
    } else if (el.dataset.act === "budget-range" || el.dataset.act === "cost-range") {
      const v = budgetValue(el);
      el.setAttribute("aria-valuetext", budgetLabel(v));
      el.closest(".budget-slider").querySelector(".bs-val").textContent = budgetLabel(v);
      if (el.dataset.act === "budget-range") {
        quiz().answers.deal.max = v;
        save();
        const n = matches().length, lc = $app.querySelector(".live-count");
        if (lc) lc.innerHTML = "<strong>" + n + "</strong> program" + (n === 1 ? "" : "s") + " fit your basics";
      }
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

  // Hover tooltip for chart marks ([data-tip]); values are also printed as text, so this is a convenience.
  const tip = document.createElement("div");
  tip.className = "viz-tip"; tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
  });
  document.addEventListener("mousemove", (e) => {
    if (tip.hidden) return;
    const w = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 12) + "px";
    tip.style.top = e.clientY + 14 + "px";
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
