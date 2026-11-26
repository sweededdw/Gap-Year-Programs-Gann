// Community: opt-in student profiles, the organizations students belong to (BBYO, NCSY, ...), and who's
// interested in each gap year. The privacy rules live in the database (supabase/migrations/0003_community.sql):
// this page only shows what the database returns, which is your own rows plus profiles other students chose to show.
(function () {
  window.GYF_COMMUNITY = function (ctx) {
    const { esc, I, byId } = ctx;
    const ORGS = window.GYF_ORGS || { kinds: {}, orgs: [] };
    const orgById = {};
    ORGS.orgs.forEach((o) => (orgById[o.id] = o));
    const S = { loaded: false, loading: null, off: false, failed: false, profiles: {}, members: [], interest: [], bans: {}, editing: false, formError: "", flash: "",
      groups: {}, groupsOff: false, reports: [], groupForm: false, groupError: "" };
    const GROUP_KIND = { chapter: "Chapter of an organization", school: "School club", friends: "Friends", other: "Student group" };
    const RULES = ["No racism, antisemitism, xenophobia or hate toward any group of people", "No bullying, threats or harassment", "No phone numbers, addresses, links or social media", "An admin reviews every new group before other students can see it"];
    // Organizations from orgs.js, or a student group from the database ("g-" + its id).
    function org(id) {
      if (orgById[id]) return orgById[id];
      const g = typeof id === "string" && id.indexOf("g-") === 0 ? S.groups[id.slice(2)] : null;
      if (!g) return null;
      const parent = g.parent_org && orgById[g.parent_org];
      return { id: id, name: g.name, short: initials(g.name), kind: "student", community: GROUP_KIND[g.kind] || GROUP_KIND.other, parent: parent || null,
        grades: null, blurb: g.description || "", website: null, sources: [], programs: [], group: g };
    }
    const label = (o) => (o.group ? o.name : o.short);
    const wordingMsg = (e) => (e && e.code === "23514" && /wording/i.test(e.message || "") ? "That wording isn't allowed here. Please change it." : null);
    const uid = () => ctx.userId();
    const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
    const LINK = /(https?:\/\/|www\.)/i;

    // ---------- Data ----------
    function load(force) {
      if (!ctx.sb()) { S.off = true; S.loaded = true; return Promise.resolve(); }
      if (S.loaded && !force) return Promise.resolve();
      if (S.loading) return S.loading;
      const sb = ctx.sb();
      const qs = [
        sb.from("profiles").select("user_id, display_name, school, grad_year, visible").limit(5000),
        sb.from("org_members").select("user_id, org_id").limit(20000),
        sb.from("program_interest").select("user_id, program_id").limit(20000),
      ];
      qs.push(ctx.isAdmin() ? sb.from("community_bans").select("user_id").limit(5000) : Promise.resolve({ data: [] }));
      qs.push(sb.from("student_groups").select("id, name, description, kind, parent_org, created_by, status, created_at").limit(5000));
      qs.push(ctx.isAdmin() ? sb.from("community_reports").select("id, target_type, target_id, reason, created_at, resolved").eq("resolved", false).limit(500) : Promise.resolve({ data: [] }));
      S.loading = Promise.all(qs.map((q) => Promise.resolve(q).catch((e) => ({ error: e })))).then((all) => {
        const res = all.slice(0, 4), gr = all[4], rp = all[5];
        S.groupsOff = !!gr.error;
        S.groups = {};
        if (!gr.error) (gr.data || []).forEach((g) => (S.groups[g.id] = g));
        S.reports = rp.error ? [] : rp.data || [];
        const bad = res.find((r) => r.error);
        S.off = !!bad && missing(bad.error);
        S.failed = !!bad && !S.off;
        if (!bad) {
          S.profiles = {};
          (res[0].data || []).forEach((p) => (S.profiles[p.user_id] = p));
          S.members = res[1].data || [];
          S.interest = (res[2].data || []).filter((m) => byId[m.program_id]);
          S.bans = {};
          ((res[3] && res[3].data) || []).forEach((b) => (S.bans[b.user_id] = 1));
        }
        S.loaded = true;
      }).finally(() => { S.loading = null; });
      return S.loading;
    }

    const me = () => S.profiles[uid()] || null;
    const meShown = () => !!(me() && me().visible);
    // People the viewer may see: themselves, plus whoever the database returned (shown profiles).
    // Admins also get hidden profiles back so they can unhide them; those aren't listed with everyone else.
    const listed = (id) => id === uid() || (!!S.profiles[id] && !S.bans[id]);
    const orgsOf = (id) => S.members.filter((m) => m.user_id === id).map((m) => org(m.org_id)).filter(Boolean);
    const interestsOf = (id) => S.interest.filter((m) => m.user_id === id).map((m) => byId[m.program_id]);
    const membersOf = (oid) => S.members.filter((m) => m.org_id === oid && listed(m.user_id)).map((m) => m.user_id);
    const groupOpen = (o) => !o.group || o.group.status === "approved" || o.group.created_by === uid();
    const interestedIn = (pid) => S.interest.filter((m) => m.program_id === pid && listed(m.user_id)).map((m) => m.user_id);
    const isMember = (oid) => S.members.some((m) => m.user_id === uid() && m.org_id === oid);
    const isInterested = (pid) => S.interest.some((m) => m.user_id === uid() && m.program_id === pid);
    const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
    function rank(ids) {
      const n = {};
      S.interest.forEach((m) => { if (ids.indexOf(m.user_id) >= 0) n[m.program_id] = (n[m.program_id] || 0) + 1; });
      return Object.keys(n).map((id) => ({ p: byId[id], n: n[id] })).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name));
    }
    function mine() {
      return { profile: me(), organizations: orgsOf(uid()).map((o) => (o.group ? { id: o.id, name: o.name } : o.id)), interestedIn: interestsOf(uid()).map((p) => p.id),
        groupsCreated: Object.keys(S.groups).map((id) => S.groups[id]).filter((g) => g.created_by === uid()).map((g) => ({ name: g.name, description: g.description, status: g.status })) };
    }

    // ---------- Pieces ----------
    const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    function personRow(id, opts) {
      opts = opts || {};
      const p = S.profiles[id], self = id === uid();
      const name = p ? p.display_name : "You";
      const sub = [p && p.school, p && p.grad_year ? "Class of " + p.grad_year : ""].filter(Boolean).join(" · ");
      const groups = orgsOf(id).filter((o) => o.id !== opts.skipOrg).slice(0, 3).map((o) => '<a class="chip" href="#/community/org/' + o.id + '">' + esc(label(o)) + "</a>").join("");
      const ints = opts.interests === false ? "" : interestsOf(id).slice(0, 3).map((x) => '<a class="chip accent" href="#/program/' + x.id + '">' + esc(x.name) + "</a>").join("");
      const tag = self ? '<span class="chip">' + (meShown() ? "You" : "You · only you can see this") + "</span>" : "";
      const mod = self || !p ? "" : ctx.isAdmin() ? '<button class="btn ghost sm" data-act="comm-hide" data-id="' + esc(id) + '">Hide</button>'
        : '<button class="btn ghost sm comm-report" data-act="comm-report-profile" data-id="' + esc(id) + '" aria-label="Report ' + esc(name) + '">Report</button>';
      return '<li class="person"><span class="avatar" aria-hidden="true">' + esc(initials(name)) + "</span>" +
        '<div class="person-body"><div class="person-name"><strong>' + esc(name) + "</strong> " + tag + "</div>" +
        (sub ? '<div class="small muted">' + esc(sub) + "</div>" : "") +
        (groups || ints ? '<div class="chips person-chips">' + groups + ints + "</div>" : "") + "</div>" + mod + "</li>";
    }
    function joinButton(o) {
      if (!groupOpen(o)) return "";
      const on = isMember(o.id);
      return '<button class="btn sm' + (on ? " on" : " primary") + '" data-act="comm-join" data-id="' + o.id + '" aria-pressed="' + on + '">' + (on ? I("check") + " Joined" : "Join") + "</button>";
    }
    function profileForm(p) {
      const y0 = new Date().getFullYear(), years = [];
      for (let y = y0 - 1; y <= y0 + 4; y++) years.push(y);
      if (p && p.grad_year && years.indexOf(p.grad_year) < 0) years.push(p.grad_year);
      return '<div class="comm-form">' +
        (S.formError ? '<p class="callout bad small" role="alert">' + esc(S.formError) + "</p>" : "") +
        '<div class="form-grid">' +
        '<label class="field">Name to show<input class="input" id="cp-name" maxlength="40" autocomplete="off" placeholder="First name and last initial" value="' + esc(p ? p.display_name : "") + '"></label>' +
        '<label class="field">School (optional)<input class="input" id="cp-school" maxlength="80" autocomplete="off" placeholder="e.g. Gann Academy" value="' + esc((p && p.school) || "") + '"></label>' +
        '<label class="field">Graduating<select class="input" id="cp-year"><option value="">Choose</option>' +
        years.sort().map((y) => '<option value="' + y + '"' + (p && p.grad_year === y ? " selected" : "") + ">" + y + "</option>").join("") + "</select></label></div>" +
        '<label class="check"><input type="checkbox" id="cp-visible"' + (p && p.visible ? " checked" : "") + "> Show my profile to other students on this site</label>" +
        '<p class="small muted comm-note">Only logged-in students can see profiles. Don\'t add your phone number, address or social media.</p>' +
        '<div class="comm-actions"><button class="btn primary" data-act="comm-save">Save profile</button>' +
        (p ? '<button class="btn ghost" data-act="comm-cancel">Cancel</button>' : "") + "</div></div>";
    }
    function profileCard() {
      const p = me();
      const flash = S.flash ? '<p class="callout ok small" role="status">' + esc(S.flash) + "</p>" : "";
      S.flash = "";
      if (!p || S.editing) {
        return '<section class="card sec comm-profile"><div class="sec-head"><h2>' + (p ? "Edit your profile" : "Make your profile") + "</h2></div>" +
          (p ? "" : '<p class="muted" style="margin:0 0 12px">Let other students see which gap years you\'re looking at and which groups you\'re in. Your profile stays private until you turn it on.</p>') +
          profileForm(p) + "</section>";
      }
      const sub = [p.school, p.grad_year ? "Class of " + p.grad_year : ""].filter(Boolean).join(" · ");
      return '<section class="card sec comm-profile">' + flash +
        '<div class="person me"><span class="avatar big" aria-hidden="true">' + esc(initials(p.display_name)) + "</span>" +
        '<div class="person-body"><div class="person-name"><strong>' + esc(p.display_name) + "</strong> " +
        (p.visible ? '<span class="chip ok">Visible to students</span>' : '<span class="chip">Private: only you</span>') + "</div>" +
        (sub ? '<div class="small muted">' + esc(sub) + "</div>" : "") + "</div></div>" +
        '<div class="comm-actions"><button class="btn sm" data-act="comm-edit">Edit</button>' +
        '<button class="btn sm" data-act="comm-visible">' + (p.visible ? "Make private" : "Show to students") + "</button>" +
        '<button class="btn ghost sm danger" data-act="comm-delete">Delete profile</button></div></section>';
    }
    const STATUS_CHIP = { pending: '<span class="chip warn">Waiting for admin review</span>', review: '<span class="chip bad">Hidden: reported, under review</span>', rejected: '<span class="chip bad">Not approved</span>' };
    // On the main page each organization is just its name; the description, Join button, members and
    // sources are on its own page (#/community/org/<id>).
    function orgCard(o) {
      const on = isMember(o.id);
      const st = o.group && o.group.status !== "approved" ? STATUS_CHIP[o.group.status] || "" : "";
      return '<a class="org-tile' + (o.group ? " student-group" : "") + (on ? " joined" : "") + '" href="#/community/org/' + o.id + '">' +
        '<span class="org-logo" aria-hidden="true">' + esc(o.short) + '</span><span class="org-tile-body"><span class="org-name">' + esc(o.name) + "</span>" + st + "</span>" +
        (on ? '<span class="org-joined" title="Joined">' + I("check") + '<span class="sr-only">Joined</span></span>' : "") + "</a>";
    }
    function groupForm() {
      const opts = ORGS.orgs.map((o) => '<option value="' + o.id + '">' + esc(o.name) + "</option>").join("");
      return '<div class="card sec comm-form group-form">' +
        (S.groupError ? '<p class="callout bad small" role="alert">' + esc(S.groupError) + "</p>" : "") +
        '<div class="form-grid">' +
        '<label class="field">Group name<input class="input" id="cg-name" maxlength="60" autocomplete="off" placeholder="e.g. BBYO Boston seniors"></label>' +
        '<label class="field">Type<select class="input" id="cg-kind">' + Object.keys(GROUP_KIND).map((k) => '<option value="' + k + '">' + esc(GROUP_KIND[k]) + "</option>").join("") + "</select></label>" +
        '<label class="field">Part of (optional)<select class="input" id="cg-parent"><option value="">None</option>' + opts + "</select></label></div>" +
        '<label class="field" style="margin-top:10px">What it\'s about<textarea class="textarea" id="cg-desc" maxlength="300" placeholder="Who it\'s for and what you\'ll talk about. 300 characters at most."></textarea></label>' +
        '<div class="comm-rules"><strong>Community rules</strong><ul>' + RULES.map((r) => "<li>" + esc(r) + "</li>").join("") + "</ul>" +
        '<label class="check"><input type="checkbox" id="cg-rules"> I agree to these rules</label></div>' +
        '<div class="comm-actions"><button class="btn primary" data-act="comm-group-save">Send for review</button><button class="btn ghost" data-act="comm-group-cancel">Cancel</button></div></div>';
    }
    function groupsSection() {
      if (S.groupsOff) return "";
      const list = Object.keys(S.groups).map((id) => org("g-" + id)).filter((o) => o.group.status === "approved" || o.group.created_by === uid())
        .sort((a, b) => (b.group.created_by === uid()) - (a.group.created_by === uid()) || membersOf(b.id).length - membersOf(a.id).length || a.name.localeCompare(b.name));
      return '<h2 class="group-h" id="student-groups">Student groups</h2>' +
        '<p class="small muted" style="margin:4px 0 12px">Groups made by students, like a chapter, a school club or friends heading to Israel. Every group is checked by an admin before others can see it.</p>' +
        (S.groupForm ? groupForm() : me() ? '<p><button class="btn" data-act="comm-group-new">+ Create a group</button></p>'
          : '<p class="small muted">Make a profile above to create a group.</p>') +
        (list.length ? '<div class="org-grid">' + list.map(orgCard).join("") + "</div>" : '<p class="small muted">No student groups yet.</p>');
    }
    function adminCards() {
      if (!ctx.isAdmin()) return "";
      const waiting = Object.keys(S.groups).map((id) => S.groups[id]).filter((g) => g.status === "pending" || g.status === "review");
      const name = (r) => (r.target_type === "group" ? (S.groups[r.target_id] || {}).name || "A deleted group" : (S.profiles[r.target_id] || {}).display_name || "A hidden or private profile");
      return '<div class="card"><h3>Groups to review (admin)</h3>' + (waiting.length ? '<ul class="people">' + waiting.map((g) =>
          '<li class="person"><div class="person-body"><strong>' + esc(g.name) + "</strong> " + (STATUS_CHIP[g.status] || "") +
          '<div class="small muted">' + esc(GROUP_KIND[g.kind] || "") + (g.parent_org && orgById[g.parent_org] ? " · " + esc(orgById[g.parent_org].short) : "") + "</div>" +
          (g.description ? '<div class="small">' + esc(g.description) + "</div>" : "") +
          '<div class="comm-actions"><button class="btn sm primary" data-act="comm-approve" data-id="' + esc(g.id) + '">Approve</button><button class="btn sm" data-act="comm-reject" data-id="' + esc(g.id) + '">Reject</button></div></div></li>').join("") + "</ul>"
        : '<p class="small muted">Nothing waiting.</p>') + "</div>" +
        '<div class="card"><h3>Reports (admin)</h3>' + (S.reports.length ? '<ul class="people">' + S.reports.map((r) =>
          '<li class="person"><div class="person-body"><strong>' + esc(name(r)) + '</strong> <span class="chip">' + (r.target_type === "group" ? "Group" : "Profile") + "</span>" +
          '<div class="small muted">' + (r.reason ? esc(r.reason) : "No reason given") + "</div>" +
          '<div class="comm-actions"><button class="btn sm" data-act="comm-report-dismiss" data-id="' + r.id + '">Dismiss</button><button class="btn sm danger" data-act="comm-report-hide" data-id="' + r.id + '">Hide it</button></div></div></li>').join("") + "</ul>"
        : '<p class="small muted">No open reports.</p>') + "</div>";
    }
    function rankList(items, empty) {
      if (!items.length) return '<p class="small muted">' + empty + "</p>";
      const top = items[0].n;
      return '<ol class="comm-rank">' + items.slice(0, 8).map((x) =>
        '<li><a href="#/program/' + x.p.id + '"><span class="cr-name">' + esc(x.p.name) + '</span><span class="cr-n">' + x.n + "</span></a>" +
        '<span class="cr-bar" aria-hidden="true"><span style="width:' + Math.round((x.n / top) * 100) + '%"></span></span></li>').join("") + "</ol>";
    }
    function notice() {
      if (!ctx.sb()) return '<div class="card empty"><h2>Log in to use Community</h2><p class="muted">Profiles and groups need an account.</p></div>';
      if (S.off) return '<div class="card empty"><h2>Community is almost ready</h2><p class="muted">Profiles and groups switch on once the site\'s database is updated.' +
        (ctx.isAdmin() ? " Admin: run supabase/migrations/0003_community.sql in the Supabase SQL editor." : "") + "</p></div>";
      if (S.failed) return '<div class="card empty"><h2>Couldn\'t load Community</h2><p class="muted">Check your connection and try again.</p><button class="btn" data-act="comm-retry">Try again</button></div>';
      return "";
    }

    // ---------- Pages ----------
    function renderPage($app, sub) {
      if (!S.loaded) {
        $app.innerHTML = '<p class="muted">Loading Community…</p>';
        load().then(() => { if (ctx.isView("community")) ctx.render(); });
        return;
      }
      const m = /^org\/([a-z0-9-]+)$/.exec(sub || "");
      if (m && org(m[1])) return renderOrg($app, org(m[1]));
      const n = notice();
      if (n) { $app.innerHTML = '<div class="browse-head"><h1>Community</h1></div>' + n; return; }
      const myOrgs = orgsOf(uid());
      const peers = [];
      myOrgs.forEach((o) => membersOf(o.id).forEach((id) => { if (id !== uid() && peers.indexOf(id) < 0) peers.push(id); }));
      const everyone = Object.keys(S.profiles).filter(listed).concat(S.profiles[uid()] ? [] : [uid()]);
      const myInts = interestsOf(uid());
      const kinds = Object.keys(ORGS.kinds);
      const hidden = ctx.isAdmin() ? Object.keys(S.bans).filter((id) => S.profiles[id]) : [];
      $app.innerHTML =
        '<div class="browse-head"><h1>Community</h1><p class="muted">See which gap years other students are looking at. Join the groups you\'re part of, mark the programs you\'re interested in, and find students from your groups.</p></div>' +
        '<div class="detail comm"><div class="sections">' +
        profileCard() +
        (myOrgs.length ? '<section class="card sec"><div class="sec-head"><h2>Students in your groups</h2><span class="small muted">' + myOrgs.map((o) => esc(label(o))).join(", ") + "</span></div>" +
          (peers.length ? '<ul class="people">' + peers.slice(0, 40).map((id) => personRow(id)).join("") + "</ul>"
            : '<p class="small muted">Nobody else from your groups has a visible profile yet. Share the site with friends from ' + esc(label(myOrgs[0])) + ".</p>") + "</section>" : "") +
        '<h2 class="group-h" id="orgs">Organizations</h2><p class="small muted" style="margin:4px 0 12px">Tap one to learn more and join. Anyone can join any group here, so treat it as what students say, not an official membership list.</p>' +
        kinds.map((k) => {
          const list = ORGS.orgs.filter((o) => o.kind === k);
          return list.length ? '<h3 class="comm-kind">' + esc(ORGS.kinds[k]) + '</h3><div class="org-grid">' + list.map(orgCard).join("") + "</div>" : "";
        }).join("") +
        groupsSection() +
        "</div>" +
        '<aside class="side">' +
        '<div class="card"><h3>Popular with students</h3>' + rankList(rank(everyone), "No one has marked a program yet. Open any program and tap “I'm interested”.") + "</div>" +
        '<div class="card"><h3>You\'re interested in</h3>' + (myInts.length
          ? '<ul class="comm-mine">' + myInts.map((p) => '<li><a href="#/program/' + p.id + '">' + esc(p.name) + "</a></li>").join("") + "</ul>" + (meShown() ? "" : '<p class="small muted">Only you can see these until your profile is visible.</p>')
          : '<p class="small muted">Tap “I\'m interested” on any program page and it shows up here.</p>') + "</div>" +
        adminCards() +
        (hidden.length ? '<div class="card"><h3>Hidden profiles (admin)</h3><ul class="people">' + hidden.map((id) =>
          '<li class="person"><span class="avatar" aria-hidden="true">' + esc(initials(S.profiles[id].display_name)) + '</span><div class="person-body"><strong>' + esc(S.profiles[id].display_name) + '</strong></div><button class="btn sm" data-act="comm-unhide" data-id="' + esc(id) + '">Unhide</button></li>').join("") + "</ul></div>" : "") +
        "</aside></div>";
    }
    function renderOrg($app, o) {
      const n = notice();
      const ids = n ? [] : membersOf(o.id);
      const progs = (o.programs || []).map((id) => byId[id]).filter(Boolean);
      $app.innerHTML =
        '<a class="back" href="#/community">← Community</a>' +
        '<header class="card school-head"><span class="logo org-logo-lg">' + esc(o.short) + '</span><div class="info"><h1>' + esc(o.name) + "</h1>" +
        '<p class="muted">' + esc([o.group ? "Student group" : "", o.community, o.parent ? "part of " + o.parent.name : "", o.grades].filter(Boolean).join(" · ")) + "</p>" +
        (o.group && o.group.status !== "approved" ? STATUS_CHIP[o.group.status] || "" : "") + (o.blurb ? "<p>" + esc(o.blurb) + "</p>" : "") +
        (o.group ? '<p class="small muted">Made by a student and checked by an admin. See something wrong? Report it.</p>' : "") + "</div>" +
        '<div class="actions">' + (n ? "" : joinButton(o)) +
        (o.website ? '<a class="btn" href="' + esc(o.website) + '" target="_blank" rel="noopener">Official website ↗</a>' : "") +
        (o.group && !n && o.group.created_by !== uid() && !ctx.isAdmin() ? '<button class="btn ghost sm" data-act="comm-report" data-id="' + esc(o.group.id) + '">Report</button>' : "") +
        (o.group && !n && (o.group.created_by === uid() || ctx.isAdmin()) ? '<button class="btn ghost sm danger" data-act="comm-group-delete" data-id="' + esc(o.group.id) + '">Delete group</button>' : "") +
        "</div></header>" +
        (n || "") +
        '<div class="detail comm"><div class="sections">' +
        (n ? "" : '<section class="card sec"><div class="sec-head"><h2>Students (' + ids.length + ")</h2></div>" +
          (ids.length ? '<ul class="people">' + ids.map((id) => personRow(id, { skipOrg: o.id })).join("") + "</ul>"
            : '<p class="small muted">No one has joined yet. Be the first, and other ' + esc(label(o)) + " students will find you here.</p>") + "</section>") +
        (progs.length ? '<section class="card sec"><div class="sec-head"><h2>Gap years run by ' + esc(o.short) + '</h2></div><ul class="comm-mine">' +
          progs.map((p) => '<li><a href="#/program/' + p.id + '">' + esc(p.name) + "</a> <span class=\"small muted\">" + esc(p.operator) + "</span></li>").join("") + "</ul></section>" : "") +
        "</div>" +
        '<aside class="side">' +
        (n ? "" : '<div class="card"><h3>' + (o.group ? "What members are looking at" : "What " + esc(o.short) + " students are looking at") + "</h3>" + rankList(rank(ids), "None of these students have marked a program yet.") + "</div>") +
        (o.group ? "" : '<div class="card"><h3>Sources</h3><p class="small muted">Researched ' + esc(ctx.fmtDate(ORGS.asOf)) + ". Details vary by local chapter, so check with yours.</p><div class=\"sources\">" +
        o.sources.map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>").join("") + "</div></div>") +
        "</aside></div>";
    }

    // Sidebar card on each program page.
    function programCard(p) {
      if (!ctx.sb()) return "";
      return '<div class="card comm-card" id="comm-card" data-pid="' + p.id + '">' + cardInner(p) + "</div>";
    }
    function cardInner(p) {
      const h = "<h3>Students interested</h3>";
      if (!S.loaded) { load().then(refreshCard); return h + '<p class="small muted">Loading…</p>'; }
      if (S.off) return h + '<p class="small muted">Coming soon: see which students are interested in this program.</p>';
      if (S.failed) return h + '<p class="small muted">Couldn\'t load this right now.</p><button class="btn sm" data-act="comm-retry">Try again</button>';
      const ids = interestedIn(p.id), others = ids.filter((id) => id !== uid()), on = isInterested(p.id);
      return h +
        '<p class="small muted">' + (ids.length ? plural(ids.length, "student") + " interested" + (on ? ", including you" : "") : "No one yet. Be the first.") + "</p>" +
        (others.length ? '<ul class="people compact">' + others.slice(0, 6).map((id) => personRow(id, { interests: false })).join("") + "</ul>" +
          (others.length > 6 ? '<p class="small muted">and ' + (others.length - 6) + " more</p>" : "") : "") +
        '<button class="btn sm' + (on ? " on" : " primary") + '" data-act="comm-interest" data-id="' + p.id + '" aria-pressed="' + on + '">' + (on ? I("check") + " You're interested" : "I'm interested") + "</button>" +
        (on && !meShown() ? '<p class="small muted comm-note">Only you can see this until you <a href="#/community">turn on your profile</a>.</p>'
          : !on && !me() ? '<p class="small muted comm-note">Your name shows once you <a href="#/community">make a profile</a>.</p>' : "");
    }
    function refreshCard() {
      const c = document.getElementById("comm-card");
      if (c && byId[c.dataset.pid]) c.innerHTML = cardInner(byId[c.dataset.pid]);
    }
    const rerender = () => (ctx.isView("detail") ? refreshCard() : ctx.render());

    // ---------- Actions ----------
    function fail(error, what) {
      ctx.banner(error && error.code === "23514" && /30/.test(error.message || "") ? "You can add up to 30 " + what + "." : "Couldn't save that. Check your connection and try again.");
    }
    async function click(act, el) {
      const sb = ctx.sb();
      if (!sb) return;
      const id = el.dataset.id;
      if (act === "comm-retry") { await load(true); return rerender(); }
      if (act === "comm-edit") { S.editing = true; S.formError = ""; return ctx.render(); }
      if (act === "comm-cancel") { S.editing = false; S.formError = ""; return ctx.render(); }
      if (act === "comm-save") return saveProfile(el);
      if (act === "comm-group-new") { S.groupForm = true; S.groupError = ""; ctx.render(); const f = document.getElementById("cg-name"); if (f) f.focus(); return; }
      if (act === "comm-group-cancel") { S.groupForm = false; S.groupError = ""; return ctx.render(); }
      if (act === "comm-group-save") return saveGroup(el);
      el.disabled = true;
      try {
        if (act === "comm-join") {
          const on = isMember(id);
          const { error } = on ? await sb.from("org_members").delete().eq("user_id", uid()).eq("org_id", id)
            : await sb.from("org_members").insert({ user_id: uid(), org_id: id });
          if (error && error.code !== "23505") return fail(error, "groups");
          S.members = S.members.filter((m) => !(m.user_id === uid() && m.org_id === id));
          if (!on) S.members.push({ user_id: uid(), org_id: id });
          ctx.banner("");
          return rerender();
        }
        if (act === "comm-interest") {
          const on = isInterested(id);
          const { error } = on ? await sb.from("program_interest").delete().eq("user_id", uid()).eq("program_id", id)
            : await sb.from("program_interest").insert({ user_id: uid(), program_id: id });
          if (error && error.code !== "23505") return fail(error, "programs");
          S.interest = S.interest.filter((m) => !(m.user_id === uid() && m.program_id === id));
          if (!on) S.interest.push({ user_id: uid(), program_id: id });
          ctx.banner("");
          return rerender();
        }
        if (act === "comm-visible") {
          const next = !me().visible;
          const { error } = await sb.from("profiles").update({ visible: next }).eq("user_id", uid());
          if (error) return fail(error);
          me().visible = next;
          S.flash = next ? "Your profile is now visible to other students." : "Your profile is now private.";
          return ctx.render();
        }
        if (act === "comm-delete") {
          if (!confirm("Delete your community profile? This also takes you out of your groups and clears the programs you marked as interested.")) return;
          const ok = await deleteAll();
          if (!ok) return ctx.banner("Couldn't delete your profile. Try again.");
          S.flash = "";
          return ctx.render();
        }
        if (act === "comm-report" || act === "comm-report-profile") {
          const reason = prompt("What's wrong? An admin will look at your report. (Optional)");
          if (reason === null) return;
          const { error } = await sb.from("community_reports").insert({ target_type: act === "comm-report" ? "group" : "profile", target_id: id, reason: reason.trim().slice(0, 300) || null });
          if (error && error.code !== "23505") return fail(error);
          return ctx.banner(error ? "You've already reported this. An admin will review it." : "Thanks for reporting. An admin will review it.");
        }
        if (act === "comm-group-delete") {
          if (!confirm("Delete this group? Everyone in it is removed. This can't be undone.")) return;
          const { error } = await sb.from("student_groups").delete().eq("id", id);
          if (error) return fail(error);
          delete S.groups[id];
          S.members = S.members.filter((m) => m.org_id !== "g-" + id);
          location.hash = "#/community";
          return;
        }
        if ((act === "comm-approve" || act === "comm-reject") && ctx.isAdmin()) {
          const status = act === "comm-approve" ? "approved" : "rejected";
          const { error } = await sb.from("student_groups").update({ status: status, reviewed_at: new Date().toISOString(), reviewed_by: uid() }).eq("id", id);
          if (error) return fail(error);
          S.groups[id].status = status;
          return ctx.render();
        }
        if ((act === "comm-report-dismiss" || act === "comm-report-hide") && ctx.isAdmin()) {
          const r = S.reports.find((x) => String(x.id) === String(id));
          if (!r) return;
          if (act === "comm-report-hide") {
            const res = r.target_type === "group"
              ? await sb.from("student_groups").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: uid() }).eq("id", r.target_id)
              : await sb.from("community_bans").insert({ user_id: r.target_id });
            if (res.error && res.error.code !== "23505") return fail(res.error);
            if (r.target_type === "group" && S.groups[r.target_id]) S.groups[r.target_id].status = "rejected";
            if (r.target_type === "profile") S.bans[r.target_id] = 1;
          }
          const same = S.reports.filter((x) => x.target_type === r.target_type && x.target_id === r.target_id);
          for (const x of same) { const { error } = await sb.from("community_reports").update({ resolved: true }).eq("id", x.id); if (error) return fail(error); }
          S.reports = S.reports.filter((x) => same.indexOf(x) < 0);
          return ctx.render();
        }
        if (act === "comm-hide" && ctx.isAdmin()) {
          if (!confirm("Hide this student's profile from everyone? Their groups and interests disappear from the site too. You can unhide them later.")) return;
          const { error } = await sb.from("community_bans").insert({ user_id: id });
          if (error && error.code !== "23505") return fail(error);
          S.bans[id] = 1;
          return rerender();
        }
        if (act === "comm-unhide" && ctx.isAdmin()) {
          const { error } = await sb.from("community_bans").delete().eq("user_id", id);
          if (error) return fail(error);
          delete S.bans[id];
          await load(true);
          return ctx.render();
        }
      } finally {
        if (el.isConnected) el.disabled = false;
      }
    }
    async function saveProfile(el) {
      const v = (k) => (document.getElementById(k) || {}).value || "";
      const name = v("cp-name").trim(), school = v("cp-school").trim(), year = parseInt(v("cp-year"), 10) || null;
      const visible = !!(document.getElementById("cp-visible") || {}).checked;
      const again = (msg) => { S.formError = msg; ctx.render(); const f = document.getElementById("cp-name"); if (f) f.focus(); };
      if (!name) return again("Add a name to show, like your first name and last initial.");
      if (LINK.test(name + " " + school)) return again("Links aren't allowed in profiles.");
      const row = { display_name: name.slice(0, 40), school: school ? school.slice(0, 80) : null, grad_year: year, visible: visible };
      el.disabled = true;
      const sb = ctx.sb(), had = !!me();
      const { error } = had ? await sb.from("profiles").update(row).eq("user_id", uid())
        : await sb.from("profiles").insert(Object.assign({ user_id: uid() }, row));
      el.disabled = false;
      if (error) return again(wordingMsg(error) || "Couldn't save your profile. Check your connection and try again.");
      S.profiles[uid()] = Object.assign({ user_id: uid() }, me() || {}, row);
      S.editing = false; S.formError = "";
      S.flash = visible ? "Saved. Other students can now see your profile." : "Saved. Your profile is private until you choose to show it.";
      ctx.render();
    }
    async function saveGroup(el) {
      const v = (k) => (document.getElementById(k) || {}).value || "";
      const name = v("cg-name").trim(), desc = v("cg-desc").trim(), kind = v("cg-kind") || "other", parent = v("cg-parent") || null;
      const again = (msg) => {
        const keep = { name: v("cg-name"), desc: v("cg-desc"), kind: kind, parent: parent || "" };
        S.groupError = msg; ctx.render();
        const set = (k, x) => { const f = document.getElementById(k); if (f) f.value = x; };
        set("cg-name", keep.name); set("cg-desc", keep.desc); set("cg-kind", keep.kind); set("cg-parent", keep.parent);
        const f = document.getElementById("cg-name"); if (f) f.focus();
      };
      if (name.length < 3) return again("Give the group a name (3 to 60 characters).");
      if (LINK.test(name + " " + desc) || /\.com\b/i.test(name + " " + desc)) return again("Links aren't allowed in groups.");
      if (!(document.getElementById("cg-rules") || {}).checked) return again("Please agree to the community rules first.");
      el.disabled = true;
      const { data, error } = await ctx.sb().from("student_groups").insert({ name: name.slice(0, 60), description: desc ? desc.slice(0, 300) : null, kind: kind, parent_org: parent }).select("id, name, description, kind, parent_org, created_by, status, created_at");
      el.disabled = false;
      if (error) return again(wordingMsg(error) || (/up to 3 groups/i.test(error.message || "") ? "You can create up to 3 groups." : "Couldn't create the group. Check your connection and try again."));
      const g = (data && data[0]) || { id: "local-" + Date.now(), name: name, description: desc, kind: kind, parent_org: parent, created_by: uid(), status: "pending" };
      S.groups[g.id] = g;
      S.groupForm = false; S.groupError = "";
      S.flash = "Your group was sent for review. Other students will see it once an admin approves it. You can join it now.";
      ctx.render();
    }
    // Removes the student's profile, groups and interests. Used by "Delete profile" and "Delete my saved data".
    async function deleteAll() {
      const sb = ctx.sb();
      if (!sb) return true;
      const res = await Promise.all([
        sb.from("program_interest").delete().eq("user_id", uid()),
        sb.from("org_members").delete().eq("user_id", uid()),
      ]);
      const res2 = await sb.from("profiles").delete().eq("user_id", uid());
      const bad = res.concat([res2]).find((r) => r.error && !missing(r.error));
      if (bad) return false;
      delete S.profiles[uid()];
      S.members = S.members.filter((m) => m.user_id !== uid());
      S.interest = S.interest.filter((m) => m.user_id !== uid());
      S.editing = false;
      return true;
    }

    return { load, renderPage, programCard, click, mine, deleteAll };
  };
})();
