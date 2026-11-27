/*
 * Program map (/map). MapLibre GL with OpenFreeMap vector tiles (OpenStreetMap data, no API key).
 * Clicking a city, kibbutz or program flies in and tilts so the buildings stand up in 3D.
 * Data: GYF_DATA (js/data.js) for program details, GYF_MAP (js/map-data.js) for places,
 * data/biomes.geojson for regions, data/green-line.geojson for the 1949 Armistice Line.
 */
import * as maplibregl from "/vendor/maplibre/maplibre-gl.js";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.js");

const D = window.GYF_DATA, M = window.GYF_MAP;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
const isPhone = () => window.matchMedia("(max-width: 600px)").matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* this visit only */ } },
};
const theme = () => document.documentElement.getAttribute("data-theme") || "sunset";

// ---------- Programs: data.js details + map places ----------
const byId = {};
(D && D.programs ? D.programs : []).forEach((p) => { byId[p.id] = p; });
function internshipOf(fields) {
  const f = fields || {};
  if (f.business && /intern/i.test(f.business)) return { kind: "business", label: "Business internships" };
  const any = Object.keys(f).map((k) => f[k]).find((t) => /intern/i.test(String(t)));
  if (any) return { kind: "other", label: /nonprofit/i.test(any) ? "Nonprofit internship" : "Internships" };
  return null;
}
const programs = M.programs.map((m) => {
  const p = m.id ? byId[m.id] : null;
  const fields = p && p.fields ? p.fields : {};
  const tracks = [];
  Object.keys(fields).forEach((k) => { if (fields[k]) tracks.push(String(fields[k])); });
  (m.tracks || []).forEach((t) => { if (!tracks.some((x) => x.toLowerCase() === t.toLowerCase())) tracks.push(t); });
  return {
    key: m.id || m.key, id: m.id,
    name: (p && p.name) || m.name,
    type: m.mapType,
    base: m.panelLabel || (p && p.base) || m.base || "",
    website: (p && p.website) || m.website || null,
    tracks: tracks.slice(0, 5),
    internship: internshipOf(fields),
    sites: (m.sites || []).map((s, i) => Object.assign({ i }, s)),
    note: m.note || null, tag: m.tag || null,
    seedOnly: !!m.seedOnly || !!(m.id && !p),
    panelLabel: m.panelLabel || null,
  };
});
const progByKey = {};
programs.forEach((p) => { progByKey[p.key] = p; });
const TYPES = M.types;
const PLACES = M.places;
const placeById = {};
PLACES.forEach((p) => { placeById[p.id] = p; });
const KIND = { neighborhood: "Neighborhood", kibbutz: "Kibbutz", town: "Town" };

// Nearest place within 3 km of each program location.
const km = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
programs.forEach((p) => p.sites.forEach((s) => {
  let best = null, bestD = 3;
  PLACES.forEach((pl) => { const d = km(s, pl); if (d < bestD) { bestD = d; best = pl.id; } });
  s.place = best;
}));

// ---------- Outside links (no key needed) ----------
const streetViewUrl = (lat, lng) => "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + lat.toFixed(5) + "," + lng.toFixed(5);
const earthUrl = (lat, lng) => "https://earth.google.com/web/@" + lat.toFixed(5) + "," + lng.toFixed(5) + ",0a,900d,35y,0h,60t,0r";
const outLinks = (lat, lng) =>
  '<div class="out-links"><a class="btn" href="' + streetViewUrl(lat, lng) + '" target="_blank" rel="noopener noreferrer">Street View</a>' +
  '<a class="btn" href="' + earthUrl(lat, lng) + '" target="_blank" rel="noopener noreferrer">Google Earth</a></div>' +
  '<p class="muted out-note">Opens Google at the approximate spot. Street View shows the nearest photo it has.</p>';

// ---------- Filters ----------
const filt = { types: new Set(Object.keys(TYPES)), internships: false };
const passes = (p) => filt.types.has(p.type) && (!filt.internships || !!p.internship);

// ---------- Map ----------
const ISRAEL = [[34.2, 29.45], [35.95, 33.4]];
const styleUrl = () => "https://tiles.openfreemap.org/styles/" + (theme() === "daylight" ? "liberty" : "dark");
// If the map style can't load (offline, or the tile service is down), regions, pins and filters still work.
const FALLBACK_STYLE = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#2a231b" } }] };
let base = ["plain", "satellite", "terrain"].includes(store.get("gyf:map-base3")) ? store.get("gyf:map-base3") : "plain";
const show = { regions: true, line: true, buildings: true };
const errors = [];

// Some browsers (older laptops, locked-down school computers) can't draw WebGL2. Then the panel still works:
// every program, region and place, with Street View and Google Earth links. Map calls become no-ops.
const GL = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; } })();
const NOOP = new Proxy({}, { get: (t, k) => (k === "getCanvasContainer" || k === "getCanvas" ? () => document.createElement("div") : () => undefined) });
const map = !GL ? NOOP : new maplibregl.Map({
  container: "map",
  style: styleUrl(),
  bounds: ISRAEL,
  fitBoundsOptions: { padding: 16 },
  maxBounds: [[32.6, 28.6], [37.6, 34.4]],
  minZoom: 6.5, maxZoom: 19, maxPitch: 70,
  attributionControl: { compact: false },
  dragRotate: true, touchPitch: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
// OpenFreeMap's dark style asks for a couple of icons its sprite sheet doesn't have; give them blank stand-ins.
map.setMissingStyleImageResolver((imgId) => { if (!map.hasImage(imgId)) map.addImage(imgId, { width: 1, height: 1, data: new Uint8Array(4) }); });
let styleOk = false;
map.on("error", (e) => {
  const msg = (e && e.error && e.error.message) || String(e && e.error);
  errors.push(msg);
  // No style yet: fall back to a plain background so the program layers can still draw.
  if (!styleOk && !map.isStyleLoaded()) { styleOk = true; map.setStyle(FALLBACK_STYLE, { diff: false }); }
});

// ---------- Region textures (drawn as small SVG tiles, used as fill patterns) ----------
const PATTERNS = {
  basalt: [10, 10, '<rect width="10" height="10" fill="#4a423a"/><circle cx="2" cy="3" r="1.1" fill="#120f0c"/><circle cx="7" cy="1.5" r=".8" fill="#120f0c"/><circle cx="5" cy="7" r="1.2" fill="#120f0c"/><circle cx="9" cy="8.5" r=".7" fill="#120f0c"/>'],
  forest: [14, 14, '<rect width="14" height="14" fill="#2f6b3a"/><circle cx="3.5" cy="3.5" r="2.4" fill="#123d1d"/><circle cx="10.5" cy="10.5" r="2.4" fill="#123d1d"/>'],
  fields: [12, 12, '<rect width="12" height="12" fill="#9aa63e"/><rect y="0" width="12" height="4" fill="#d1c86e"/><rect y="7" width="12" height="2" fill="#5f6d22"/>'],
  sand: [8, 8, '<rect width="8" height="8" fill="#e2cc92"/><circle cx="2" cy="2" r="1" fill="#fff6dc"/><circle cx="6" cy="6" r="1" fill="#fff6dc"/>'],
  hatch: [10, 10, '<rect width="10" height="10" fill="#6f8f6a"/><path d="M0 10 L10 0 M-2 2 L2 -2 M8 12 L12 8" stroke="#2f4a2c" stroke-width="1.6"/>'],
  contours: [24, 12, '<rect width="24" height="12" fill="#b59a6e"/><path d="M0 3 Q6 0 12 3 T24 3 M0 9 Q6 6 12 9 T24 9" stroke="#5e4629" stroke-width="1.2" fill="none"/>'],
  crosshatch: [10, 10, '<rect width="10" height="10" fill="#d4bd9c"/><path d="M0 0 L10 10 M10 0 L0 10" stroke="#7d6446" stroke-width="1"/>'],
  sparse: [18, 18, '<rect width="18" height="18" fill="#d8b47e"/><circle cx="4" cy="5" r="1.3" fill="#7a5a2e"/><circle cx="13" cy="14" r="1.3" fill="#7a5a2e"/>'],
  rings: [16, 16, '<rect width="16" height="16" fill="#b98a5c"/><circle cx="8" cy="8" r="4.5" stroke="#5e3a1f" stroke-width="1.3" fill="none"/>'],
  dunes: [20, 10, '<rect width="20" height="10" fill="#e8bf7a"/><path d="M0 5 Q5 1 10 5 T20 5" stroke="#9a6a2c" stroke-width="1.4" fill="none"/>'],
};
const patternImages = Promise.all(Object.keys(PATTERNS).map((k) => new Promise((res) => {
  const [w, h, body] = PATTERNS[k];
  const img = new Image(w * 2, h * 2);
  img.onload = () => res([k, img]);
  img.onerror = () => res([k, null]);
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w * 2 + '" height="' + h * 2 + '" viewBox="0 0 ' + w + " " + h + '">' + body + "</svg>");
})));

// ---------- Geometry ----------
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeometry(lng, lat, g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some((rings) => inRing(lng, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lng, lat, h)));
}

// ---------- State ----------
let bio = null, line = null;
let view = { kind: "home" }; // home | biome | program | place | area
let hoverBiome = null, selBiome = null, activeKey = null;

// ---------- Pins (HTML markers, clustered by MapLibre) ----------
const pinFeatures = () => ({
  type: "FeatureCollection",
  features: programs.filter(passes).flatMap((p) => p.sites.map((s) => ({
    type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { k: p.key, s: s.i },
  }))),
});
const pinEls = {};    // "key#i" -> Marker
const clusterEls = {}; // cluster id -> Marker
let onScreen = {};
function pinMarker(p, s) {
  const t = TYPES[p.type];
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pin";
  el.style.setProperty("--c", t.color);
  el.setAttribute("aria-label", p.name + ", " + s.label + " (" + t.label + ")");
  el.title = p.name + " · " + s.label;
  el.innerHTML = "<b>" + t.letter + "</b>";
  el.dataset.pin = p.key + "#" + s.i;
  el.addEventListener("click", (e) => { e.stopPropagation(); openProgram(p.key, s.i, { fly: true }); });
  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([s.lng, s.lat]);
}
function clusterMarker(id, n, coords) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pin-cluster";
  el.setAttribute("aria-label", n + " program locations here. Zoom in");
  el.innerHTML = "<span>" + n + "</span>";
  el.addEventListener("click", async (e) => {
    e.stopPropagation();
    const src = map.getSource("pins");
    let z = map.getZoom() + 2;
    try { z = await src.getClusterExpansionZoom(id); } catch (err) { /* keep the default step */ }
    map.easeTo({ center: coords, zoom: Math.min(z + 0.3, 17), duration: reduce ? 0 : 600 });
  });
  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(coords);
}
function syncPins() {
  if (!map.getSource("pins") || !map.isSourceLoaded("pins")) return;
  const next = {};
  map.querySourceFeatures("pins").forEach((f) => {
    const c = f.geometry.coordinates, pr = f.properties;
    if (pr.cluster) {
      const id = "c" + pr.cluster_id;
      if (next[id]) return;
      let m = clusterEls[id];
      if (!m) m = clusterEls[id] = clusterMarker(pr.cluster_id, pr.point_count, c);
      next[id] = m;
    } else {
      const id = pr.k + "#" + pr.s;
      if (next[id]) return;
      let m = pinEls[id];
      if (!m) { const p = progByKey[pr.k]; m = pinEls[id] = pinMarker(p, p.sites[pr.s]); }
      next[id] = m;
    }
  });
  Object.keys(onScreen).forEach((id) => { if (!next[id]) onScreen[id].remove(); });
  Object.keys(next).forEach((id) => { if (!onScreen[id]) next[id].addTo(map); });
  onScreen = next;
  markActive();
}
function markActive() {
  Object.keys(pinEls).forEach((id) => pinEls[id].getElement().classList.toggle("is-active", id === activeKey));
}
map.on("render", syncPins);

// ---------- Layers (added again whenever the style reloads, e.g. on a theme change) ----------
function firstSymbolId() {
  const l = map.getStyle().layers.find((x) => x.type === "symbol");
  return l ? l.id : undefined;
}
// The first layer after the vector map's last fill or line: 3D buildings and the Armistice Line go here, above every
// road and footprint (some styles put a label layer before their buildings and roads) and under the labels.
function afterLastGround() {
  const ls = map.getStyle().layers.filter((l) => !["gyf-buildings", "greenline", "greenline-label", "place-labels", "pins-hit"].includes(l.id));
  let last = -1;
  ls.forEach((l, i) => { if (l.type !== "symbol" && l.type !== "circle") last = i; });
  return ls[last + 1] ? ls[last + 1].id : undefined;
}
const hasGlyphs = () => !!map.getStyle().glyphs;
const regionOpacity = (on, hover, rest) => ["case", ["boolean", ["feature-state", "sel"], false], on, ["boolean", ["feature-state", "hover"], false], hover, rest];
async function addLayers() {
  const style = map.getStyle();
  const hasOMT = !!(style.sources && style.sources.openmaptiles);
  const before = firstSymbolId();

  (await patternImages).forEach(([k, img]) => { if (img && !map.hasImage("pat-" + k)) map.addImage("pat-" + k, img, { pixelRatio: 2 }); });

  // Satellite and terrain sit under everything; the vector map's own fills hide when they are on.
  if (!map.getSource("sat")) map.addSource("sat", { type: "raster", tileSize: 256, maxzoom: 19,
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Imagery &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community" });
  if (!map.getSource("topo")) map.addSource("topo", { type: "raster", tileSize: 256, maxzoom: 17,
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png", "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"],
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)' });
  const bottom = style.layers.find((l) => l.type !== "background");
  if (!map.getLayer("sat")) map.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } }, bottom && bottom.id);
  if (!map.getLayer("topo")) map.addLayer({ id: "topo", type: "raster", source: "topo", layout: { visibility: "none" } }, bottom && bottom.id);

  // Regions
  if (bio && !map.getSource("biomes")) map.addSource("biomes", { type: "geojson", data: bio, promoteId: "id" });
  if (bio && !map.getLayer("biome-fill")) {
    map.addLayer({ id: "biome-fill", type: "fill", source: "biomes",
      paint: {
        "fill-pattern": ["concat", "pat-", ["get", "pattern"]],
        // 35% over the country, fading out as you come down to street level so buildings stand clear.
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, regionOpacity(0.62, 0.55, 0.35), 13, regionOpacity(0.3, 0.25, 0.14), 14.5, regionOpacity(0.12, 0.08, 0)],
      } }, before);
    map.addLayer({ id: "biome-line", type: "line", source: "biomes",
      paint: {
        "line-color": ["case", ["boolean", ["feature-state", "sel"], false], "#f2b544", "#f6efe4"],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.5, ["boolean", ["feature-state", "hover"], false], 2, 1],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, ["case", ["boolean", ["feature-state", "sel"], false], 1, 0.4], 15, ["case", ["boolean", ["feature-state", "sel"], false], 0.6, 0]],
      } }, before);
  }

  // Parks and woods in green under the buildings, like a city model.
  const light = theme() === "daylight";
  if (hasOMT && !map.getLayer("gyf-green")) {
    map.addLayer({ id: "gyf-green", type: "fill", source: "openmaptiles", "source-layer": "park", minzoom: 11,
      paint: { "fill-color": light ? "#cfe3c0" : "#2c4a2e", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, light ? 0.8 : 0.75] } }, before);
    map.addLayer({ id: "gyf-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", minzoom: 11, filter: ["in", ["get", "class"], ["literal", ["wood", "grass"]]],
      paint: { "fill-color": light ? "#bcd9a8" : "#2f5532", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, light ? 0.7 : 0.6] } }, before);
  }
  // 3D buildings from OpenStreetMap. They rise as you zoom in; taller ones are paler, and the sun shades their sides.
  if (hasOMT && map.getLayer("building-3d")) map.removeLayer("building-3d");
  if (hasOMT && !map.getLayer("gyf-buildings")) {
    map.setLight({ anchor: "viewport", color: "#ffffff", intensity: light ? 0.35 : 0.5, position: [1.3, 200, 35] });
    map.addLayer({ id: "gyf-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13.5,
      paint: {
        "fill-extrusion-color": light ? "#ebe7df" : ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#a99e92", 30, "#c4b9ad", 90, "#ddd4c9"],
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, ["coalesce", ["get", "render_height"], 6]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, ["coalesce", ["get", "render_min_height"], 0]],
        "fill-extrusion-opacity": light ? 0.92 : 0.9,
        "fill-extrusion-vertical-gradient": true,
      } }, afterLastGround());
  }

  // 1949 Armistice Line: thin dashed gray, labeled once.
  if (line && !map.getSource("greenline")) {
    map.addSource("greenline", { type: "geojson", data: line });
    map.addSource("greenline-label", { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [34.985, 32.235] }, properties: { name: "1949 Armistice Line" } }] } });
  }
  if (line && !map.getLayer("greenline")) {
    map.addLayer({ id: "greenline", type: "line", source: "greenline", paint: { "line-color": "#a3a7ad", "line-width": 1.6, "line-opacity": 0.95, "line-dasharray": [3, 3.5] } }, afterLastGround());
    if (hasGlyphs()) map.addLayer({ id: "greenline-label", type: "symbol", source: "greenline-label", maxzoom: 12,
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-anchor": "left", "text-offset": [0.6, 0], "text-allow-overlap": true },
      paint: { "text-color": "#e4e6e9", "text-halo-color": "#111", "text-halo-width": 1.4 } });
  }

  // Places: names from zoom 13; tap one to fly in.
  if (!map.getSource("places")) map.addSource("places", { type: "geojson", data: { type: "FeatureCollection",
    features: PLACES.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, kind: p.kind } })) } });
  if (hasGlyphs() && !map.getLayer("place-labels")) map.addLayer({ id: "place-labels", type: "symbol", source: "places", minzoom: 13,
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-offset": [0, 1.5], "text-anchor": "top", "text-padding": 4 },
    paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,.85)", "text-halo-width": 1.6 } });

  // Pins source (drawn as HTML markers; this invisible layer keeps the clustered source loaded).
  if (!map.getSource("pins")) map.addSource("pins", { type: "geojson", data: pinFeatures(), cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
  if (!map.getLayer("pins-hit")) map.addLayer({ id: "pins-hit", type: "circle", source: "pins", paint: { "circle-radius": 0, "circle-opacity": 0 } });

  applyBase();
  applyToggles();
  if (selBiome) map.setFeatureState({ source: "biomes", id: selBiome }, { sel: true });
}
function applyBase() {
  const style = map.getStyle();
  if (!style) return;
  const raster = base !== "plain";
  style.layers.forEach((l) => {
    if (["sat", "topo", "biome-fill", "biome-line", "greenline", "greenline-label", "place-labels", "pins-hit", "gyf-buildings"].includes(l.id)) return;
    if (l.id === "gyf-green" || l.id === "gyf-wood") { map.setLayoutProperty(l.id, "visibility", base === "plain" ? "visible" : "none"); return; }
    // Over satellite or terrain, keep only the vector map's labels.
    const keep = !raster || l.type === "symbol";
    map.setLayoutProperty(l.id, "visibility", keep ? "visible" : "none");
  });
  if (map.getLayer("sat")) map.setLayoutProperty("sat", "visibility", base === "satellite" ? "visible" : "none");
  if (map.getLayer("topo")) map.setLayoutProperty("topo", "visibility", base === "terrain" ? "visible" : "none");
  document.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.base === base)));
}
function applyToggles() {
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none"); };
  vis("biome-fill", show.regions); vis("biome-line", show.regions);
  vis("greenline", show.line); vis("greenline-label", show.line);
  vis("gyf-buildings", show.buildings);
  document.querySelectorAll("[data-toggle]").forEach((b) => b.setAttribute("aria-checked", String(!!show[b.dataset.toggle])));
}

let ready = false;
const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
const dataReady = Promise.all([getJSON("/data/biomes.geojson"), getJSON("/data/green-line.geojson")]).then(([b, l]) => {
  bio = b; line = l;
  programs.forEach((p) => p.sites.forEach((s) => {
    const hit = bio.features.find((f) => inGeometry(s.lng, s.lat, f.geometry));
    s.biome = hit ? hit.properties.id : null;
  }));
}).catch(() => {
  $("map-panel-content").insertAdjacentHTML("afterbegin", '<p class="map-error" role="alert">The region layer did not load. Pins and filters still work; reload the page to try again.</p>');
});
map.on("style.load", async () => {
  styleOk = true;
  await dataReady;
  await addLayers();
  if (!ready) { ready = true; renderPanel(); document.body.setAttribute("data-map-ready", bio ? "1" : "error"); }
});
// The map follows the site theme: dark buildings for Sunset and Sea, light for Daylight.
new MutationObserver(() => { map.setStyle(styleUrl(), { diff: false }); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- Region hover and click ----------
const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "biome-tip", offset: 14, maxWidth: "260px" });
map.on("mousemove", "biome-fill", (e) => {
  const f = e.features && e.features[0];
  if (!f) return;
  map.getCanvas().style.cursor = "pointer";
  if (hoverBiome !== f.id) {
    if (hoverBiome) map.setFeatureState({ source: "biomes", id: hoverBiome }, { hover: false });
    hoverBiome = f.id;
    map.setFeatureState({ source: "biomes", id: hoverBiome }, { hover: true });
  }
  if (canHover && map.getZoom() < 13) tip.setLngLat(e.lngLat).setText(f.properties.name).addTo(map); else tip.remove();
});
map.on("mouseleave", "biome-fill", () => {
  map.getCanvas().style.cursor = "";
  if (hoverBiome) map.setFeatureState({ source: "biomes", id: hoverBiome }, { hover: false });
  hoverBiome = null;
  tip.remove();
});
map.on("click", (e) => {
  if (map.getLayer("place-labels")) {
    const pl = map.queryRenderedFeatures(e.point, { layers: ["place-labels"] })[0];
    if (pl) return openPlace(pl.properties.id, { fly: true });
  }
  if (!map.getLayer("biome-fill") || !show.regions) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ["biome-fill"] })[0];
  if (f) openBiome(f.properties.id);
});
map.on("mousemove", "place-labels", () => { map.getCanvas().style.cursor = "pointer"; });

// ---------- Camera ----------
let orbiting = false, orbitFrame = 0;
function stopOrbit() {
  orbiting = false; cancelAnimationFrame(orbitFrame);
  document.querySelectorAll("[data-act='orbit']").forEach((b) => b.setAttribute("aria-pressed", "false"));
}
function startOrbit() {
  if (reduce) return;
  orbiting = true;
  document.querySelectorAll("[data-act='orbit']").forEach((b) => b.setAttribute("aria-pressed", "true"));
  if (map.getPitch() < 40) map.easeTo({ pitch: 60, duration: 600 });
  let last = performance.now();
  const step = (t) => {
    if (!orbiting) return;
    const dt = Math.min(64, t - last); last = t;
    map.setBearing(map.getBearing() + dt * 0.006); // one slow turn a minute
    orbitFrame = requestAnimationFrame(step);
  };
  orbitFrame = requestAnimationFrame(step);
}
["mousedown", "touchstart", "wheel"].forEach((ev) => map.getCanvasContainer().addEventListener(ev, stopOrbit, { passive: true }));
function flyIn(lng, lat, opts) {
  stopOrbit();
  const o = Object.assign({ zoom: 16.2, pitch: 60, bearing: map.getBearing() - 30 }, opts || {});
  map.flyTo({ center: [lng, lat], zoom: o.zoom, pitch: o.pitch, bearing: o.bearing, duration: reduce ? 0 : 2400, curve: 1.6, essential: false });
}
function wholeCountry() {
  stopOrbit();
  map.fitBounds(ISRAEL, { padding: 16, pitch: 0, bearing: 0, duration: reduce ? 0 : 1600 });
}

// ---------- Map toolbar: base layers, toggles, 2D/3D ----------
$("map-tools").innerHTML =
  '<div class="seg" role="group" aria-label="Base map">' +
  [["plain", "Map"], ["satellite", "Satellite"], ["terrain", "Terrain"]].map(([k, l]) => '<button type="button" data-base="' + k + '" aria-pressed="' + (k === base) + '">' + l + "</button>").join("") + "</div>" +
  '<details class="layer-menu"><summary>Layers</summary><div class="layer-pop">' +
  [["buildings", "3D buildings"], ["regions", "Regions"], ["line", "1949 Armistice Line"]].map(([k, l]) =>
    '<button type="button" role="switch" data-toggle="' + k + '" aria-checked="' + show[k] + '"><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span>' + l + "</button>").join("") +
  "</div></details>" +
  '<button type="button" class="tool-btn" data-act="tilt" aria-pressed="false">3D</button>' +
  '<button type="button" class="tool-btn" data-act="country">Whole country</button>';
$("map-tools").addEventListener("click", (e) => {
  const b = e.target.closest("[data-base]"), t = e.target.closest("[data-toggle]"), a = e.target.closest("[data-act]");
  if (b) { base = b.dataset.base; store.set("gyf:map-base3", base); applyBase(); }
  else if (t) { show[t.dataset.toggle] = !show[t.dataset.toggle]; applyToggles(); }
  else if (a && a.dataset.act === "tilt") { stopOrbit(); const flat = map.getPitch() > 20; map.easeTo({ pitch: flat ? 0 : 60, bearing: flat ? 0 : map.getBearing() - 20, zoom: flat ? map.getZoom() : Math.max(map.getZoom(), 15), duration: reduce ? 0 : 900 }); }
  else if (a && a.dataset.act === "country") wholeCountry();
});
map.on("pitchend", () => { const b = document.querySelector("[data-act='tilt']"); if (b) b.setAttribute("aria-pressed", String(map.getPitch() > 20)); });

// ---------- Presets ----------
$("map-presets").innerHTML = M.presets.map((p, i) =>
  '<button type="button" class="preset" data-preset="' + i + '" title="' + esc(p.sub || p.name) + '">' + esc(p.name) + "</button>").join("");
$("map-presets").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preset]");
  if (!b) return;
  const i = +b.dataset.preset, p = M.presets[i];
  $("map-presets").querySelectorAll(".preset").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  flyIn(p.center[1], p.center[0], { zoom: p.zoom, pitch: p.pitch, bearing: p.bearing });
  if (p.places.length === 1) openPlace(p.places[0], { fly: false });
  else openArea(i);
});
map.on("dragstart", () => $("map-presets").querySelectorAll(".preset").forEach((x) => x.removeAttribute("aria-pressed")));

// ---------- Filters UI ----------
function drawFilters() {
  const chips = Object.keys(TYPES).map((k) => {
    const t = TYPES[k], on = filt.types.has(k);
    return '<button type="button" class="tchip" data-type="' + k + '" aria-pressed="' + on + '" style="--c:' + t.color + '"><span class="tdot" aria-hidden="true">' + t.letter + "</span>" + esc(t.label) + "</button>";
  }).join("");
  $("map-filters").innerHTML =
    '<div class="mf-head"><h2 class="mf-title">Filter</h2>' +
    (filt.types.size < Object.keys(TYPES).length || filt.internships ? '<button type="button" class="mf-reset" data-act="reset">Show all</button>' : "") + "</div>" +
    '<div class="tchips" role="group" aria-label="Program type">' + chips + "</div>" +
    '<button type="button" class="mf-switch" role="switch" data-act="intern" aria-checked="' + filt.internships + '"><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span>Internships only<span class="mf-hint">business ones are marked</span></button>';
}
$("map-filters").addEventListener("click", (e) => {
  const t = e.target.closest("[data-type]"), a = e.target.closest("[data-act]");
  if (t) { const k = t.dataset.type; if (filt.types.has(k)) filt.types.delete(k); else filt.types.add(k); }
  else if (a && a.dataset.act === "intern") filt.internships = !filt.internships;
  else if (a && a.dataset.act === "reset") { filt.types = new Set(Object.keys(TYPES)); filt.internships = false; }
  else return;
  drawFilters();
  const src = map.getSource("pins");
  if (src) src.setData(pinFeatures());
  renderPanel();
});

// ---------- Panel ----------
const typeBadge = (p) => { const t = TYPES[p.type]; return '<span class="tbadge" style="--c:' + t.color + '"><span class="tdot" aria-hidden="true">' + t.letter + "</span>" + esc(t.label) + "</span>"; };
const internBadge = (p) => p.internship ? '<span class="mbadge ' + (p.internship.kind === "business" ? "biz" : "") + '">' + esc(p.internship.label) + "</span>" : "";
function progRow(p, sites) {
  const where = sites ? sites.map((s) => s.label).join(" · ") : p.panelLabel || (p.sites.length > 1 ? p.sites.length + " locations" : p.sites[0] ? p.sites[0].label : "");
  return '<li><button type="button" class="prog-row" data-prog="' + esc(p.key) + '"' + (sites && sites[0] ? ' data-site="' + sites[0].i + '"' : "") + '><span class="pr-dot" style="--c:' + TYPES[p.type].color + '" aria-hidden="true">' + TYPES[p.type].letter + "</span>" +
    '<span class="pr-main"><span class="pr-name">' + esc(p.name) + '</span><span class="pr-where">' + esc(where) + "</span></span>" +
    (p.internship ? '<span class="pr-flag ' + (p.internship.kind === "business" ? "biz" : "") + '">' + (p.internship.kind === "business" ? "Business" : "Internship") + "</span>" : "") + "</button></li>";
}
const placeChip = (pl) => '<button type="button" class="place-chip" data-place="' + pl.id + '"><span class="pc-kind">' + KIND[pl.kind] + "</span>" + esc(pl.name) + "</button>";
const camTools = () => '<div class="cam-tools">' + (reduce ? "" : '<button type="button" class="btn" data-act="orbit" aria-pressed="' + orbiting + '">Orbit</button>') +
  '<button type="button" class="btn" data-act="country">Whole country</button></div>';
const setSheetTitle = (t) => { $("sheet-title").textContent = t; };
const back = (label, act) => '<button type="button" class="mp-back" data-act="' + act + '">' + label + "</button>";
function sitesAtPlace(id) {
  return programs.filter(passes).map((p) => ({ p, sites: p.sites.filter((s) => s.place === id) })).filter((x) => x.sites.length);
}
function renderPanel() {
  const box = $("map-panel-content");
  const shown = programs.filter(passes);
  if (view.kind === "biome" && bio) {
    const f = bio.features.find((x) => x.properties.id === view.id);
    const here = shown.map((p) => ({ p, sites: p.sites.filter((s) => s.biome === view.id) })).filter((x) => x.sites.length);
    box.innerHTML = back("All programs", "home") +
      '<p class="mp-eyebrow">' + esc(f.properties.texture) + '</p><h2 class="mp-h">' + esc(f.properties.name) + "</h2>" +
      '<p class="mp-desc">' + esc(f.properties.description) + "</p>" +
      '<h3 class="mp-sub">' + (here.length ? here.length + (here.length === 1 ? " program" : " programs") + " based here" : "Programs based here") + "</h3>" +
      (here.length ? '<ul class="prog-list">' + here.map((x) => progRow(x.p, x.sites)).join("") + "</ul>"
        : '<p class="muted mp-empty">' + (shown.length < programs.length ? "None with the current filters." : "No programs on this map are based here yet.") + "</p>");
    setSheetTitle(f.properties.name);
    return;
  }
  if (view.kind === "place") {
    const pl = placeById[view.id], here = sitesAtPlace(pl.id);
    box.innerHTML = back(view.area != null ? "Back to " + esc(M.presets[view.area].name) : "All programs", view.area != null ? "area:" + view.area : "home") +
      '<p class="mp-eyebrow">' + KIND[pl.kind] + '</p><h2 class="mp-h">' + esc(pl.name) + "</h2>" +
      '<p class="muted mp-count">Drag to look around. Right-click and drag (or two fingers) to tilt and turn.</p>' + camTools() +
      '<h3 class="mp-sub">' + (here.length ? here.length + (here.length === 1 ? " program" : " programs") + " here" : "Programs here") + "</h3>" +
      (here.length ? '<ul class="prog-list">' + here.map((x) => progRow(x.p, x.sites)).join("") + "</ul>" : '<p class="muted mp-empty">No programs on this map are based here' + (shown.length < programs.length ? " with the current filters" : "") + ".</p>") +
      '<h3 class="mp-sub">See it on the ground</h3>' + outLinks(pl.lat, pl.lng);
    setSheetTitle(pl.name);
    return;
  }
  if (view.kind === "area") {
    const a = M.presets[view.i], pls = a.places.map((id) => placeById[id]);
    const here = pls.flatMap((pl) => sitesAtPlace(pl.id));
    box.innerHTML = back("All programs", "home") + '<p class="mp-eyebrow">Area</p><h2 class="mp-h">' + esc(a.name) + "</h2>" +
      '<h3 class="mp-sub">Fly in to</h3><div class="place-chips">' + pls.map(placeChip).join("") + "</div>" + camTools() +
      '<h3 class="mp-sub">' + here.length + (here.length === 1 ? " program" : " programs") + " in this area</h3>" +
      (here.length ? '<ul class="prog-list">' + here.map((x) => progRow(x.p, x.sites)).join("") + "</ul>" : '<p class="muted mp-empty">None with the current filters.</p>');
    setSheetTitle(a.name);
    return;
  }
  if (view.kind === "program") {
    const p = progByKey[view.key];
    const site = p.sites[view.site] || null;
    const others = p.sites.filter((s) => !site || s.i !== site.i);
    const backTo = view.from ? (view.from.kind === "biome" ? ["Back to region", "biome:" + view.from.id] : view.from.kind === "place" ? ["Back to " + esc(placeById[view.from.id].name), "place:" + view.from.id] : ["Back to " + esc(M.presets[view.from.i].name), "area:" + view.from.i]) : ["All programs", "home"];
    box.innerHTML = back(backTo[0], backTo[1]) +
      '<article class="pcard">' +
      '<h2 class="mp-h">' + esc(p.name) + "</h2>" +
      '<div class="pc-badges">' + typeBadge(p) + '<span class="mbadge approx">Approximate location</span>' + internBadge(p) + (p.tag ? '<span class="mbadge tag">' + esc(p.tag) + "</span>" : "") + "</div>" +
      '<dl class="pc-facts"><dt>Base</dt><dd>' + esc(p.base || "Not published") + "</dd>" +
      (site ? "<dt>This pin</dt><dd>" + esc(site.label) + "</dd>" : "") +
      (others.length ? "<dt>" + (site ? "Also at" : "Locations") + "</dt><dd>" + others.map((s) => '<button type="button" class="pc-site" data-site="' + s.i + '">' + esc(s.label) + "</button>").join("") + "</dd>" : "") +
      "</dl>" +
      (p.tracks.length ? '<h3 class="mp-sub">Key tracks</h3><ul class="pc-tracks">' + p.tracks.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" : "") +
      (p.note ? '<p class="pc-note">' + esc(p.note) + "</p>" : "") +
      (p.seedOnly ? '<p class="pc-note muted">Not in the main program list yet, so these details have not been checked against the program\'s own site.</p>' : "") +
      '<div class="pc-links">' +
      (p.website ? '<a class="btn primary" href="' + esc(p.website) + '" target="_blank" rel="noopener noreferrer">Program website</a>' : '<span class="muted">No website listed yet</span>') +
      (p.id && !p.seedOnly ? '<a class="btn" href="/#/program/' + encodeURIComponent(p.id) + '">Full details</a>' : "") + "</div>" +
      (site ? '<h3 class="mp-sub">See it on the ground</h3>' + camTools() + outLinks(site.lat, site.lng) : "") +
      "</article>";
    setSheetTitle(p.name);
    return;
  }
  const pinned = shown.filter((p) => p.sites.length), floating = shown.filter((p) => !p.sites.length);
  box.innerHTML = '<h2 class="mp-h">Programs on the map</h2>' +
    '<p class="muted mp-count">' + pinned.length + (pinned.length === 1 ? " program" : " programs") + " shown. Tap a pin, a region or a place to fly in.</p>" +
    (pinned.length ? '<ul class="prog-list">' + pinned.map((p) => progRow(p)).join("") + "</ul>" : '<p class="muted mp-empty">No programs match these filters.</p>') +
    (floating.length ? '<h3 class="mp-sub">No single base</h3><ul class="prog-list">' + floating.map((p) => progRow(p)).join("") + "</ul>" : "") +
    '<h3 class="mp-sub">Places</h3><div class="place-chips">' + PLACES.map(placeChip).join("") + "</div>" +
    (bio ? '<h3 class="mp-sub">Regions</h3><div class="place-chips">' + bio.features.map((f) => '<button type="button" class="place-chip" data-biome="' + f.properties.id + '">' + esc(f.properties.name) + "</button>").join("") + "</div>" : "");
  setSheetTitle("Programs on the map");
}
function setSel(id) {
  if (!map.getSource("biomes")) { selBiome = id; return; }
  if (selBiome) map.setFeatureState({ source: "biomes", id: selBiome }, { sel: false });
  selBiome = id;
  if (id) map.setFeatureState({ source: "biomes", id }, { sel: true });
}
function settle() { renderPanel(); showSheet(true); $("map-panel-body").scrollTop = 0; markActive(); }
function openBiome(id) { activeKey = null; setSel(id); view = { kind: "biome", id }; settle(); }
function openPlace(id, opts) {
  const pl = placeById[id];
  if (!pl) return;
  activeKey = null; setSel(null);
  const area = view.kind === "area" ? view.i : view.kind === "place" ? view.area : null;
  view = { kind: "place", id, area: area != null && M.presets[area].places.includes(id) ? area : null };
  if (opts && opts.fly) flyIn(pl.lng, pl.lat, { zoom: pl.kind === "kibbutz" ? 16.4 : 16 });
  settle();
}
function openArea(i) { activeKey = null; setSel(null); view = { kind: "area", i }; settle(); }
function openProgram(key, siteIdx, opts) {
  const p = progByKey[key];
  if (!p) return;
  const from = ["biome", "place", "area"].includes(view.kind) ? (view.kind === "biome" ? { kind: "biome", id: view.id } : view.kind === "place" ? { kind: "place", id: view.id } : { kind: "area", i: view.i }) : view.kind === "program" ? view.from : null;
  setSel(null);
  const si = siteIdx == null ? (p.sites.length === 1 ? 0 : -1) : siteIdx;
  view = { kind: "program", key, site: si, from };
  activeKey = si >= 0 ? key + "#" + si : null;
  if (opts && opts.fly && p.sites.length) {
    if (si >= 0) flyIn(p.sites[si].lng, p.sites[si].lat, { zoom: 16, pitch: 58 });
    else { stopOrbit(); const b = new maplibregl.LngLatBounds(); p.sites.forEach((s) => b.extend([s.lng, s.lat])); map.fitBounds(b, { padding: 80, maxZoom: 13, pitch: 0, bearing: 0, duration: reduce ? 0 : 1400 }); }
  }
  settle();
}
$("map-panel-content").addEventListener("click", (e) => {
  const row = e.target.closest("[data-prog]"), act = e.target.closest("[data-act]"), site = e.target.closest(".pc-site"),
    place = e.target.closest("[data-place]"), biome = e.target.closest("[data-biome]");
  if (row) openProgram(row.dataset.prog, row.dataset.site != null ? +row.dataset.site : null, { fly: true });
  else if (site) openProgram(view.key, +site.dataset.site, { fly: true });
  else if (place) openPlace(place.dataset.place, { fly: true });
  else if (biome) openBiome(biome.dataset.biome);
  else if (act) {
    const a = act.dataset.act;
    if (a === "orbit") { if (orbiting) stopOrbit(); else startOrbit(); }
    else if (a === "country") wholeCountry();
    else if (a.indexOf("biome:") === 0) openBiome(a.slice(6));
    else if (a.indexOf("place:") === 0) openPlace(a.slice(6), { fly: true });
    else if (a.indexOf("area:") === 0) openArea(+a.slice(5));
    else { activeKey = null; setSel(null); view = { kind: "home" }; renderPanel(); markActive(); }
  }
});

// ---------- Bottom sheet (phones) ----------
function showSheet(open) {
  if (!isPhone()) return;
  document.body.classList.toggle("sheet-open", open);
  $("sheet-handle").setAttribute("aria-expanded", String(open));
}
$("sheet-handle").addEventListener("click", () => showSheet(!document.body.classList.contains("sheet-open")));

// ---------- Phone menu (same behavior as the main app) ----------
const topbar = document.querySelector(".topbar"), navBtn = document.querySelector(".nav-toggle");
const setNav = (open) => { topbar.classList.toggle("nav-open", open); navBtn.setAttribute("aria-expanded", String(open)); };
navBtn.addEventListener("click", () => setNav(!topbar.classList.contains("nav-open")));
document.addEventListener("click", (e) => {
  if (!e.target.closest(".topbar")) setNav(false);
  const menu = document.querySelector(".layer-menu");
  if (menu && menu.open && !e.target.closest(".layer-menu")) menu.open = false;
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setNav(false); showSheet(false); stopOrbit(); } });

// MapLibre needs to know when its box changes size (menu opening, rotation, sheet).
if (window.ResizeObserver) new ResizeObserver(() => map.resize()).observe($("map"));

drawFilters();
renderPanel();
if (!GL) {
  $("map-tools").hidden = true;
  $("map").insertAdjacentHTML("beforeend", '<div class="map-nogl" role="note"><h2>This browser can\'t draw the 3D map</h2><p>It needs WebGL2, which is turned off or missing here. You can still browse every program, region and place in the panel, and open Street View or Google Earth from each one.</p></div>');
  dataReady.then(() => { renderPanel(); document.body.setAttribute("data-map-ready", "nogl"); });
}
// For tests and debugging.
window.GYF_MAP_VIEW = { map, programs, places: PLACES, presets: M.presets, filters: filt, errors, openBiome, openPlace, openProgram, get view() { return view; }, get biomes() { return bio ? bio.features : []; }, pins: () => Object.keys(onScreen) };
