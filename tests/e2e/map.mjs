// The program map (/map): loads with no errors, every program is pinned (or listed), every region lists the right
// programs, all zoom presets land, filters work, and the layout holds at 1440px and 375px.
import { readFileSync, writeFileSync } from 'node:fs';
const [SP, ROOT] = process.argv.slice(2);
const B = 'http://localhost:3124';
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
const cmd = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = m => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errs.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) errs.push('console.' + d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
    const e = d.params.entry;
    // Map tiles come from the internet; a tile that fails offline is not a page bug. Anything else (CSP, our files) is.
    const tile = /arcgisonline|opentopomap/.test(e.url || '');
    if (!tile) errs.push('log: ' + e.text + (e.url ? ' ' + e.url : ''));
  }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description }; return r.result?.result?.value; };
const vp = (w, h) => cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
const shot = async n => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
const out = []; const ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
const waitFor = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await ev(expr)) return true; await sleep(100); } return false; };

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Log.enable'); await vp(1440, 900);
await cmd('Page.navigate', { url: B + '/map' });
const ready = await waitFor('document.body && document.body.getAttribute("data-map-ready") === "1"', 10000);
ok('map page loads its regions and Armistice Line', ready);
await sleep(600);

// ---- Expected data, worked out here independently of the page ----
const geo = JSON.parse(readFileSync(ROOT + '/public/data/biomes.geojson', 'utf8'));
global.window = global; await import(ROOT + '/public/js/data.js'); await import(ROOT + '/public/js/map-data.js');
const M = global.GYF_MAP;
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const biomeOf = (s) => (geo.features.find(f => inRing(s.lng, s.lat, f.geometry.coordinates[0])) || { properties: {} }).properties.id || null;
const keyOf = (m) => m.id || m.key;
const pinned = M.programs.filter(m => m.sites.length);
const totalSites = pinned.reduce((n, m) => n + m.sites.length, 0);

// ---- Every program is on the map ----
const pins = await ev(`(() => { const V = window.GYF_MAP_VIEW;
  const cl = V.map._layers && Object.values(V.map._layers).find(l => l._featureGroup);
  return { markers: V.markers.length, inCluster: V.markers.filter(m => cl.hasLayer(m.marker)).length, keys: [...new Set(V.markers.filter(m => cl.hasLayer(m.marker)).map(m => m.prog.key))] }; })()`);
ok(`every location has a pin (${pins.inCluster} of ${totalSites})`, pins.markers === totalSites && pins.inCluster === totalSites);
ok(`every pinned seed program is on the map (${pins.keys.length} of ${pinned.length})`, pinned.every(m => pins.keys.includes(keyOf(m))));
const ulpan = await ev(`(() => { const t = document.getElementById('map-panel-content').innerText; return /No single base/i.test(t) && /Kibbutz Ulpan/.test(t) && /Multiple kibbutzim/.test(t); })()`);
ok('Kibbutz Ulpan is listed in the panel as "Multiple kibbutzim" with no pin', ulpan && !pins.keys.includes('kibbutz-ulpan'));
const multi = ['year-course', 'tavor'].every(k => pins.keys.includes(k)) && (await ev(`window.GYF_MAP_VIEW.markers.filter(m => m.prog.key === 'year-course').length`)) === 3;
ok('multi-base programs get one pin per base (Young Judaea: 3)', multi);
ok('every program location is marked approximate', M.programs.every(m => m.sites.every(s => s.approx === true)));

// ---- Every region is clickable and lists the right programs ----
ok('all 10 regions are drawn', (await ev('Object.keys(window.GYF_MAP_VIEW.map._layers).length > 0 && document.querySelectorAll(".leaflet-overlay-pane path.leaflet-interactive").length')) === 10);
const patternsOk = await ev(`(() => { const ps = [...document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')]; return ps.every(p => /^url\\(#pat-/.test(p.getAttribute('fill')) && document.querySelector(p.getAttribute('fill').slice(4, -1))) && new Set(ps.map(p => p.getAttribute('fill'))).size === 10 && ps.every(p => +p.getAttribute('fill-opacity') === 0.35); })()`);
ok('each region has its own texture at 35% opacity', patternsOk);
for (const f of geo.features) {
  const want = pinned.filter(m => m.sites.some(s => biomeOf(s) === f.properties.id)).map(m => keyOf(m)).sort();
  const got = await ev(`(() => { const V = window.GYF_MAP_VIEW; const l = Object.values(V.map._layers).find(x => x.feature && x.feature.properties.id === ${JSON.stringify(f.properties.id)}); l.fire('click');
    const box = document.getElementById('map-panel-content');
    return { keys: [...box.querySelectorAll('[data-prog]')].map(b => b.dataset.prog).sort(), h: box.querySelector('.mp-h').textContent, desc: box.querySelector('.mp-desc').textContent }; })()`);
  const sentences = (got.desc.match(/[.!?](\s|$)/g) || []).length;
  ok(`${f.properties.name}: lists ${want.length} program(s) [${want.join(', ') || 'none'}] with a 2-sentence description`, got.h === f.properties.name && JSON.stringify(got.keys) === JSON.stringify(want) && sentences === 2);
}
// Spot checks against places we know.
const spot = { 'haemek': 'rift', 'livnot': 'upper-galilee', 'hannaton': 'lower-galilee', 'bar-ilan-xp': 'coast', 'har-etzion': 'judean-hills', 'hakotel': 'judean-hills', 'ein-prat': 'judean-desert' };
ok('spot checks: Kfar Ruppin in the rift, Tzfat in Upper Galilee, Hannaton in Lower Galilee, Ramat Gan on the coast, Gush Etzion and the Old City in the Judean Hills, Kfar Adumim in the desert',
  Object.entries(spot).every(([k, b]) => biomeOf(M.programs.find(m => keyOf(m) === k).sites[0]) === b));
const bgu = M.programs.find(m => m.key === 'bgu').sites.map(biomeOf), yj = M.programs.find(m => m.id === 'year-course').sites.map(biomeOf);
ok(`BGU splits across the Northern Negev and Negev Highlands; Young Judaea's Ketura base is in the Arava (${bgu} / ${yj[2]})`, bgu[0] === 'north-negev' && bgu[1] === 'negev-highlands' && yj[2] === 'arava');

// ---- Program card ----
await ev(`document.querySelector('[data-prog="hevruta"]') || (document.querySelector('[data-act="home"]').click()); true`);
await ev(`(() => { const V = window.GYF_MAP_VIEW; const l = Object.values(V.map._layers).find(x => x.feature && x.feature.properties.id === 'judean-hills'); l.fire('click'); document.querySelector('[data-prog="hevruta"]').click(); return true; })()`);
await sleep(900);
const card = await ev(`(() => { const c = document.querySelector('.pcard'); if (!c) return null; const a = c.querySelector('.pc-links a.btn.primary');
  return { name: c.querySelector('.mp-h').textContent, type: c.querySelector('.tbadge').textContent, approx: !!c.querySelector('.mbadge.approx'), base: c.querySelector('.pc-facts dd').textContent,
    tracks: c.querySelectorAll('.pc-tracks li').length, link: a && a.href, target: a && a.target, rel: a && a.rel, intern: (c.querySelector('.mbadge:not(.approx):not(.tag)') || {}).textContent }; })()`);
ok(`program card shows name, type, base, tracks, link and the approximate badge (${card && card.name})`, card && card.name && /Pluralistic/.test(card.type) && card.approx && card.base.length > 5 && card.tracks > 0 && /hartman\.org\.il/.test(card.link) && card.target === '_blank' && /noopener/.test(card.rel));
ok(`Hevruta is marked as a nonprofit internship (${card && card.intern})`, card && card.intern === 'Nonprofit internship');
const pinClick = await ev(`(() => { const V = window.GYF_MAP_VIEW; const m = V.markers.find(x => x.prog.key === 'livnot'); m.marker.fire('click'); const c = document.querySelector('.pcard'); return c && c.querySelector('.mp-h').textContent + '|' + (c.querySelector('.mbadge.tag') || {}).textContent; })()`);
ok(`clicking a pin opens its card; Livnot is tagged (${pinClick})`, pinClick === "Livnot U'Lehibanot|Not a classic post-high school year");
const seedLink = await ev(`(() => { window.GYF_MAP_VIEW.openProgram('ein-prat', 0, {}); return document.querySelector('.pcard').innerText; })()`);
ok('a program with no known website says so instead of linking anywhere', /No website listed yet/.test(seedLink) && !/Program website/.test(seedLink));

// ---- Zoom presets ----
for (let i = 0; i < M.presets.length; i++) {
  const p = M.presets[i];
  await ev(`document.querySelector('[data-preset="${i}"]').click(); true`);
  await waitFor(`(() => { const m = window.GYF_MAP_VIEW.map; const c = m.getCenter(); return !m._flyToFrame && Math.abs(c.lat - ${p.center[0]}) < 0.01 && Math.abs(c.lng - ${p.center[1]}) < 0.01 && m.getZoom() === ${p.zoom}; })()`, 4000);
  const at = await ev(`(() => { const m = window.GYF_MAP_VIEW.map, c = m.getCenter(); return { lat: c.lat, lng: c.lng, z: m.getZoom(), labels: document.querySelectorAll('.place-label').length, pressed: document.querySelector('[data-preset="${i}"]').getAttribute('aria-pressed') }; })()`);
  const there = Math.abs(at.lat - p.center[0]) < 0.01 && Math.abs(at.lng - p.center[1]) < 0.01 && at.z === p.zoom;
  ok(`preset "${p.name}" flies to ${p.center.join(',')} z${p.zoom} (got ${at.lat.toFixed(3)},${at.lng.toFixed(3)} z${at.z})`, there && at.pressed === 'true');
  if (i === 0) { ok(`neighborhood labels show at zoom 13+ (${at.labels})`, at.labels > 0); await shot('map-jerusalem'); }
  if (p.zoom < 13) ok(`labels hide below zoom 13 (${p.name}: ${at.labels})`, at.labels === 0);
}
ok('the Armistice Line is labeled exactly once', (await ev(`document.querySelectorAll('.gl-label').length`)) === 1);

// ---- Filters ----
await ev(`window.GYF_MAP_VIEW.map.setView([31.5, 35.0], 8, { animate: false }); true`);
const count = () => ev(`(() => { const V = window.GYF_MAP_VIEW; const cl = Object.values(V.map._layers).find(l => l._featureGroup); return [...new Set(V.markers.filter(m => cl.hasLayer(m.marker)).map(m => m.prog.key))]; })()`);
const types = Object.keys(M.types);
for (const t of types.filter(t => t !== 'orthodox')) await ev(`document.querySelector('[data-type="${t}"]').click(); true`);
const orth = await count();
const wantOrth = pinned.filter(m => m.mapType === 'orthodox').map(keyOf).sort();
ok(`type filter: only Orthodox Yeshiva/Midrasha pins remain (${orth.length})`, JSON.stringify(orth.sort()) === JSON.stringify(wantOrth));
await ev(`document.querySelector('[data-act="reset"]').click(); true`);
ok('"Show all" brings every pin back', (await count()).length === pinned.length);
await ev(`(() => { for (let i = 0; i < 3; i++) { const b = document.querySelector('.mp-back'); if (!b) break; b.click(); } return true; })()`);
await ev(`document.querySelector('[data-act="intern"]').click(); true`);
const intern = (await count()).sort();
ok(`internships toggle keeps only programs with internships [${intern.join(', ')}]`, JSON.stringify(intern) === JSON.stringify(['aardvark', 'bar-ilan-xp', 'hevruta', 'nativ', 'year-course']));
const biz = await ev(`[...document.querySelectorAll('.pr-flag.biz')].map(x => x.closest('[data-prog]').dataset.prog).sort().join(',')`);
ok(`business internships are marked (${biz})`, biz === 'aardvark,bar-ilan-xp,year-course');
ok('the switch reports its state', (await ev(`document.querySelector('[data-act="intern"]').getAttribute('aria-checked')`)) === 'true');
await ev(`document.querySelector('[data-act="intern"]').click(); true`);
await shot('map-1440');

// ---- Layout ----
const desk = await ev(`(() => { const m = document.getElementById('map').getBoundingClientRect(), p = document.getElementById('map-panel').getBoundingClientRect();
  return { mapW: m.width, mapH: m.height, panelX: p.left, panelW: p.width, scroll: document.documentElement.scrollWidth > innerWidth, pageH: document.documentElement.scrollHeight <= innerHeight + 1 }; })()`);
ok(`1440px: map on the left, panel on the right (${Math.round(desk.mapW)}px / ${Math.round(desk.panelW)}px)`, desk.mapW > 900 && desk.mapH > 600 && desk.panelX >= desk.mapW - 1 && desk.panelW === 380 && !desk.scroll && desk.pageH);
await vp(375, 812); await sleep(500);
await ev(`window.GYF_MAP_VIEW.map.invalidateSize(); true`);
const phone = await ev(`(() => { const p = document.getElementById('map-panel'), r = p.getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(), h = document.getElementById('sheet-handle');
  return { pos: getComputedStyle(p).position, top: r.top, h: innerHeight, mapW: m.width, mapH: m.height, handle: getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height >= 44, scroll: document.documentElement.scrollWidth > innerWidth }; })()`);
ok(`375px: the panel is a bottom sheet, collapsed to its handle (top at ${Math.round(phone.top)} of ${phone.h})`, phone.pos === 'fixed' && phone.top > phone.h - 80 && phone.handle && phone.mapW === 375 && phone.mapH > 400 && !phone.scroll);
await shot('map-375-closed');
await ev(`document.getElementById('sheet-handle').click(); true`); await sleep(450);
const open = await ev(`(() => { const r = document.getElementById('map-panel').getBoundingClientRect(); return { top: r.top, exp: document.getElementById('sheet-handle').getAttribute('aria-expanded') }; })()`);
ok(`375px: tapping the handle opens the sheet (top at ${Math.round(open.top)})`, open.top < 812 - 200 && open.exp === 'true');
await shot('map-375-open');
const presetsFit = await ev(`(() => { const b = document.getElementById('map-presets'); return getComputedStyle(b).overflowX === 'auto' && [...b.querySelectorAll('.preset')].every(x => x.getBoundingClientRect().height >= 40); })()`);
ok('375px: presets scroll sideways and are big enough to tap', presetsFit);
const tips = await ev(`document.querySelectorAll('.biome-tip').length`);
ok(`region names never stack up: at most one open (${tips})`, tips <= 1);
await ev(`document.getElementById('sheet-handle').click(); true`); await sleep(350);
await vp(1440, 900);

// ---- Base layers and attribution ----
const layers = await ev(`[...document.querySelectorAll('.leaflet-control-layers-base label')].map(l => l.textContent.trim()).join(',')`);
ok(`base layer switcher offers Satellite, Terrain and Plain (${layers})`, layers === 'Satellite,Terrain,Plain');
const attrib = [];
for (const name of ['Satellite', 'Terrain', 'Plain']) {
  await ev(`(() => { const l = [...document.querySelectorAll('.leaflet-control-layers-base label')].find(x => x.textContent.trim() === ${JSON.stringify(name)}); l.querySelector('input').click(); return true; })()`);
  await sleep(250);
  attrib.push(await ev(`document.querySelector('.leaflet-control-attribution').textContent`));
}
ok('each base layer shows its required attribution', /Esri/.test(attrib[0]) && /OpenTopoMap/.test(attrib[1]) && /OpenStreetMap/.test(attrib[1]) && /Esri/.test(attrib[2]));
const plainUrl = `(() => { const u = Object.values(window.GYF_MAP_VIEW.map._layers).find(l => l._url && /Canvas/.test(l._url)); return u ? u._url : ''; })()`;
await ev(`window.GYF_THEME.set('daylight'); true`); await sleep(100);
const lightUrl = await ev(plainUrl);
await ev(`window.GYF_THEME.set('sunset'); true`); await sleep(100);
const darkUrl = await ev(plainUrl);
const theme = /Light_Gray/.test(lightUrl) && /Dark_Gray/.test(darkUrl);
ok('the plain map follows the site theme (light gray for Daylight, dark gray for Sunset)', theme);

// ---- Nav and errors ----
ok('Map is marked as the current page in the nav', (await ev(`document.querySelector('.topnav a[aria-current="page"]').textContent`)) === 'Map');
ok('region labels are geographic names only', geo.features.every(f => !/occupied|disputed|territor|settlement|liberated/i.test(f.properties.name + ' ' + f.properties.description)));
await sleep(300);
ok(`no console errors, exceptions or blocked files${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`, errs.length === 0);
console.log(out.join('\n'));
process.exit(0);
