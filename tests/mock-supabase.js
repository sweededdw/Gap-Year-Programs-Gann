// A stand-in for supabase-js used by the browser tests. Everything lives in localStorage:
//   mock:users, mock:session        accounts
//   mock:rows                       gap_year_trackers (keyed by user id)
//   mock:t:<table>                  every other table, as an array of rows (profiles, org_members,
//                                   program_interest and community_bans follow the 0003 privacy rules)
//   mock:admin = "1"                makes is_admin() return true
//   mock:notable = "1"              every table "doesn't exist" (migrations not run)
//   mock:lastCaptcha                the captchaToken sent with the last auth call
window.supabase = { createClient: function () {
  const LS = localStorage, J = (k, d) => JSON.parse(LS.getItem(k) || d), W = (k, v) => LS.setItem(k, JSON.stringify(v));
  const listeners = [];
  const sessionFor = (u) => ({ access_token: 'tok-' + u.id, user: { id: u.id, email: u.email, user_metadata: u.user_metadata } });
  const captcha = (o) => W('mock:lastCaptcha', (o && o.captchaToken) || null);
  const auth = {
    async getSession() { return { data: { session: J('mock:session', 'null') }, error: null }; },
    async signUp({ email, password, options }) {
      captcha(options);
      const us = J('mock:users', '{}');
      if (us[email]) return { data: { user: null, session: null }, error: { message: 'User already registered' } };
      const u = { id: 'uid-' + Object.keys(us).length, email, password, confirmed: !LS.getItem('mock:confirm'), user_metadata: options.data };
      us[email] = u; W('mock:users', us);
      if (!u.confirmed) return { data: { user: u, session: null }, error: null };
      const s = sessionFor(u); W('mock:session', s); return { data: { user: u, session: s }, error: null };
    },
    async signInWithPassword({ email, password, options }) {
      captcha(options);
      const u = J('mock:users', '{}')[email];
      if (!u || u.password !== password) return { data: {}, error: { message: 'Invalid login credentials' } };
      if (!u.confirmed) return { data: {}, error: { message: 'Email not confirmed' } };
      const s = sessionFor(u); W('mock:session', s); return { data: { session: s }, error: null };
    },
    async signOut() { LS.removeItem('mock:session'); return { error: null }; },
    onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async resend({ options }) { captcha(options); W('mock:resent', 1); return { error: null }; },
    async resetPasswordForEmail(email, options) { captcha(options); return { error: null }; },
    async updateUser() { return { data: {}, error: null }; },
  };
  const uidNow = () => (J('mock:session', 'null') || { user: {} }).user.id || null;
  let tick = 0;
  const stamp = () => new Date(Date.now() + (tick++)).toISOString();

  // gap_year_trackers, with updated_at so "only save if unchanged since I last read it" can be tested.
  const rows = () => J('mock:rows', '{}'), put = (r) => W('mock:rows', r);
  const trackers = () => {
    const q = { filters: [], op: null, payload: null };
    const run = async () => {
      if (LS.getItem('mock:notable')) return { data: null, error: { message: 'relation "public.gap_year_trackers" does not exist' } };
      const r = rows(); const uid = (q.filters.find((f) => f[0] === 'user_id') || [])[1] || (q.payload && q.payload.user_id);
      const cur = r[uid];
      const match = cur && q.filters.every((f) => (f[0] === 'user_id' ? true : String(cur[f[0]]) === String(f[1])));
      if (q.op === 'select') return { data: cur || null, error: null };
      if (q.op === 'insert') { if (cur) return { data: null, error: { code: '23505', message: 'duplicate key' } }; r[uid] = { state: q.payload.state, updated_at: q.payload.updated_at }; put(r); return { data: [{ updated_at: q.payload.updated_at }], error: null }; }
      if (q.op === 'update') { if (!match) return { data: [], error: null }; r[uid] = { state: q.payload.state, updated_at: q.payload.updated_at }; put(r); return { data: [{ updated_at: q.payload.updated_at }], error: null }; }
      if (q.op === 'upsert') { r[q.payload.user_id] = { state: q.payload.state, updated_at: q.payload.updated_at }; put(r); return { error: null }; }
    };
    const api = {
      select() { if (!q.op) q.op = 'select'; return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      upsert(p) { q.op = 'upsert'; q.payload = p; return run(); },
      eq(c, v) { q.filters.push([c, v]); return api; },
      maybeSingle() { return run(); },
      then(res, rej) { return run().then(res, rej); },
    };
    return api;
  };

  // Community tables, with the same visibility rules as supabase/migrations/0003_community.sql.
  const COMMUNITY = { profiles: ['user_id'], org_members: ['user_id', 'org_id'], program_interest: ['user_id', 'program_id'], community_bans: ['user_id'],
    student_groups: ['id'], community_reports: ['target_type', 'target_id', 'reporter'] };
  // A few of the 0004 blocked terms, enough to test the "wording isn't allowed" path.
  const dirty = (t) => /\b(nazi|kike|wetback)s?\b|hitler|white\s*power/i.test(String(t || '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/4|@/g, 'a').replace(/3/g, 'e').replace(/\$|5/g, 's'));
  const wording = { data: null, error: { code: '23514', message: "That wording isn't allowed here." } };
  const community = async (name, q, hit) => {
    const key = 'mock:t:' + name, all = J(key, '[]'), uid = uidNow(), admin = !!LS.getItem('mock:admin');
    const bans = J('mock:t:community_bans', '[]'), profs = J('mock:t:profiles', '[]');
    const banned = (u) => bans.some((b) => b.user_id === u);
    const shown = (u) => profs.some((p) => p.user_id === u && p.visible) && !banned(u);
    const mineOk = (r) => (name === 'community_bans' ? admin : r.user_id === uid);
    const groups = J('mock:t:student_groups', '[]');
    const sees = (r) => name === 'community_bans' || name === 'community_reports' ? admin
      : name === 'student_groups' ? r.status === 'approved' || r.created_by === uid || admin
      : name === 'profiles' ? r.user_id === uid || shown(r.user_id) || (admin && banned(r.user_id)) : r.user_id === uid || shown(r.user_id);
    if (name === 'student_groups' || name === 'community_reports') {
      if (q.op === 'insert') {
        const row = Object.assign({}, q.payload);
        if (name === 'student_groups') {
          if (row.status || row.created_by) return denied;
          if (dirty(row.name) || dirty(row.description)) return wording;
          if (all.filter((g) => g.created_by === uid && g.status !== 'rejected').length >= 3) return { data: null, error: { code: '23514', message: 'You can create up to 3 groups.' } };
          Object.assign(row, { id: 'gid' + (all.length + 1) + 'x' + Date.now().toString(36), created_by: uid, status: 'pending', created_at: stamp() });
        } else {
          row.reporter = uid; row.id = all.length + 1; row.resolved = false;
          if (all.some((r) => r.target_type === row.target_type && r.target_id === row.target_id && r.reporter === uid)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        all.push(row); W(key, all);
        if (name === 'community_reports' && row.target_type === 'group' && new Set(all.filter((r) => r.target_type === 'group' && r.target_id === row.target_id && !r.resolved).map((r) => r.reporter)).size >= 3) {
          const g = groups.find((x) => x.id === row.target_id); if (g && g.status === 'approved') { g.status = 'review'; W('mock:t:student_groups', groups); }
        }
        return { data: [row], error: null };
      }
      if (q.op === 'update') { if (!admin) return { data: [], error: null }; const out = all.filter(hit); out.forEach((r) => Object.assign(r, q.payload)); W(key, all); return { data: out, error: null }; }
      if (q.op === 'delete') {
        const out = all.filter((r) => hit(r) && (admin || (name === 'student_groups' && r.created_by === uid)));
        W(key, all.filter((r) => out.indexOf(r) < 0));
        if (name === 'student_groups') out.forEach((g) => W('mock:t:org_members', J('mock:t:org_members', '[]').filter((m) => m.org_id !== 'g-' + g.id)));
        return { data: out, error: null };
      }
    }
    const denied = { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "' + name + '"' } };
    if (!uid) return denied;
    if (q.op === 'select') { let out = all.filter(sees).filter(hit); if (q.limit != null) out = out.slice(0, q.limit); return { data: out, error: null }; }
    if (q.op === 'insert' && Array.isArray(q.payload)) {
      const done = [];
      for (const one of q.payload) { const r = await community(name, Object.assign({}, q, { payload: one }), hit); if (r.error) return r; done.push(r.data[0]); }
      return { data: done, error: null };
    }
    if (q.op === 'insert') {
      const row = Object.assign({}, q.payload);
      if (!mineOk(row)) return denied;
      if (name === 'program_interest' && !profs.some((p) => p.user_id === uid && p.share_list)) return denied;
      if (name === 'profiles' && !(row.display_name || '').trim()) return { data: null, error: { code: '23514', message: 'violates check constraint' } };
      if (name === 'profiles' && (dirty(row.display_name) || dirty(row.school))) return wording;
      if (name === 'org_members' && /^g-/.test(row.org_id) && !groups.some((g) => 'g-' + g.id === row.org_id && (g.status === 'approved' || g.created_by === uid))) return { data: null, error: { code: '23514', message: "That group isn't open to join." } };
      if (all.some((r) => COMMUNITY[name].every((k) => r[k] === row[k]))) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      const cap = name === 'program_interest' ? 60 : 30;
      if ((name === 'org_members' || name === 'program_interest') && all.filter((r) => r.user_id === uid).length >= cap) return { data: null, error: { code: '23514', message: 'You can add up to ' + cap + ' here.' } };
      all.push(Object.assign({ created_at: stamp() }, row)); W(key, all); return { data: [row], error: null };
    }
    if (q.op === 'update') {
      if (name !== 'profiles') return denied;
      if (dirty(q.payload.display_name) || dirty(q.payload.school)) return wording;
      const out = all.filter((r) => hit(r) && r.user_id === uid);
      out.forEach((r) => Object.assign(r, q.payload, { updated_at: stamp() }));
      W(key, all);
      if (q.payload.share_list === false) W('mock:t:program_interest', J('mock:t:program_interest', '[]').filter((m) => m.user_id !== uid));
      return { data: out, error: null };
    }
    if (q.op === 'delete') {
      const out = all.filter((r) => hit(r) && mineOk(r));
      W(key, all.filter((r) => out.indexOf(r) < 0));
      if (name === 'profiles' && out.length) W('mock:t:program_interest', J('mock:t:program_interest', '[]').filter((m) => m.user_id !== uid));
      return { data: out, error: null };
    }
  };

  // Every other table: programs, colleges (admin-only writes, history on change), content_history, client_errors.
  const CONTENT = { programs: 1, colleges: 1 };
  const table = (name) => {
    const q = { op: 'select', filters: [], payload: null, order: null, limit: null };
    const run = async () => {
      if (LS.getItem('mock:notable')) return { data: null, error: { code: '42P01', message: 'relation "public.' + name + '" does not exist' } };
      const key = 'mock:t:' + name, all = J(key, '[]');
      const hit = (r) => q.filters.every(([c, v]) => String(r[c]) === String(v));
      if (COMMUNITY[name]) return community(name, q, hit);
      const admin = !!LS.getItem('mock:admin');
      const history = (old) => { const h = J('mock:t:content_history', '[]'); h.push({ id: h.length + 1, table_name: name, item_id: old.id, data: old.data, changed_at: stamp(), changed_by: uidNow() }); W('mock:t:content_history', h); };
      if (q.op !== 'select' && CONTENT[name] && !admin) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "' + name + '"' } };
      if (q.op === 'select') {
        if (name === 'content_history' && !admin) return { data: [], error: null };
        if (name === 'client_errors' && !admin) return { data: [], error: null };
        let out = all.filter(hit);
        if (q.order) out.sort((a, b) => (a[q.order[0]] < b[q.order[0]] ? -1 : a[q.order[0]] > b[q.order[0]] ? 1 : 0) * (q.order[1] ? 1 : -1));
        if (q.limit != null) out = out.slice(0, q.limit);
        return { data: out, error: null };
      }
      if (q.op === 'insert') {
        if (name === 'client_errors') {
          if (q.payload.user_id !== uidNow()) return { data: null, error: { code: '42501', message: 'row-level security' } };
          all.push(Object.assign({ id: all.length + 1, created_at: stamp() }, q.payload)); W(key, all); return { data: null, error: null };
        }
        if (all.some((r) => r.id === q.payload.id)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        const row = Object.assign({ verified_at: null, kind: name === 'colleges' ? 'policy' : undefined }, q.payload, { updated_at: stamp(), updated_by: uidNow() });
        all.push(row); W(key, all); return { data: [row], error: null };
      }
      if (q.op === 'update') {
        const out = [];
        all.forEach((r) => { if (hit(r)) { history(r); Object.assign(r, q.payload, { updated_at: stamp(), updated_by: uidNow() }); out.push(r); } });
        W(key, all); return { data: out, error: null };
      }
      if (q.op === 'delete') {
        const out = all.filter(hit);
        out.forEach(history);
        W(key, all.filter((r) => !hit(r))); return { data: out, error: null };
      }
    };
    const api = {
      select() { return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(c, v) { q.filters.push([c, v]); return api; },
      order(c, o) { q.order = [c, !(o && o.ascending === false)]; return api; },
      limit(n) { q.limit = n; return api; },
      then(res, rej) { return run().then(res, rej); },
    };
    return api;
  };
  return {
    auth,
    from: (name) => (name === 'gap_year_trackers' ? trackers() : table(name)),
    async rpc(fn) {
      if (fn !== 'is_admin') return { data: null, error: { message: 'unknown function ' + fn } };
      if (LS.getItem('mock:notable')) return { data: null, error: { code: 'PGRST202', message: 'function not found' } };
      return { data: !!LS.getItem('mock:admin'), error: null };
    },
  };
} };
