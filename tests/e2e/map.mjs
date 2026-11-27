// The 3D program map (/map): loads with no errors, every program is pinned (or listed), every region lists the right
// programs, presets and places fly in tilted with 3D buildings, Street View and Google Earth links point at the spot,
// filters work, the layout holds at 1440px and 375px, and browsers without WebGL2 still get a working panel.
// Map tiles come from the internet (OpenFreeMap, Esri, OpenTopoMap), so the building checks need a connection.
import { readFileSync, writeFileSync } from 'node:fs';
const [SP, ROOT] = process.argv.slice(2);
const B = 'http://localhost:3124';
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
const TILE_HOSTS = /tiles\.openfreemap\.org|arcgisonline\.com|opentopomap\.org/;
const cmd = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = m => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errs.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) errs.push('console.' + d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
    const e = d.params.entry;
    // A map tile that fails to download is the network, not the page. Anything else (blocked by CSP, our own files) counts.
    if (!(TILE_HOSTS.test(e.url || '') && e.source === 'network')) errs.push('log: ' + e.text + (e.url ? ' ' + e.url : ''));
  }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description }; return r.result?.result?.value; };
const vp = (w, h) => cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
const shot = async n => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
const out = []; const ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
const waitFor = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 120) { if (await ev(expr)) return true; await sleep(120); } return false; };
const settled = (ms = 9000) => waitFor('(() => { const m = window.GYF_MAP_VIEW.map; return !m.isMoving() && !m.isEasing(); })()', ms);
const idle = (ms = 15000) => ev(`new Promise(r => { const m = window.GYF_MAP_VIEW.map; if (m.loaded() && !m.isMoving()) return r(true); const t = setTimeout(() => r(false), ${ms}); m.once('idle', () => { clearTimeout(t); r(true); }); })`);

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Log.enable'); await vp(1440, 900);
await cmd('Page.navigate', { url: B + '/map' });
const ready = await waitFor('document.body && document.body.getAttribute("data-map-ready") === "1"', 20000);
ok('map page loads: style, regions, Armistice Line and pins', ready);
await idle();

// ---- Expected data, worked out here independently of the page ----
const geo = JSON.parse(readFileSync(ROOT + '/public/data/biomes.geojson', 'utf8'));
global.window = global; await import(ROOT + '/public/js/data.js'); await import(ROOT + '/public/js/map-data.js');
const M = global.GYF_MAP;
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const biomeOf = (s) => (geo.features.find(f => inRing(s.lng, s.lat, f.geometry.coordinates[0])) || { properties: {} }).properties.id || null;
const keyOf = (m) => m.id || m.key;
const pinned = M.programs.filter(m => m.sites.length);
const totalSites = pinned.reduce((n, m) => n + m.sites.length, 0);
const pinKeys = `(() => [...new Set(window.GYF_MAP_VIEW.map.getSource('pins').serialize().data.features.map(f => f.properties.k))].sort())()`;

// ---- Every program is on the map ----
const src = await ev(`(() => { const d = window.GYF_MAP_VIEW.map.getSource('pins').serialize().data; return { n: d.features.length, keys: [...new Set(d.features.map(f => f.properties.k))] }; })()`);
ok(`every location has a pin (${src.n} of ${totalSites})`, src.n === totalSites);
ok(`every pinned seed program is on the map (${src.keys.length} of ${pinned.length})`, pinned.every(m => src.keys.includes(keyOf(m))));
await waitFor(`document.querySelectorAll('.pin, .pin-cluster').length > 0`, 6000);
const drawn = await ev(`(() => [...document.querySelectorAll('.pin-cluster span')].reduce((n, s) => n + +s.textContent, 0) + document.querySelectorAll('.pin').length)()`);
ok(`at country view, the pins and cluster counts on screen add up to every location (${drawn})`, drawn === totalSites);
const ulpan = await ev(`(() => { const t = document.getElementById('map-panel-content').innerText; return /No single base/i.test(t) && /Kibbutz Ulpan/.test(t) && /Multiple kibbutzim/.test(t); })()`);
ok('Kibbutz Ulpan is listed in the panel as "Multiple kibbutzim" with no pin', ulpan && !src.keys.includes('kibbutz-ulpan'));
ok('multi-base programs get one pin per base (Young Judaea: 3)', (await ev(`window.GYF_MAP_VIEW.map.getSource('pins').serialize().data.features.filter(f => f.properties.k === 'year-course').length`)) === 3);
ok('every program location is marked approximate', M.programs.every(m => m.sites.every(s => s.approx === true)));
ok('pins are real buttons with a name for screen readers', await ev(`[...document.querySelectorAll('.pin, .pin-cluster')].every(b => b.tagName === 'BUTTON' && b.getAttribute('aria-label'))`));

// ---- Regions ----
const reg = await ev(`(() => { const m = window.GYF_MAP_VIEW.map; return { n: m.getSource('biomes').serialize().data.features.length, imgs: ['basalt','forest','fields','sand','hatch','contours','crosshatch','sparse','rings','dunes'].every(k => m.hasImage('pat-' + k)), layer: !!m.getLayer('biome-fill') }; })()`);
ok('all 10 regions are drawn, each with its own texture', reg.n === 10 && reg.imgs && reg.layer);
for (const f of geo.features) {
  const want = pinned.filter(m => m.sites.some(s => biomeOf(s) === f.properties.id)).map(keyOf).sort();
  await ev(`document.querySelector('.mp-back') && document.querySelector('.mp-back').click(); document.querySelector('[data-biome="${f.properties.id}"]').click(); true`);
  const got = await ev(`(() => { const box = document.getElementById('map-panel-content'); return { keys: [...box.querySelectorAll('[data-prog]')].map(b => b.dataset.prog).sort(), h: box.querySelector('.mp-h').textContent, desc: box.querySelector('.mp-desc').textContent, sel: window.GYF_MAP_VIEW.map.getFeatureState({ source: 'biomes', id: '${f.properties.id}' }).sel }; })()`);
  const sentences = (got.desc.match(/[.!?](\s|$)/g) || []).length;
  ok(`${f.properties.name}: lists ${want.length} program(s) [${want.join(', ') || 'none'}], 2-sentence description, highlighted`, got.h === f.properties.name && JSON.stringify(got.keys) === JSON.stringify(want) && sentences === 2 && got.sel === true);
}
// A real click on the map itself (the southern Golan, away from any pins).
await ev(`document.querySelector('.mp-back').click(); true`);
const golan = await ev(`(() => { const p = window.GYF_MAP_VIEW.map.project([35.78, 32.86]); const r = document.querySelector('#map canvas').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; })()`);
const hitCanvas = await ev(`document.elementFromPoint(${golan.x}, ${golan.y}).tagName`);
for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: golan.x, y: golan.y, button: 'left', clickCount: 1 });
await sleep(300);
ok(`clicking a region on the map opens it in the panel (clicked ${hitCanvas})`, (await ev(`document.querySelector('#map-panel-content .mp-h').textContent`)) === 'Golan Heights');
const spot = { 'haemek': 'rift', 'livnot': 'upper-galilee', 'hannaton': 'lower-galilee', 'bar-ilan-xp': 'coast', 'har-etzion': 'judean-hills', 'hakotel': 'judean-hills', 'ein-prat': 'judean-desert' };
ok('spot checks: Kfar Ruppin in the rift, Tzfat in Upper Galilee, Hannaton in Lower Galilee, Ramat Gan on the coast, Gush Etzion and the Old City in the Judean Hills, Kfar Adumim in the desert',
  Object.entries(spot).every(([k, b]) => biomeOf(M.programs.find(m => keyOf(m) === k).sites[0]) === b));

// ---- Presets fly in tilted, with 3D buildings at city level ----
for (let i = 0; i < M.presets.length; i++) {
  const p = M.presets[i];
  await ev(`document.querySelector('[data-preset="${i}"]').click(); true`);
  await sleep(200); await settled();
  const at = await ev(`(() => { const m = window.GYF_MAP_VIEW.map, c = m.getCenter(); return { lat: c.lat, lng: c.lng, z: m.getZoom(), pitch: m.getPitch(), pressed: document.querySelector('[data-preset="${i}"]').getAttribute('aria-pressed'), h: document.querySelector('#map-panel-content .mp-h').textContent }; })()`);
  const there = Math.abs(at.lat - p.center[0]) < 0.005 && Math.abs(at.lng - p.center[1]) < 0.005 && Math.abs(at.z - p.zoom) < 0.05 && Math.abs(at.pitch - p.pitch) < 1;
  const panelOk = p.places.length === 1 ? at.h === M.places.find(x => x.id === p.places[0]).name : at.h === p.name;
  ok(`preset "${p.name}" flies to ${p.center.join(',')} z${p.zoom}, tilted ${p.pitch} degrees (got ${at.lat.toFixed(3)},${at.lng.toFixed(3)} z${at.z.toFixed(1)} tilt ${Math.round(at.pitch)}), panel shows it`, there && at.pressed === 'true' && panelOk);
  if (['Jerusalem', 'Tel Aviv-Yafo', 'Arava'].includes(p.name)) {
    await idle(20000);
    const b = await ev(`(() => { const m = window.GYF_MAP_VIEW.map; return { b: m.queryRenderedFeatures({ layers: ['gyf-buildings'] }).length, l: m.queryRenderedFeatures({ layers: ['place-labels'] }).length }; })()`);
    // Tiles merge neighboring buildings into a few big pieces, so a kibbutz counts low even when it is fully drawn.
    if (p.name === 'Arava') ok(`${p.name}: kibbutz buildings stand up (${b.b} merged pieces) and place names show (${b.l})`, b.b > 0 && b.l > 0);
    else ok(`${p.name}: 3D buildings stand up (${b.b} drawn) and place names show (${b.l})`, b.b > 100 && b.l > 0);
    await shot('map3d-' + p.name.replace(/[^a-z]+/gi, '-').toLowerCase());
  }
  if (p.zoom < 13) ok(`place names stay hidden when zoomed out (${p.name})`, (await ev(`window.GYF_MAP_VIEW.map.queryRenderedFeatures({ layers: ['place-labels'] }).length`)) === 0);
}

// ---- A pin opens its card and flies in ----
await ev(`document.querySelector('[data-preset="0"]').click(); true`); await sleep(200); await settled(); await sleep(400);
const pinThere = await waitFor(`!!document.querySelector('.pin[data-pin="hevruta#0"]')`, 6000);
await ev(`document.querySelector('.pin[data-pin="hevruta#0"]').click(); true`);
await sleep(200); await settled();
const card = await ev(`(() => { const c = document.querySelector('.pcard'); if (!c) return null; const a = c.querySelector('.pc-links a.btn.primary'); const out = [...c.querySelectorAll('.out-links a')];
  const m = window.GYF_MAP_VIEW.map, ctr = m.getCenter();
  return { name: c.querySelector('.mp-h').textContent, type: c.querySelector('.tbadge').textContent, approx: !!c.querySelector('.mbadge.approx'), base: c.querySelector('.pc-facts dd').textContent,
    tracks: c.querySelectorAll('.pc-tracks li').length, link: a && a.href, target: a && a.target, rel: a && a.rel, intern: (c.querySelector('.mbadge:not(.approx):not(.tag)') || {}).textContent,
    sv: out[0] && out[0].href, earth: out[1] && out[1].href, outTarget: out.every(x => x.target === '_blank' && /noopener/.test(x.rel)),
    active: document.querySelector('.pin[data-pin="hevruta#0"]').classList.contains('is-active'), lat: ctr.lat, lng: ctr.lng, pitch: m.getPitch() }; })()`);
ok(`clicking a pin opens its card: name, type, base, tracks, link, approximate badge (${card && card.name})`, pinThere && card && /Hevruta/.test(card.name) && /Pluralistic/.test(card.type) && card.approx && card.base.length > 5 && card.tracks > 0 && /hartman\.org\.il/.test(card.link) && card.target === '_blank' && /noopener/.test(card.rel));
ok(`the pin is highlighted and the map flies to it in 3D (${card && card.lat.toFixed(3)},${card && card.lng.toFixed(3)} tilt ${card && Math.round(card.pitch)})`, card && card.active && Math.abs(card.lat - 31.765) < 0.002 && Math.abs(card.lng - 35.219) < 0.002 && card.pitch > 45);
ok(`Street View and Google Earth links open at the pin (${card && card.sv})`, card && card.sv === 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=31.76500,35.21900' && /^https:\/\/earth\.google\.com\/web\/@31\.76500,35\.21900,/.test(card.earth) && card.outTarget);
ok(`Hevruta is marked as a nonprofit internship (${card && card.intern})`, card && card.intern === 'Nonprofit internship');
await shot('map3d-pin-card');
const livnot = await ev(`(() => { window.GYF_MAP_VIEW.openProgram('livnot', 0, {}); const c = document.querySelector('.pcard'); return c.querySelector('.mp-h').textContent + '|' + (c.querySelector('.mbadge.tag') || {}).textContent; })()`);
ok(`Livnot is tagged (${livnot})`, livnot === "Livnot U'Lehibanot|Not a classic post-high school year");
const seed = await ev(`(() => { window.GYF_MAP_VIEW.openProgram('ein-prat', 0, {}); return document.querySelector('.pcard').innerText; })()`);
ok('a program with no known website says so instead of linking anywhere', /No website listed yet/.test(seed) && !/Program website/.test(seed));

// ---- Places ----
await ev(`(() => { for (let i = 0; i < 3; i++) { const b = document.querySelector('.mp-back'); if (!b) break; b.click(); } return true; })()`);
await ev(`document.querySelector('[data-place="ketura"]').click(); true`); await sleep(200); await settled();
const place = await ev(`(() => { const box = document.getElementById('map-panel-content'), m = window.GYF_MAP_VIEW.map, c = m.getCenter(); return { h: box.querySelector('.mp-h').textContent, kind: box.querySelector('.mp-eyebrow').textContent,
  progs: [...box.querySelectorAll('[data-prog]')].map(b => b.dataset.prog), sv: box.querySelector('.out-links a').href, lat: c.lat, z: m.getZoom(), pitch: m.getPitch() }; })()`);
ok(`a kibbutz flies in to 3D and lists its programs (${place.h}: ${place.progs.join(', ')})`, place.h === 'Ketura' && place.kind === 'Kibbutz' && place.progs.includes('year-course') && Math.abs(place.lat - 29.9715) < 0.002 && place.z > 16 && place.pitch > 50);
ok('the place has its own Street View link', place.sv === 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=29.97150,35.06150');
await ev(`document.querySelector('[data-act="orbit"]').click(); true`);
const b0 = await ev(`window.GYF_MAP_VIEW.map.getBearing()`); await sleep(900); const b1 = await ev(`window.GYF_MAP_VIEW.map.getBearing()`);
await ev(`document.querySelector('[data-act="orbit"]').click(); true`);
const b2 = await ev(`window.GYF_MAP_VIEW.map.getBearing()`); await sleep(500); const b3 = await ev(`window.GYF_MAP_VIEW.map.getBearing()`);
ok(`Orbit slowly turns the view, and stops when tapped again (${(b1 - b0).toFixed(1)} deg, then ${(b3 - b2).toFixed(2)})`, b1 - b0 > 1 && Math.abs(b3 - b2) < 0.01);
await ev(`document.querySelector('[data-preset="5"]').click(); true`); await sleep(200); await settled();
const area = await ev(`[...document.querySelectorAll('#map-panel-content [data-place]')].map(b => b.dataset.place).join(',')`);
ok(`an area preset lists its places to fly into (${area})`, area === 'hannaton,ravid');

// ---- Filters ----
await ev(`(() => { for (let i = 0; i < 3; i++) { const b = document.querySelector('.mp-back'); if (!b) break; b.click(); } document.querySelector('[data-act="country"]').click(); return true; })()`);
await sleep(200); await settled();
for (const t of Object.keys(M.types).filter(t => t !== 'orthodox')) await ev(`document.querySelector('[data-type="${t}"]').click(); true`);
const orth = await ev(pinKeys);
ok(`type filter: only Orthodox Yeshiva/Midrasha pins remain (${orth.length})`, JSON.stringify(orth) === JSON.stringify(pinned.filter(m => m.mapType === 'orthodox').map(keyOf).sort()));
await sleep(500);
ok('the pins on screen follow the filter', await ev(`[...document.querySelectorAll('.pin')].every(b => /^(hakotel|harova|lindenbaum|nishmat|har-etzion|migdal-oz)#/.test(b.dataset.pin))`));
await ev(`document.querySelector('[data-act="reset"]').click(); true`);
ok('"Show all" brings every pin back', (await ev(pinKeys)).length === pinned.length);
await ev(`document.querySelector('[data-act="intern"]').click(); true`);
const intern = await ev(pinKeys);
ok(`internships toggle keeps only programs with internships [${intern.join(', ')}]`, JSON.stringify(intern) === JSON.stringify(['aardvark', 'bar-ilan-xp', 'hevruta', 'nativ', 'year-course']));
const biz = await ev(`[...document.querySelectorAll('.pr-flag.biz')].map(x => x.closest('[data-prog]').dataset.prog).sort().join(',')`);
ok(`business internships are marked (${biz})`, biz === 'aardvark,bar-ilan-xp,year-course');
await ev(`document.querySelector('[data-act="intern"]').click(); true`);

// ---- Base layers, toggles, attribution, theme ----
const vis = (lid) => `window.GYF_MAP_VIEW.map.getLayoutProperty('${lid}', 'visibility')`;
await ev(`document.querySelector('[data-base="satellite"]').click(); true`); await sleep(400);
const sat = await ev(`(() => { const m = window.GYF_MAP_VIEW.map; const fills = m.getStyle().layers.filter(l => l.type === 'fill' && !/^biome/.test(l.id)); return { sat: ${vis('sat')}, fillsHidden: fills.every(l => m.getLayoutProperty(l.id, 'visibility') === 'none'), bld: ${vis('gyf-buildings')}, attrib: document.querySelector('.maplibregl-ctrl-attrib').textContent }; })()`);
ok('Satellite: imagery on, map fills off, 3D buildings and Esri credit stay', sat.sat === 'visible' && sat.fillsHidden && sat.bld !== 'none' && /Esri/.test(sat.attrib));
await ev(`document.querySelector('[data-base="terrain"]').click(); true`); await sleep(400);
const topo = await ev(`({ topo: ${vis('topo')}, sat: ${vis('sat')}, attrib: document.querySelector('.maplibregl-ctrl-attrib').textContent })`);
ok('Terrain: OpenTopoMap on with its credit', topo.topo === 'visible' && topo.sat === 'none' && /OpenTopoMap/.test(topo.attrib) && /OpenStreetMap/.test(topo.attrib));
await ev(`document.querySelector('[data-base="plain"]').click(); true`); await sleep(400);
ok('Map: OpenStreetMap credit shows', /OpenStreetMap/.test(await ev(`document.querySelector('.maplibregl-ctrl-attrib').textContent`)));
await ev(`document.querySelector('.layer-menu').open = true; document.querySelector('[data-toggle="buildings"]').click(); true`);
ok('the 3D buildings switch turns them off', (await ev(vis('gyf-buildings'))) === 'none' && (await ev(`document.querySelector('[data-toggle="buildings"]').getAttribute('aria-checked')`)) === 'false');
await ev(`document.querySelector('[data-toggle="buildings"]').click(); document.querySelector('[data-toggle="line"]').click(); true`);
ok('the Armistice Line switch hides the line and its label', (await ev(vis('greenline'))) === 'none' && (await ev(vis('greenline-label'))) === 'none');
await ev(`document.querySelector('[data-toggle="line"]').click(); document.querySelector('.layer-menu').open = false; true`);
ok('the Armistice Line is labeled exactly once', (await ev(`window.GYF_MAP_VIEW.map.getSource('greenline-label').serialize().data.features.length`)) === 1);
await ev(`window.GYF_THEME.set('daylight'); true`);
await sleep(300); await idle(15000);
await waitFor(`(() => { const m = window.GYF_MAP_VIEW.map; return !!m.getLayer('gyf-buildings') && m.getPaintProperty('gyf-buildings', 'fill-extrusion-color') === '#ebe7df'; })()`, 15000);
const light = await ev(`(() => { const m = window.GYF_MAP_VIEW.map; return { color: m.getLayer('gyf-buildings') && m.getPaintProperty('gyf-buildings', 'fill-extrusion-color'), bio: !!m.getLayer('biome-fill'), sat: !!m.getLayer('sat'), line: !!m.getLayer('greenline'), pins: m.getSource('pins') && m.getSource('pins').serialize().data.features.length }; })()`);
ok(`switching to Daylight reloads a light map and keeps every layer (buildings ${light.color})`, light.color === '#ebe7df' && light.bio && light.sat && light.line && light.pins === totalSites);
await ev(`document.querySelector('[data-preset="1"]').click(); true`); await sleep(200); await settled(); await idle(15000); await shot('map3d-daylight');
await ev(`window.GYF_THEME.set('sunset'); true`); await sleep(300); await idle(15000);

// ---- Layout ----
await ev(`document.querySelector('[data-preset="1"]').click(); true`); await sleep(200); await settled(); await idle(15000);
await shot('map3d-1440');
const desk = await ev(`(() => { const m = document.getElementById('map').getBoundingClientRect(), p = document.getElementById('map-panel').getBoundingClientRect();
  return { mapW: m.width, mapH: m.height, panelX: p.left, panelW: p.width, scroll: document.documentElement.scrollWidth > innerWidth, pageH: document.documentElement.scrollHeight <= innerHeight + 1 }; })()`);
ok(`1440px: map on the left, panel on the right (${Math.round(desk.mapW)}px / ${Math.round(desk.panelW)}px)`, desk.mapW > 900 && desk.mapH > 550 && desk.panelX >= desk.mapW - 1 && desk.panelW === 380 && !desk.scroll && desk.pageH);
await vp(375, 812); await sleep(600);
await ev(`document.body.classList.remove('sheet-open'); true`); await sleep(400);
const phone = await ev(`(() => { const p = document.getElementById('map-panel'), r = p.getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(), h = document.getElementById('sheet-handle'), t = document.getElementById('map-tools').getBoundingClientRect();
  return { pos: getComputedStyle(p).position, top: r.top, h: innerHeight, mapW: m.width, mapH: m.height, handle: getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height >= 44, scroll: document.documentElement.scrollWidth > innerWidth, toolsFit: t.right <= 375 }; })()`);
ok(`375px: the panel is a bottom sheet, collapsed to its handle (top at ${Math.round(phone.top)} of ${phone.h})`, phone.pos === 'fixed' && phone.top > phone.h - 80 && phone.handle && phone.mapW === 375 && phone.mapH > 400 && !phone.scroll && phone.toolsFit);
await shot('map3d-375-closed');
await ev(`document.getElementById('sheet-handle').click(); true`); await sleep(450);
const open = await ev(`(() => { const r = document.getElementById('map-panel').getBoundingClientRect(); return { top: r.top, exp: document.getElementById('sheet-handle').getAttribute('aria-expanded') }; })()`);
ok(`375px: tapping the handle opens the sheet (top at ${Math.round(open.top)})`, open.top < 812 - 200 && open.exp === 'true');
await shot('map3d-375-open');
ok('375px: presets scroll sideways and are big enough to tap', await ev(`(() => { const b = document.getElementById('map-presets'); return getComputedStyle(b).overflowX === 'auto' && [...b.querySelectorAll('.preset')].every(x => x.getBoundingClientRect().height >= 40); })()`));
await vp(1440, 900);

// ---- Nav and errors ----
ok('Map is marked as the current page in the nav', (await ev(`document.querySelector('.topnav a[aria-current="page"]').textContent`)) === 'Map');
ok('region and place labels are geographic names only', [...geo.features.map(f => f.properties.name + ' ' + f.properties.description), ...M.places.map(p => p.name)].every(t => !/occupied|disputed|territor|settlement|liberated/i.test(t)));
await sleep(300);
const mapErrs = await ev(`window.GYF_MAP_VIEW.errors.filter(e => !/fetch|network|Failed to load|AJAXError/i.test(e))`);
ok(`no console errors, exceptions, blocked files or map errors${errs.length || mapErrs.length ? ': ' + [...errs, ...mapErrs].slice(0, 4).join(' | ') : ''}`, errs.length === 0 && mapErrs.length === 0);

// ---- Without WebGL2: the panel still works ----
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; })();` });
errs.length = 0;
await cmd('Page.navigate', { url: B + '/map' });
const nogl = await waitFor('document.body && document.body.getAttribute("data-map-ready") === "nogl"', 10000);
await ev(`document.querySelector('[data-place="hannaton"]').click(); true`);
const ng = await ev(`({ note: !!document.querySelector('.map-nogl'), h: document.querySelector('#map-panel-content .mp-h').textContent, sv: !!document.querySelector('#map-panel-content .out-links a'), progs: document.querySelectorAll('#map-panel-content [data-prog]').length })`);
ok(`without WebGL2: a clear note, and the panel still opens places with Street View links (${ng.h}, ${ng.progs} program)`, nogl && ng.note && ng.h === 'Hannaton' && ng.sv && ng.progs === 1 && errs.length === 0);
await shot('map-nogl');
console.log(out.join('\n'));
process.exit(0);
