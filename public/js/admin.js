/* Admin page (#/admin): edit program and college data without touching code.
 * Loaded only for admins (see checkAdmin in app.js). The database itself enforces who may write:
 * row-level security only lets users listed in public.admins change these tables.
 *
 * A saved edit replaces the built-in entry with the same id for every student, straight away.
 * Every save copies the previous version to content_history, so any change can be undone.
 */
(function () {
  "use strict";

  let C = null;              // context from app.js (sb, data, helpers)
  let tab = "programs";
  let query = "";
  let openId = null;         // item being edited
  let draft = null;          // working copy of the item being edited
  let draftKind = "policy";  // colleges only: "policy" or "not_found"
  let draftFor = null;       // "programs:<id>" the draft belongs to
  let checked = false;       // "I checked this against the source today"
  let note = null;           // { kind, text } message shown above the editor
  let history = null;        // earlier versions of the open item
  let errors = null;         // rows from client_errors
  let ideas = null;          // rows from suggestions (Home › Contact)
  const pendingNew = {};     // new items not saved yet: "programs:<id>" -> data

  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const hashFor = (t, id) => "#/admin/" + t + (id != null ? "/" + encodeURIComponent(id) : "");
  const get = (o, path) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
  function set(o, path, v) {
    const ks = path.split(".");
    let x = o;
    ks.slice(0, -1).forEach((k) => { if (x[k] == null || typeof x[k] !== "object") x[k] = {}; x = x[k]; });
    if (v === undefined) delete x[ks[ks.length - 1]]; else x[ks[ks.length - 1]] = v;
  }

  // ---------- Field definitions ----------
  // kind: text | url | number | date | area | lines (one list item per line) | select | deadlines
  const PROGRAM_FIELDS = [
    ["Basics"],
    ["name", "Name", "text"],
    ["short", "Short name (on cards)", "text"],
    ["operator", "Run by", "text"],
    ["website", "Official website", "url"],
    ["blurb", "Description", "area"],
    ["highlights", "Highlights (one per line, shown on swipe cards)", "lines"],
    ["audience", "Who can apply (leave empty if open to everyone)", "area", { optional: true }],
    ["Cost and dates"],
    ["costUSD", "Cost in US dollars (number, for filters and sorting)", "number"],
    ["costText", "Cost as shown to students", "text"],
    ["length", "Length", "text"],
    ["endDate", "Program end date", "date"],
    ["base", "Where students live", "text"],
    ["Application"],
    ["app.deadlines", "Deadlines", "deadlines"],
    ["app.rolling", "Rolling admissions", "select", { options: [[true, "Yes"], [false, "No"]] }],
  ];
  const DEADLINE_TYPES = [["priority", "Priority / early"], ["regular", "Regular"], ["rolling", "Rolling"], ["other", "Other"]];
  const COLLEGE_FIELDS = [
    ["Deferral"],
    ["deferral", "Deferral for a gap year", "select", { options: [[null, "Not published"], ["yes", "Yes"], ["case", "Case by case"], ["no", "No"]] }],
    ["how", "How to request it", "area"],
    ["deadline", "Request by (as the college words it)", "text"],
    ["deadlineDate", "Request-by date (for reminders)", "date"],
    ["length", "How long you can defer", "text"],
    ["deposit", "Deposit required", "select", { options: [[null, "Not published"], [true, "Yes"], [false, "No"]] }],
    ["noApplyingElsewhere", "Can't apply to other colleges while deferred", "select", { options: [[null, "Not published"], [true, "Yes"], [false, "No"]] }],
    ["Credit and rules"],
    ["creditLevel", "Gap year credit", "select", { options: [["unclear", "Unclear"], ["yes", "Accepted"], ["limited", "Limited"], ["none", "Not accepted"]] }],
    ["credit", "Credit details", "area"],
    ["grades", "Rules while deferred", "area"],
    ["israel", "Anything about Israel programs", "area"],
    ["Source"],
    ["source", "Source page (the college's own website)", "url"],
    ["quote", "Quote from the source", "area"],
  ];
  const COLLEGE_BLANK = { deferral: null, how: null, deadline: null, deadlineDate: null, length: null, deposit: null, creditLevel: "unclear", credit: null, grades: null, israel: null, noApplyingElsewhere: null, source: null, quote: null };

  // ---------- Data helpers ----------
  const tableOf = (t) => (t === "programs" ? "programs" : "colleges");
  function allIds(t) {
    const ids = Object.keys(C.BUILTIN[t]);
    Object.keys(C.EDITS[t]).forEach((id) => { if (ids.indexOf(id) < 0) ids.push(id); });
    return ids;
  }
  function current(t, id) {
    const e = C.EDITS[t][id];
    if (t === "programs") return e ? e.data : C.BUILTIN.programs[id];
    return e ? e.data : C.BUILTIN.colleges[id] && C.BUILTIN.colleges[id].data;
  }
  const kindOf = (id) => { const e = C.EDITS.colleges[id]; return e ? e.kind : C.BUILTIN.colleges[id] ? C.BUILTIN.colleges[id].kind : "policy"; };
  function status(t, id) {
    const e = C.EDITS[t][id], d = current(t, id) || {};
    const out = [];
    if (pendingNew[t + ":" + id]) out.push(["warn", "Not saved"]);
    else if (e && !C.BUILTIN[t][id]) out.push(["accent", "Added"]);
    else if (e) out.push(["accent", "Edited"]);
    if (d.hidden) out.push(["bad", "Hidden"]);
    return out;
  }
  const pills = (list) => list.map((x) => '<span class="chip ' + x[0] + '">' + x[1] + "</span>").join(" ");
  const IDEA_KIND = { program: "Program", feature: "Feature", fix: "Fix", other: "Other" };
  function ideasView() {
    if (ideas == null) return '<p class="muted">Loading…</p>';
    if (ideas.error) return '<div class="callout warn">Couldn\'t load suggestions. If you haven\'t yet, run <code>supabase/migrations/0007_suggestions.sql</code> in the Supabase SQL editor.</div>';
    return '<p class="muted">What people sent from Home › Contact, newest first.</p>' +
      '<button class="btn sm" type="button" data-adm="ideas-reload">Refresh</button>' +
      (ideas.rows.length ? '<ul class="admin-errs admin-ideas">' + ideas.rows.map((r) =>
        '<li><div class="small muted"><span class="tag">' + C.esc(IDEA_KIND[r.kind] || r.kind) + "</span> " + C.esc(new Date(r.created_at).toLocaleString()) +
        (r.contact ? ' · Reply to <a href="mailto:' + C.esc(r.contact) + '">' + C.esc(r.contact) + "</a>" : "") + "</div>" +
        '<p class="admin-idea">' + C.esc(r.message || "") + "</p>" +
        '<button class="btn sm" type="button" data-adm="idea-del" data-id="' + C.esc(r.id) + '">Delete</button></li>').join("") + "</ul>"
        : '<p class="muted" style="margin-top:12px">No suggestions yet.</p>');
  }

  const verified = (t, id) => (C.EDITS[t][id] && C.EDITS[t][id].verified_at) || null;

  // ---------- Rendering ----------
  function render(ctx, sub) {
    C = ctx;
    const parts = (sub || "").split("/");
    tab = ["programs", "colleges", "errors", "suggestions"].indexOf(parts[0]) >= 0 ? parts[0] : "programs";
    openId = parts[1] ? decodeURIComponent(parts.slice(1).join("/")) : null;
    const key = tab + ":" + openId;
    if (openId && draftFor !== key) {
      const src = pendingNew[key] || current(tab, openId);
      if (!src) { openId = null; } else {
        draft = C.clone(src);
        draftKind = tab === "colleges" ? (pendingNew[key] ? "policy" : kindOf(openId)) : null;
        draftFor = key; checked = false; history = null; note = null;
        loadHistory(tab, openId);
      }
    }
    if (!openId) { draftFor = null; draft = null; }
    if (tab === "errors" && errors == null) loadErrors();
    if (tab === "suggestions" && ideas == null) loadIdeas();
    paint();
  }

  function paint() {
    const counts = { programs: allIds("programs").length, colleges: allIds("colleges").length };
    const tabLink = (t, label) => '<a href="' + hashFor(t) + '"' + (tab === t ? ' class="active"' : "") + ">" + label + "</a>";
    C.$app.innerHTML =
      '<div class="admin">' +
      '<div class="admin-head"><div><h1>Edit site data</h1>' +
      '<p class="muted">Changes go live for every student as soon as you save. Each save keeps the previous version under History, so nothing is lost.</p></div>' +
      '<button class="btn" type="button" data-adm="export">Download all data</button></div>' +
      '<nav class="tabs" aria-label="Admin sections">' + tabLink("programs", "Programs (" + counts.programs + ")") + tabLink("colleges", "Colleges (" + counts.colleges + ")") + tabLink("errors", "Errors") + tabLink("suggestions", "Suggestions") + "</nav>" +
      (tab === "errors" ? errorsView() : tab === "suggestions" ? ideasView() : openId ? editorView() : listView()) +
      "</div>";
  }

  function listView() {
    const q = query.trim().toLowerCase();
    const ids = allIds(tab).filter((id) => {
      const d = current(tab, id) || {};
      return !q || (id + " " + (d.name || "") + " " + (d.short || "")).toLowerCase().indexOf(q) >= 0;
    }).sort((a, b) => String((current(tab, a) || {}).name || a).localeCompare(String((current(tab, b) || {}).name || b)));
    const edited = allIds(tab).filter((id) => C.EDITS[tab][id]).length;
    return '<div class="admin-bar"><input class="input" type="search" placeholder="Search ' + tab + '…" value="' + C.esc(query) + '" data-adm-input="search" aria-label="Search" />' +
      (tab === "colleges" ? '<button class="btn primary" type="button" data-adm="new">Add a college</button>' : "") + "</div>" +
      '<p class="small muted">' + edited + " of " + allIds(tab).length + " have edits saved on top of the built-in data." + (tab === "programs" ? " To add a program, start from a similar one: open it and choose Duplicate." : "") + "</p>" +
      '<ul class="admin-list">' + ids.map((id) => {
        const d = current(tab, id) || {};
        const v = verified(tab, id);
        return '<li><a href="' + hashFor(tab, id) + '"><span class="admin-name">' + C.esc(d.name || id) + "</span>" +
          '<span class="admin-meta">' + pills(status(tab, id)) + (tab === "colleges" && kindOf(id) === "not_found" ? ' <span class="chip">No policy found</span>' : "") +
          (v ? ' <span class="small muted">checked ' + C.esc(C.fmtDate(v)) + "</span>" : "") + "</span></a></li>";
      }).join("") + "</ul>" +
      (ids.length ? "" : '<p class="muted">Nothing matches "' + C.esc(query) + '".</p>');
  }

  function fieldHtml(f) {
    if (f.length === 1) return '<h3 class="admin-group">' + f[0] + "</h3>";
    const [path, label, kind, opt] = f;
    const v = get(draft, path);
    const name = ' data-adm-field="' + path + '" data-kind="' + kind + '"';
    const id = "f-" + path.replace(/\W/g, "-");
    let input;
    if (kind === "area") input = '<textarea class="input" rows="3" id="' + id + '"' + name + ">" + C.esc(v == null ? "" : v) + "</textarea>";
    else if (kind === "lines") input = '<textarea class="input" rows="3" id="' + id + '"' + name + ">" + C.esc((v || []).join("\n")) + "</textarea>";
    else if (kind === "select") input = '<select class="input" id="' + id + '"' + name + ">" + opt.options.map((o) => '<option value="' + C.esc(JSON.stringify(o[0])) + '"' + (JSON.stringify(o[0]) === JSON.stringify(v === undefined ? null : v) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
    else if (kind === "deadlines") return deadlinesHtml(v || []);
    else input = '<input class="input" id="' + id + '" type="' + (kind === "number" ? "number" : kind === "date" ? "date" : kind === "url" ? "url" : "text") + '" value="' + C.esc(v == null ? "" : v) + '"' + name + " />";
    return '<label class="field" for="' + id + '">' + label + input + "</label>";
  }
  function deadlinesHtml(list) {
    return '<div class="field"><span>Deadlines</span><div class="admin-dl">' + list.map((d, i) =>
      '<div class="admin-dl-row">' +
      '<input class="input" placeholder="Label, e.g. Early Action" value="' + C.esc(d.label || "") + '" data-adm-dl="' + i + '" data-k="label" aria-label="Deadline label" />' +
      '<input class="input" type="date" value="' + C.esc(d.date || "") + '" data-adm-dl="' + i + '" data-k="date" aria-label="Deadline date" />' +
      '<select class="input" data-adm-dl="' + i + '" data-k="type" aria-label="Deadline type">' + DEADLINE_TYPES.map((t) => '<option value="' + t[0] + '"' + (d.type === t[0] ? " selected" : "") + ">" + t[1] + "</option>").join("") + "</select>" +
      '<input class="input admin-dl-note" placeholder="Note (optional)" value="' + C.esc(d.note || "") + '" data-adm-dl="' + i + '" data-k="note" aria-label="Deadline note" />' +
      '<button class="btn sm" type="button" data-adm="dl-remove" data-i="' + i + '" aria-label="Remove this deadline">Remove</button></div>'
    ).join("") + '<button class="btn sm" type="button" data-adm="dl-add">Add a deadline</button></div></div>';
  }

  function editorView() {
    const t = tab, id = openId, key = t + ":" + id;
    const isNew = !!pendingNew[key];
    const e = C.EDITS[t][id];
    const fields = t === "programs" ? PROGRAM_FIELDS : COLLEGE_FIELDS;
    const v = verified(t, id);
    const problems = t === "programs" ? C.programProblems(draft, id) : C.collegeProblems(draft, id);
    const viewHref = t === "programs" && C.byId[id] ? "#/program/" + id : null;
    return '<p><a href="' + hashFor(t) + '">← All ' + t + "</a></p>" +
      '<div class="admin-ed-head"><div><h2>' + C.esc(draft.name || id) + "</h2>" +
      '<p class="small muted">' + pills(status(t, id)) + " " +
      (isNew ? "New, not saved yet." : e ? "Last saved " + C.esc(C.fmtDate(e.updated_at.slice(0, 10))) + "." : "Built-in data, no edits yet.") +
      (v ? " Checked against the source " + C.esc(C.fmtDate(v)) + "." : "") +
      (viewHref ? ' <a href="' + viewHref + '">View on site →</a>' : "") + "</p></div></div>" +
      (note ? '<div class="callout ' + note.kind + '" role="status">' + C.esc(note.text) + "</div>" : "") +
      (draft.hidden ? '<div class="callout warn">Hidden: students don\'t see this ' + (t === "programs" ? "program" : "college") + ". Choose Show on site when it's ready.</div>" : "") +
      '<div class="admin-ed">' +
      '<div class="admin-form card">' +
      (t === "colleges" ? '<label class="field" for="f-kind">Type<select class="input" id="f-kind" data-adm-kind="1"><option value="policy"' + (draftKind === "policy" ? " selected" : "") + '>Has a gap year policy</option><option value="not_found"' + (draftKind === "not_found" ? " selected" : "") + ">No policy found on its website</option></select></label>" : "") +
      fields.map(fieldHtml).join("") +
      '<details class="admin-json"><summary>All fields (advanced)</summary>' +
      '<p class="small muted">Everything stored for this ' + (t === "programs" ? "program, including daily life (details) and the weekly time breakdown (time)" : "college") + '. Edit carefully; it\'s checked before saving. Unknown facts should be <code>null</code>, never guessed.</p>' +
      '<textarea class="input mono" rows="18" data-adm-json="1" spellcheck="false" aria-label="All fields as JSON">' + C.esc(JSON.stringify(draft, null, 2)) + "</textarea>" +
      '<button class="btn sm" type="button" data-adm="json-apply">Apply these fields</button></details>' +
      "</div>" +
      '<aside class="admin-side">' +
      '<div class="card">' +
      (problems.length && !draft.hidden ? '<div class="callout bad"><strong>Fix before saving:</strong><ul>' + problems.slice(0, 8).map((x) => "<li>" + C.esc(x) + "</li>").join("") + "</ul></div>" : "") +
      '<label class="admin-check"><input type="checkbox" data-adm-check="1"' + (checked ? " checked" : "") + " /> I checked this against " + (t === "programs" ? "the program's" : "the college's") + " own website today</label>" +
      '<button class="btn primary admin-save" type="button" data-adm="save">' + (isNew ? "Save" : "Save changes") + "</button>" +
      '<div class="admin-actions">' +
      '<button class="btn sm" type="button" data-adm="toggle-hidden">' + (draft.hidden ? "Show on site" : "Hide from site") + "</button>" +
      (t === "programs" ? '<button class="btn sm" type="button" data-adm="duplicate">Duplicate as a new program</button>' : "") +
      (e && C.BUILTIN[t][id] ? '<button class="btn sm" type="button" data-adm="revert">Undo all edits (back to built-in)</button>' : "") +
      (e && !C.BUILTIN[t][id] ? '<button class="btn sm danger" type="button" data-adm="delete">Delete</button>' : "") +
      (isNew ? '<button class="btn sm" type="button" data-adm="discard">Discard</button>' : "") +
      "</div></div>" +
      '<div class="card"><h3>History</h3>' + historyHtml() + "</div>" +
      "</aside></div>";
  }
  function historyHtml() {
    if (history == null) return '<p class="small muted">Loading…</p>';
    if (history.error) return '<p class="small muted">Couldn\'t load history.</p>';
    if (!history.rows.length) return '<p class="small muted">No earlier versions yet. Each save keeps the version before it here.</p>';
    return '<p class="small muted">Versions from before each save. Loading one puts it in the form; nothing changes until you save.</p><ul class="admin-hist">' +
      history.rows.map((h, i) => "<li><span>" + C.esc(new Date(h.changed_at).toLocaleString()) + '</span><button class="btn sm" type="button" data-adm="hist-load" data-i="' + i + '">Load</button></li>').join("") + "</ul>";
  }

  function errorsView() {
    if (errors == null) return '<p class="muted">Loading…</p>';
    if (errors.error) return '<div class="callout warn">Couldn\'t load the error log. If you haven\'t yet, run <code>supabase/migrations/0002_content_admin.sql</code> in the Supabase SQL editor.</div>';
    return '<p class="muted">The latest errors students\' browsers ran into (at most 5 per visit). Who it was isn\'t shown.</p>' +
      '<button class="btn sm" type="button" data-adm="errors-reload">Refresh</button>' +
      (errors.rows.length ? '<ul class="admin-errs">' + errors.rows.map((r) =>
        '<li><div class="small muted">' + C.esc(new Date(r.created_at).toLocaleString()) + " · " + C.esc(r.page || "") + "</div>" +
        "<pre>" + C.esc(r.message || "") + "</pre>" +
        '<div class="small muted">' + C.esc(r.user_agent || "") + "</div></li>").join("") + "</ul>"
        : '<p class="muted" style="margin-top:12px">No errors logged. Good news.</p>');
  }

  // ---------- Loading ----------
  async function loadHistory(t, id) {
    const key = t + ":" + id;
    if (pendingNew[key]) { history = { rows: [] }; return; }
    const { data, error } = await C.sb.from("content_history").select("id, data, changed_at").eq("table_name", tableOf(t)).eq("item_id", id).order("changed_at", { ascending: false }).limit(15);
    if (draftFor !== key) return;
    history = error ? { error: true } : { rows: data || [] };
    paintSide();
  }
  async function loadErrors() {
    const { data, error } = await C.sb.from("client_errors").select("created_at, page, message, user_agent").order("created_at", { ascending: false }).limit(50);
    errors = error ? { error: true } : { rows: data || [] };
    if (tab === "errors") paint();
  }
  async function loadIdeas() {
    const { data, error } = await C.sb.from("suggestions").select("id, created_at, kind, message, contact, page").order("created_at", { ascending: false }).limit(100);
    ideas = error ? { error: true } : { rows: data || [] };
    if (tab === "suggestions") paint();
  }
  // Repaint without losing the cursor in the field being typed in.
  function paintSide() {
    const f = document.activeElement;
    const sel = f && f.dataset && (f.dataset.admInput ? '[data-adm-input="' + f.dataset.admInput + '"]' : f.dataset.admField ? '[data-adm-field="' + f.dataset.admField + '"]' : f.dataset.admDl != null ? '[data-adm-dl="' + f.dataset.admDl + '"][data-k="' + f.dataset.k + '"]' : f.dataset.admJson ? "[data-adm-json]" : null);
    const pos = sel && "selectionStart" in f ? [f.selectionStart, f.selectionEnd] : null;
    const scroll = window.scrollY;
    paint();
    if (sel) {
      const g = C.$app.querySelector(sel);
      if (g) { g.focus(); try { if (pos) g.setSelectionRange(pos[0], pos[1]); } catch (e) { /* not a text field */ } }
    }
    window.scrollTo(0, scroll);
  }

  // ---------- Saving ----------
  const COLS = { programs: "id, data, verified_at, updated_at", colleges: "id, kind, data, verified_at, updated_at" };
  async function save() {
    const t = tab, id = openId, key = t + ":" + id;
    const problems = t === "programs" ? C.programProblems(draft, id) : C.collegeProblems(draft, id);
    if (problems.length && !draft.hidden) { note = { kind: "bad", text: "Not saved: fix the problems listed first." }; return paintSide(); }
    const prev = C.EDITS[t][id];
    const payload = { data: draft, verified_at: checked ? today() : prev ? prev.verified_at : null };
    if (t === "colleges") payload.kind = draftKind;
    // Only save over the version this page loaded, so two editors can't silently overwrite each other.
    const q = prev
      ? C.sb.from(tableOf(t)).update(payload).eq("id", id).eq("updated_at", prev.updated_at)
      : C.sb.from(tableOf(t)).insert(Object.assign({ id: id }, payload));
    note = { kind: "ok", text: "Saving…" }; paintSide();
    const { data, error } = await q.select(COLS[t]);
    if ((error && error.code === "23505") || (!error && (!data || !data.length))) {
      note = { kind: "bad", text: "Not saved: someone else saved this since you opened it. Reload the page to see their version, then make your change again." };
      return paintSide();
    }
    if (error) {
      note = { kind: "bad", text: "Not saved: " + (error.message || "the database refused the change") + (/permission|policy|42501/i.test(error.message + error.code) ? ". Is your account listed in the admins table?" : "") };
      return paintSide();
    }
    delete pendingNew[key];
    C.setEdit(t, id, data[0]);
    draft = C.clone(data[0].data);
    checked = false;
    note = { kind: "ok", text: "Saved. Students see this now." };
    history = null; paintSide(); loadHistory(t, id);
  }
  async function removeEdit(label) {
    const t = tab, id = openId, prev = C.EDITS[t][id];
    if (!prev) return;
    const { data, error } = await C.sb.from(tableOf(t)).delete().eq("id", id).eq("updated_at", prev.updated_at).select("id");
    if (error || !data || !data.length) { note = { kind: "bad", text: error ? "Couldn't " + label + ": " + error.message : "Not changed: someone else saved this since you opened it. Reload the page." }; return paintSide(); }
    C.setEdit(t, id, null);
    if (C.BUILTIN[t][id]) {
      draft = C.clone(current(t, id)); draftKind = t === "colleges" ? kindOf(id) : null;
      note = { kind: "ok", text: "Back to the built-in version. The edit you removed is under History." };
      history = null; paintSide(); loadHistory(t, id);
    } else {
      draftFor = null; location.hash = hashFor(t);
    }
  }

  function exportAll() {
    const programs = allIds("programs").map((id) => Object.assign({ verified_at: verified("programs", id) }, current("programs", id)));
    const colleges = allIds("colleges").map((id) => ({ kind: kindOf(id), verified_at: verified("colleges", id), data: current("colleges", id) }));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), programs, colleges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gap-year-finder-site-data-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Events (one set of listeners, active only on the admin page) ----------
  const onAdmin = () => C && location.hash.indexOf("#/admin") === 0 && C.$app.querySelector(".admin");
  function fieldValue(el) {
    const k = el.dataset.kind;
    if (k === "select") return JSON.parse(el.value);
    if (k === "lines") return el.value.split("\n").map((x) => x.trim()).filter(Boolean);
    if (k === "number") return el.value === "" ? null : Number(el.value);
    const v = el.value.trim();
    return v === "" ? null : v;
  }
  function syncJson() {
    const j = C.$app.querySelector("[data-adm-json]");
    if (j && document.activeElement !== j) j.value = JSON.stringify(draft, null, 2);
  }
  function updateField(el) {
    const f = (tab === "programs" ? PROGRAM_FIELDS : COLLEGE_FIELDS).find((x) => x[0] === el.dataset.admField);
    let v = fieldValue(el);
    if (v === null && f && f[3] && f[3].optional) v = undefined; // optional fields are left out when empty
    set(draft, el.dataset.admField, v);
    note = null; syncJson();
  }
  document.addEventListener("input", (e) => {
    if (!onAdmin()) return;
    const el = e.target;
    if (el.dataset.admInput === "search") { query = el.value; return paintSide(); }
    if (el.dataset.admField) return updateField(el);
    if (el.dataset.admDl != null) {
      const list = get(draft, "app.deadlines") || [];
      const d = list[+el.dataset.admDl];
      if (d) { const v = el.value.trim(); d[el.dataset.k] = v === "" ? null : v; }
      syncJson();
    }
  });
  document.addEventListener("change", (e) => {
    if (!onAdmin()) return;
    const el = e.target;
    if (el.dataset.admCheck) { checked = el.checked; return; }
    if (el.dataset.admKind) { draftKind = el.value; return; }
    if (el.dataset.admField) updateField(el);
    // Refresh the problems list after picks; not after typing, where a repaint on blur would swallow the next click.
    if ((el.dataset.admField || el.dataset.admDl != null) && (el.tagName === "SELECT" || el.type === "date")) return paintSide();
  });
  document.addEventListener("click", async (e) => {
    if (!onAdmin()) return;
    const b = e.target.closest("[data-adm]");
    if (!b) return;
    const act = b.dataset.adm;
    if (act === "export") return exportAll();
    if (act === "errors-reload") { errors = null; paint(); return loadErrors(); }
    if (act === "ideas-reload") { ideas = null; paint(); return loadIdeas(); }
    if (act === "idea-del") {
      const id = b.dataset.id;
      const { error } = await C.sb.from("suggestions").delete().eq("id", id);
      if (!error && ideas && ideas.rows) ideas.rows = ideas.rows.filter((r) => String(r.id) !== String(id));
      return paint();
    }
    if (act === "save") return save();
    if (act === "dl-add") { const app = draft.app || (draft.app = {}); (app.deadlines = app.deadlines || []).push({ label: "", date: null, type: "regular", note: null }); return paintSide(); }
    if (act === "dl-remove") { draft.app.deadlines.splice(+b.dataset.i, 1); return paintSide(); }
    if (act === "json-apply") {
      let v;
      try { v = JSON.parse(C.$app.querySelector("[data-adm-json]").value); } catch (err) { note = { kind: "bad", text: "That isn't valid JSON: " + err.message }; return paintSide(); }
      draft = v; note = { kind: "ok", text: "Fields applied. Save to keep them." };
      return paintSide();
    }
    if (act === "toggle-hidden") {
      if (draft.hidden) delete draft.hidden; else draft.hidden = true;
      return save();
    }
    if (act === "revert") {
      if (!confirm("Remove all saved edits to this " + (tab === "programs" ? "program" : "college") + " and go back to the built-in data?")) return;
      return removeEdit("undo the edits");
    }
    if (act === "delete") {
      if (!confirm("Delete " + (draft.name || openId) + " from the site? It stays in History.")) return;
      return removeEdit("delete it");
    }
    if (act === "discard") { delete pendingNew[tab + ":" + openId]; draftFor = null; location.hash = hashFor(tab); return; }
    if (act === "hist-load") {
      const h = history && history.rows && history.rows[+b.dataset.i];
      if (!h || !h.data) return;
      draft = C.clone(h.data);
      note = { kind: "warn", text: "Loaded the version from " + new Date(h.changed_at).toLocaleString() + ". Save to make it live again." };
      return paintSide();
    }
    if (act === "duplicate" || act === "new") {
      const isProgram = tab === "programs";
      const name = (prompt(isProgram ? "Name of the new program:" : "Full name of the college, as the college writes it:") || "").trim();
      if (!name) return;
      const id = isProgram ? slug(name) : name;
      if (!id || current(tab, id) || pendingNew[tab + ":" + id]) { alert("There's already " + (isProgram ? "a program" : "a college") + " with that name."); return; }
      let data;
      if (isProgram) {
        data = C.clone(draft);
        data.id = id; data.name = name; data.short = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 4).toUpperCase();
        // Keep the structure, drop facts that belong only to the original program.
        data.photo = null; data.website = null; data.sources = []; data.highlights = [];
        data.details = null; data.time = null; delete data.audience;
        data.blurb = ""; data.costText = ""; data.costUSD = null; data.length = ""; data.base = ""; data.endDate = null; data.operator = "";
        if (data.app) data.app.deadlines = [];
        data.hidden = true; // starts hidden until it's filled in
        note = { kind: "warn", text: "Copied from " + draft.name + ". Fill in this program's own facts (leave unknowns empty), and check the match ratings under All fields, which are still the original's. Then choose Show on site." };
      } else {
        data = Object.assign({ name: name }, COLLEGE_BLANK);
      }
      pendingNew[tab + ":" + id] = data;
      draftFor = null;
      const keep = note;
      location.hash = hashFor(tab, id);
      setTimeout(() => { if (keep && draftFor === tab + ":" + id) { note = keep; paintSide(); } }, 0);
      return;
    }
  });

  window.GYF_ADMIN = { render: render };
})();
