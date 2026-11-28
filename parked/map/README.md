# Parked: the 3D program map

Taken off the site on 2026-11-27; the code is kept here so it can come back.
Home's second sub-tab is now Contact (public/js/contact.js) instead of Map.
The last commit with the map live is fb5ec39 (map) / 4e04d47 (latest before parking).

The folders mirror where each file lived, so to restore:

1. Move `parked/map/public/*` back into `public/` and `parked/map/tests/e2e/map.mjs` into `tests/e2e/`.
2. Add the Map link back to Home's sub-tabs: `homeTabs()` in public/js/app.js, the `#nav-sub-home`
   links in public/index.html, `markSub()` in public/js/topbar.js, and the quick-search list in public/js/motion.js.
3. Remove the `/map` redirect in vercel.json.

vercel.json still allows the map tile hosts (OpenFreeMap, Esri, OpenTopoMap) in `connect-src`,
and tests/run.mjs still turns on WebGL for a suite named `map`, so neither needs to change.
