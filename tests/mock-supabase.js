// A stand-in for supabase-js used by the browser tests. Everything lives in localStorage:
//   mock:users, mock:session        accounts
//   mock:rows                       gap_year_trackers (keyed by user id)
//   mock:t:<table>                  every other table, as an array of rows
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

  // Every other table: programs, colleges (admin-only writes, history on change), content_history, client_errors.
  const CONTENT = { programs: 1, colleges: 1 };
  const table = (name) => {
    const q = { op: 'select', filters: [], payload: null, order: null, limit: null };
    const run = async () => {
      if (LS.getItem('mock:notable')) return { data: null, error: { code: '42P01', message: 'relation "public.' + name + '" does not exist' } };
      const key = 'mock:t:' + name, all = J(key, '[]');
      const hit = (r) => q.filters.every(([c, v]) => String(r[c]) === String(v));
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
