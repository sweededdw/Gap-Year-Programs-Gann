/*
 * The top bar, shared by every page that has one (index.html and map.html).
 * Modeled on thenextgeninnovators.org's header: the bar slides in, the links sit in one pill,
 * a glowing highlight follows the link under the pointer (and rests on the current page),
 * and a link with sub-pages (Home: Overview, Map) swaps the pill's contents for them, with Back.
 * On phones the Menu button opens the bar full screen, and Home expands in place.
 * Motion follows the site's rule: 300ms or less, no overshoot, none at all with reduced motion.
 */
(function () {
  "use strict";
  const bar = document.querySelector(".topbar"), nav = document.querySelector(".topnav"), btn = document.querySelector(".nav-toggle");
  if (!bar || !nav) return;
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const wide = () => window.matchMedia("(min-width: 861px)").matches;
  const EASE = "cubic-bezier(.2, .8, .2, 1)";

  // ---------- 1. The bar slides in once, on the first load ----------
  if (!reduce) {
    bar.classList.add("tb-enter");
    bar.addEventListener("animationend", () => bar.classList.remove("tb-enter"), { once: true });
  }

  // ---------- 2. One highlight: rests on the current page, glows under the pointer ----------
  const pill = document.createElement("span");
  pill.className = "nav-pill";
  pill.setAttribute("aria-hidden", "true");
  nav.prepend(pill);
  let hoverEl = null;
  const inGroup = () => nav.classList.contains("in-group");
  function restingOn() {
    if (inGroup()) return nav.querySelector(".nav-sub.open a[aria-current='page']");
    return nav.querySelector(":scope > a.active");
  }
  function place(animate) {
    const t = hoverEl && hoverEl.offsetParent ? hoverEl : restingOn();
    // The hovered link is marked with a data attribute, not a class: the observer below watches classes.
    nav.querySelectorAll("[data-hover]").forEach((x) => { if (x !== hoverEl) x.removeAttribute("data-hover"); });
    if (!wide() || !t || !t.offsetParent) {
      pill.style.opacity = "0";
      nav.classList.remove("has-pill");
      return;
    }
    const wasHidden = pill.style.opacity !== "1";
    if (!animate || wasHidden || reduce) pill.classList.add("no-anim");
    const r = t.getBoundingClientRect(), n = nav.getBoundingClientRect();
    pill.style.width = r.width + "px";
    pill.style.height = r.height + "px";
    pill.style.transform = "translate(" + (r.left - n.left - nav.clientLeft) + "px," + (r.top - n.top - nav.clientTop) + "px)";
    pill.classList.toggle("glow", t === hoverEl);
    if (hoverEl && !hoverEl.hasAttribute("data-hover")) hoverEl.setAttribute("data-hover", "");
    pill.style.opacity = "1";
    nav.classList.add("has-pill");
    if (pill.classList.contains("no-anim")) { void pill.offsetWidth; pill.classList.remove("no-anim"); }
  }
  const items = "a, .nav-back";
  nav.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch" || !wide()) return;
    const a = e.target.closest(items);
    if (a && nav.contains(a) && a !== hoverEl) { hoverEl = a; place(true); }
  });
  nav.addEventListener("pointerleave", () => { if (hoverEl) { hoverEl.removeAttribute("data-hover"); hoverEl = null; place(true); } });
  nav.addEventListener("focusin", (e) => {
    const a = e.target.closest(items);
    if (a && wide() && a.matches(":focus-visible")) { hoverEl = a; place(true); }
  });
  nav.addEventListener("focusout", () => { if (hoverEl) { hoverEl.removeAttribute("data-hover"); hoverEl = null; place(true); } });
  // app.js marks the current page after each route; follow it. Only react to the links themselves,
  // never to the highlight's own changes (that would loop).
  new MutationObserver((recs) => {
    const relevant = recs.some((r) => (r.type === "attributes" ? r.target.tagName === "A" && r.attributeName === "class"
      : [...r.addedNodes, ...r.removedNodes].some((x) => x.tagName === "A")));
    if (relevant) place(true);
  }).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
  window.addEventListener("resize", () => place(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(false));

  // ---------- 3. Sub-pages: Home -> Overview, Map ----------
  // Which sub-page is current: the map page, or the homepage.
  function markSub() {
    const onMap = /^\/map(\.html)?$/.test(location.pathname);
    const onHome = !onMap && (location.hash === "" || location.hash === "#" || location.hash === "#/");
    nav.querySelectorAll(".nav-sub a[data-sub]").forEach((a) => {
      const cur = (a.dataset.sub === "map" && onMap) || (a.dataset.sub === "overview" && onHome);
      if (cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  // The pill changes width when its contents swap; ease it from the old width to the new.
  function swap(change) {
    const before = nav.offsetWidth;
    change();
    const after = nav.offsetWidth;
    if (!reduce && wide() && Math.abs(before - after) > 1 && nav.animate) {
      // Measure the highlight again once the pill has its final width.
      nav.animate([{ width: before + "px" }, { width: after + "px" }], { duration: 260, easing: EASE }).onfinish = () => place(false);
    }
    hoverEl = null;
    place(false);
  }
  function openGroup(trigger, focusFirst) {
    const sub = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!sub) return;
    if (wide()) {
      swap(() => { nav.classList.add("in-group"); nav.classList.remove("from-group"); sub.classList.add("open"); });
      if (focusFirst) { const f = sub.querySelector(".nav-back"); if (f) f.focus(); }
    } else {
      sub.classList.toggle("open");
    }
    trigger.setAttribute("aria-expanded", String(sub.classList.contains("open")));
  }
  function closeGroup(focusTrigger) {
    const sub = nav.querySelector(".nav-sub.open");
    if (!sub) return;
    const trigger = nav.querySelector('[aria-controls="' + sub.id + '"]');
    if (wide()) swap(() => { nav.classList.remove("in-group"); nav.classList.add("from-group"); sub.classList.remove("open"); });
    else sub.classList.remove("open");
    if (trigger) { trigger.setAttribute("aria-expanded", "false"); if (focusTrigger) trigger.focus(); }
  }
  nav.addEventListener("click", (e) => {
    const g = e.target.closest("[data-group]");
    if (g) { e.preventDefault(); openGroup(g, e.detail === 0); return; }
    if (e.target.closest(".nav-back")) { closeGroup(e.detail === 0); return; }
    if (e.target.closest("a")) setMenu(false);
  });

  // ---------- 4. Phones: the Menu button opens the bar full screen ----------
  function setMenu(open) {
    if (!btn) return;
    bar.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("menu-lock", open && !wide());
    if (!open) { const sub = nav.querySelector(".nav-sub.open"); if (sub && !wide()) { sub.classList.remove("open"); const t = nav.querySelector('[aria-controls="' + sub.id + '"]'); if (t) t.setAttribute("aria-expanded", "false"); } }
  }
  if (btn) btn.addEventListener("click", () => setMenu(!bar.classList.contains("nav-open")));
  document.addEventListener("click", (e) => { if (!e.target.closest(".topbar")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (inGroup()) closeGroup(true);
    setMenu(false);
  });
  window.addEventListener("hashchange", () => { setMenu(false); if (inGroup()) closeGroup(false); markSub(); });
  // Crossing the phone/desktop line resets the menu so neither layout is left half-open.
  window.matchMedia("(min-width: 861px)").addEventListener("change", () => {
    setMenu(false);
    nav.classList.remove("in-group", "from-group");
    nav.querySelectorAll(".nav-sub.open").forEach((s) => s.classList.remove("open"));
    nav.querySelectorAll("[data-group]").forEach((g) => g.setAttribute("aria-expanded", "false"));
    place(false);
  });

  // ---------- 5. Keep --bar-h equal to the bar's real height (pinned bars below it line up) ----------
  const syncH = () => { if (!bar.classList.contains("nav-open")) document.documentElement.style.setProperty("--bar-h", Math.round(bar.getBoundingClientRect().height) + "px"); };
  if (window.ResizeObserver) new ResizeObserver(syncH).observe(bar);
  syncH();

  markSub();
  place(false);
})();
