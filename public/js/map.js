/*
 * Program map (/map). Leaflet + markercluster, no API keys.
 * Data: GYF_DATA (js/data.js) for program details, GYF_MAP (js/map-data.js) for places,
 * data/biomes.geojson for regions, data/green-line.geojson for the 1949 Armistice Line.
 */
(function () {
  "use strict";
  const D = window.GYF_DATA, M = window.GYF_MAP;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* this visit only */ } },
  };
  const isPhone = () => window.matchMedia("(max-width: 600px)").matches;
  const canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);

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
      key: m.id || m.key,
      id: m.id,
      name: (p && p.name) || m.name,
      type: m.mapType,
      base: m.panelLabel || (p && p.base) || m.base || "",
      website: (p && p.website) || m.website || null,
      tracks: tracks.slice(0, 5),
      internship: internshipOf(fields),
      sites: (m.sites || []).map((s, i) => Object.assign({ i }, s)),
      note: m.note || null,
      tag: m.tag || null,
      seedOnly: !!m.seedOnly || (m.id && !p),
      panelLabel: m.panelLabel || null,
    };
  });
  const progByKey = {};
  programs.forEach((p) => { progByKey[p.key] = p; });

  // ---------- Filters ----------
  const TYPES = M.types;
  const filt = { types: new Set(Object.keys(TYPES)), internships: false };
  const passes = (p) => filt.types.has(p.type) && (!filt.internships || !!p.internship);

  // ---------- Map and base layers ----------
  const ISRAEL = L.latLngBounds([29.45, 34.2], [33.4, 35.95]);
  const map = L.map("map", { minZoom: 7, maxZoom: 19, maxBounds: ISRAEL.pad(0.35), maxBoundsViscosity: 0.8, zoomSnap: 0.5, worldCopyJump: false });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  map.fitBounds(ISRAEL, { padding: [10, 10] });

  // Plain: Esri's gray canvas, dark for Sunset and Sea, light for Daylight. Same keyless server as the satellite layer.
  const plainUrl = () => "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/" + (document.documentElement.getAttribute("data-theme") === "daylight" ? "World_Light_Gray_Base" : "World_Dark_Gray_Base") + "/MapServer/tile/{z}/{y}/{x}";
  const bases = {
    Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    }),
    Terrain: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      subdomains: "abc", maxNativeZoom: 17, maxZoom: 19,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    }),
    Plain: L.tileLayer(plainUrl(), {
      maxNativeZoom: 16, maxZoom: 19,
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    }),
  };
  const startBase = bases[store.get("gyf:map-base")] ? store.get("gyf:map-base") : "Plain";
  bases[startBase].addTo(map);
  map.on("baselayerchange", (e) => store.set("gyf:map-base", e.name));
  // The plain map follows the site theme (dark tiles for Sunset and Sea, light for Daylight).
  new MutationObserver(() => bases.Plain.setUrl(plainUrl())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- Biome patterns ----------
  const PATTERNS = {
    basalt: '<pattern id="pat-basalt" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#4a423a"/><circle cx="2" cy="3" r="1.1" fill="#120f0c"/><circle cx="7" cy="1.5" r=".8" fill="#120f0c"/><circle cx="5" cy="7" r="1.2" fill="#120f0c"/><circle cx="9" cy="8.5" r=".7" fill="#120f0c"/></pattern>',
    forest: '<pattern id="pat-forest" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#2f6b3a"/><circle cx="3.5" cy="3.5" r="2.4" fill="#123d1d"/><circle cx="10.5" cy="10.5" r="2.4" fill="#123d1d"/></pattern>',
    fields: '<pattern id="pat-fields" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#9aa63e"/><rect y="0" width="12" height="4" fill="#d1c86e"/><rect y="7" width="12" height="2" fill="#5f6d22"/></pattern>',
    sand: '<pattern id="pat-sand" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e2cc92"/><circle cx="2" cy="2" r="1" fill="#fff6dc"/><circle cx="6" cy="6" r="1" fill="#fff6dc"/></pattern>',
    hatch: '<pattern id="pat-hatch" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#6f8f6a"/><path d="M0 10 L10 0 M-2 2 L2 -2 M8 12 L12 8" stroke="#2f4a2c" stroke-width="1.6"/></pattern>',
    contours: '<pattern id="pat-contours" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#b59a6e"/><path d="M0 3 Q6 0 12 3 T24 3 M0 9 Q6 6 12 9 T24 9" stroke="#5e4629" stroke-width="1.2" fill="none"/></pattern>',
    crosshatch: '<pattern id="pat-crosshatch" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#d4bd9c"/><path d="M0 0 L10 10 M10 0 L0 10" stroke="#7d6446" stroke-width="1"/></pattern>',
    sparse: '<pattern id="pat-sparse" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#d8b47e"/><circle cx="4" cy="5" r="1.3" fill="#7a5a2e"/><circle cx="13" cy="14" r="1.3" fill="#7a5a2e"/></pattern>',
    rings: '<pattern id="pat-rings" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#b98a5c"/><circle cx="8" cy="8" r="4.5" stroke="#5e3a1f" stroke-width="1.3" fill="none"/></pattern>',
    dunes: '<pattern id="pat-dunes" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#e8bf7a"/><path d="M0 5 Q5 1 10 5 T20 5" stroke="#9a6a2c" stroke-width="1.4" fill="none"/></pattern>',
  };
  const regionRenderer = L.svg({ padding: 0.5 });
  function ensurePatterns() {
    const svg = regionRenderer._container;
    if (!svg || svg.querySelector("#pat-basalt")) return;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = Object.keys(PATTERNS).map((k) => PATTERNS[k]).join("");
    svg.insertBefore(defs, svg.firstChild);
  }

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
  let biomes = [];            // GeoJSON features
  const biomeLayers = {};     // id -> Leaflet path
  let view = { kind: "home" }; // home | biome | program
  let activeMarker = null;

  // ---------- Pins ----------
  const markers = []; // { marker, prog, site }
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 42, spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => L.divIcon({ html: "<span>" + c.getChildCount() + "</span>", className: "pin-cluster", iconSize: [38, 38] }),
  });
  programs.forEach((p) => p.sites.forEach((s) => {
    const t = TYPES[p.type];
    const marker = L.marker([s.lat, s.lng], {
      title: p.name + ", " + s.label, alt: p.name, riseOnHover: true,
      icon: L.divIcon({ className: "pin-wrap", html: '<span class="pin" style="--c:' + t.color + '"><b>' + t.letter + "</b></span>", iconSize: [30, 30], iconAnchor: [15, 15] }),
    });
    marker.on("click", () => openProgram(p.key, s.i, { fly: false }));
    markers.push({ marker, prog: p, site: s });
  }));
  cluster.addTo(map);
  function drawPins() {
    cluster.clearLayers();
    cluster.addLayers(markers.filter((m) => passes(m.prog)).map((m) => m.marker));
    markActive();
  }
  function markActive() {
    markers.forEach((m) => { const el = m.marker.getElement(); if (el) el.classList.toggle("is-active", m === activeMarker); });
  }

  // ---------- Place labels (zoom 13+) ----------
  const labelLayer = L.layerGroup(M.labels.map((l) => L.marker([l.lat, l.lng], {
    interactive: false, keyboard: false,
    icon: L.divIcon({ className: "place-label " + l.kind, html: "<span>" + esc(l.name) + "</span>", iconSize: null }),
  })));
  const syncLabels = () => { if (map.getZoom() >= 13) labelLayer.addTo(map); else labelLayer.remove(); };
  map.on("zoomend", syncLabels);
  syncLabels();

  // ---------- Overlays: biomes and the Green Line ----------
  const biomeGroup = L.featureGroup();
  const greenGroup = L.layerGroup();
  // Textures at 35% over the country; lighter once you are down at street level, so streets and names stay readable.
  const restFill = () => (map.getZoom() >= 12 ? 0.16 : 0.35);
  const baseStyle = (f) => ({ fillColor: "url(#pat-" + f.properties.pattern + ")", fillOpacity: restFill(), color: "#f6efe4", opacity: 0.35, weight: 1 });
  map.on("zoomend", () => Object.keys(biomeLayers).forEach(styleBiome));
  function styleBiome(id) {
    const l = biomeLayers[id];
    if (!l) return;
    const on = view.kind === "biome" && view.id === id;
    l.setStyle(on ? { fillOpacity: 0.62, color: "#f2b544", opacity: 1, weight: 2.5 } : { fillOpacity: restFill(), color: "#f6efe4", opacity: 0.35, weight: 1 });
  }
  const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
  Promise.all([getJSON("/data/biomes.geojson"), getJSON("/data/green-line.geojson")]).then(([bio, line]) => {
    biomes = bio.features;
    programs.forEach((p) => p.sites.forEach((s) => {
      const hit = biomes.find((f) => inGeometry(s.lng, s.lat, f.geometry));
      s.biome = hit ? hit.properties.id : null;
    }));
    L.geoJSON(bio, {
      renderer: regionRenderer,
      style: baseStyle,
      onEachFeature: (f, layer) => {
        biomeLayers[f.properties.id] = layer;
        // Name on hover with a mouse; on touch the panel shows it, so tooltips can't pile up.
        if (canHover) layer.bindTooltip(esc(f.properties.name), { sticky: true, direction: "top", className: "biome-tip", opacity: 1 });
        layer.on({
          mouseover: () => { if (!(view.kind === "biome" && view.id === f.properties.id)) layer.setStyle({ fillOpacity: 0.6, opacity: 0.9, weight: 2 }); },
          mouseout: () => styleBiome(f.properties.id),
          click: () => { Object.keys(biomeLayers).forEach((k) => { if (biomeLayers[k] !== layer) biomeLayers[k].closeTooltip(); }); openBiome(f.properties.id); },
        });
      },
    }).addTo(biomeGroup);
    biomeGroup.addTo(map);
    ensurePatterns();
    L.geoJSON(line, { renderer: regionRenderer, interactive: false, style: { color: "#a3a7ad", weight: 1.6, opacity: 0.95, dashArray: "5 6" } }).addTo(greenGroup);
    L.marker([32.235, 34.985], { interactive: false, keyboard: false, icon: L.divIcon({ className: "gl-label", html: "<span>1949 Armistice Line</span>", iconSize: null }) }).addTo(greenGroup);
    greenGroup.addTo(map);
    map.on("overlayadd", ensurePatterns);
    render();
    document.body.setAttribute("data-map-ready", "1");
  }).catch(() => {
    $("map-panel-content").insertAdjacentHTML("afterbegin", '<p class="map-error" role="alert">The region layer did not load. Pins and filters still work; reload the page to try again.</p>');
    document.body.setAttribute("data-map-ready", "error");
  });

  L.control.layers(bases, { "Biomes": biomeGroup, "1949 Armistice Line": greenGroup }, { collapsed: true, position: "topright" }).addTo(map);

  // ---------- Presets ----------
  $("map-presets").innerHTML = M.presets.map((p, i) =>
    '<button type="button" class="preset" data-preset="' + i + '" title="' + esc(p.sub || p.name) + '">' + esc(p.name) + "</button>").join("");
  $("map-presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    const p = M.presets[+b.dataset.preset];
    $("map-presets").querySelectorAll(".preset").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (reduce) map.setView(p.center, p.zoom); else map.flyTo(p.center, p.zoom, { duration: 1.1 });
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
    if (t) {
      const k = t.dataset.type;
      if (filt.types.has(k)) filt.types.delete(k); else filt.types.add(k);
    } else if (a && a.dataset.act === "intern") filt.internships = !filt.internships;
    else if (a && a.dataset.act === "reset") { filt.types = new Set(Object.keys(TYPES)); filt.internships = false; }
    else return;
    drawFilters(); drawPins(); renderPanel();
  });

  // ---------- Panel ----------
  const typeBadge = (p) => { const t = TYPES[p.type]; return '<span class="tbadge" style="--c:' + t.color + '"><span class="tdot" aria-hidden="true">' + t.letter + "</span>" + esc(t.label) + "</span>"; };
  const internBadge = (p) => p.internship ? '<span class="mbadge ' + (p.internship.kind === "business" ? "biz" : "") + '">' + esc(p.internship.label) + "</span>" : "";
  function progRow(p, sites) {
    const where = sites ? sites.map((s) => s.label).join(" · ") : p.panelLabel || (p.sites.length > 1 ? p.sites.length + " locations" : p.sites[0] ? p.sites[0].label : "");
    return '<li><button type="button" class="prog-row" data-prog="' + esc(p.key) + '"><span class="pr-dot" style="--c:' + TYPES[p.type].color + '" aria-hidden="true">' + TYPES[p.type].letter + "</span>" +
      '<span class="pr-main"><span class="pr-name">' + esc(p.name) + '</span><span class="pr-where">' + esc(where) + "</span></span>" +
      (p.internship ? '<span class="pr-flag ' + (p.internship.kind === "business" ? "biz" : "") + '">' + (p.internship.kind === "business" ? "Business" : "Internship") + "</span>" : "") + "</button></li>";
  }
  function setSheetTitle(t) { $("sheet-title").textContent = t; }
  function renderPanel() {
    const box = $("map-panel-content");
    const shown = programs.filter(passes);
    if (view.kind === "biome") {
      const f = biomes.find((x) => x.properties.id === view.id);
      if (!f) { view = { kind: "home" }; return renderPanel(); }
      const here = shown.map((p) => ({ p, sites: p.sites.filter((s) => s.biome === view.id) })).filter((x) => x.sites.length);
      box.innerHTML = '<button type="button" class="mp-back" data-act="home">All programs</button>' +
        '<p class="mp-eyebrow">' + esc(f.properties.texture) + "</p><h2 class=\"mp-h\">" + esc(f.properties.name) + "</h2>" +
        '<p class="mp-desc">' + esc(f.properties.description) + "</p>" +
        '<h3 class="mp-sub">' + (here.length ? here.length + (here.length === 1 ? " program" : " programs") + " based here" : "Programs based here") + "</h3>" +
        (here.length ? '<ul class="prog-list">' + here.map((x) => progRow(x.p, x.sites)).join("") + "</ul>"
          : '<p class="muted mp-empty">' + (shown.length < programs.length ? "None with the current filters." : "No programs on this map are based here yet.") + "</p>");
      setSheetTitle(f.properties.name);
      return;
    }
    if (view.kind === "program") {
      const p = progByKey[view.key];
      const site = p.sites[view.site] || null;
      const others = p.sites.filter((s) => !site || s.i !== site.i);
      box.innerHTML = '<button type="button" class="mp-back" data-act="' + (view.from ? "biome:" + view.from : "home") + '">' + (view.from ? "Back to region" : "All programs") + "</button>" +
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
        (p.id && !p.seedOnly ? '<a class="btn" href="/#/program/' + encodeURIComponent(p.id) + '">Full details</a>' : "") +
        "</div></article>";
      setSheetTitle(p.name);
      return;
    }
    const pinned = shown.filter((p) => p.sites.length), floating = shown.filter((p) => !p.sites.length);
    box.innerHTML = '<h2 class="mp-h">Programs on the map</h2>' +
      '<p class="muted mp-count">' + pinned.length + (pinned.length === 1 ? " program" : " programs") + " shown. Tap a region or a pin for details.</p>" +
      (pinned.length ? '<ul class="prog-list">' + pinned.map((p) => progRow(p)).join("") + "</ul>" : '<p class="muted mp-empty">No programs match these filters.</p>') +
      (floating.length ? '<h3 class="mp-sub">No single base</h3><ul class="prog-list">' + floating.map((p) => progRow(p)).join("") + "</ul>" : "");
    setSheetTitle("Programs on the map");
  }
  function render() { drawFilters(); drawPins(); renderPanel(); }

  function openBiome(id) {
    activeMarker = null; markActive();
    const prev = view.kind === "biome" ? view.id : null;
    view = { kind: "biome", id };
    if (prev) styleBiome(prev);
    styleBiome(id);
    renderPanel(); showSheet(true); $("map-panel-content").scrollTop = 0;
  }
  function openProgram(key, siteIdx, opts) {
    const p = progByKey[key];
    if (!p) return;
    const from = view.kind === "biome" ? view.id : view.kind === "program" ? view.from : null;
    const prevBiome = view.kind === "biome" ? view.id : null;
    view = { kind: "program", key, site: siteIdx == null ? (p.sites.length === 1 ? 0 : -1) : siteIdx, from };
    if (prevBiome) styleBiome(prevBiome);
    const target = view.site >= 0 ? markers.find((m) => m.prog === p && m.site.i === view.site) : null;
    activeMarker = target || null;
    renderPanel(); showSheet(true); $("map-panel-content").scrollTop = 0;
    if (opts && opts.fly && p.sites.length) {
      if (target) cluster.zoomToShowLayer(target.marker, () => { if (map.getZoom() < 13) map.setView(target.marker.getLatLng(), 13, { animate: !reduce }); markActive(); });
      else map.flyToBounds(L.latLngBounds(p.sites.map((s) => [s.lat, s.lng])), { padding: [60, 60], maxZoom: 13, duration: reduce ? 0 : 1 });
    }
    markActive();
  }
  $("map-panel-content").addEventListener("click", (e) => {
    const row = e.target.closest("[data-prog]"), act = e.target.closest("[data-act]"), site = e.target.closest("[data-site]");
    if (row) {
      const p = progByKey[row.dataset.prog];
      const inBiome = view.kind === "biome" ? p.sites.find((s) => s.biome === view.id) : null;
      openProgram(p.key, inBiome ? inBiome.i : null, { fly: true });
    } else if (site) openProgram(view.key, +site.dataset.site, { fly: true });
    else if (act) {
      const a = act.dataset.act;
      if (a.indexOf("biome:") === 0) openBiome(a.slice(6));
      else { const prev = view.kind === "biome" ? view.id : null; view = { kind: "home" }; activeMarker = null; if (prev) styleBiome(prev); renderPanel(); markActive(); }
    }
  });
  map.on("zoomend moveend", markActive);
  cluster.on("animationend spiderfied", markActive);

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
  document.addEventListener("click", (e) => { if (!e.target.closest(".topbar")) setNav(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setNav(false); showSheet(false); } });

  // Leaflet needs to know when its box changes size (menu opening, rotation, sheet).
  if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($("map"));

  render();
  // For tests and debugging.
  window.GYF_MAP_VIEW = { map, programs, markers, openBiome, openProgram, presets: M.presets, filters: filt, get biomes() { return biomes; } };
})();
