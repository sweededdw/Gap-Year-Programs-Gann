// Color themes: Sunset (warm dark, the default), Daylight (warm light) and Sea (cool dark).
// Runs in <head> so the page paints in the right theme. The choice is remembered in this browser.
(function () {
  var THEMES = { sunset: "Sunset", daylight: "Daylight", sea: "Sea" };
  var KEY = "gyf:theme";
  var BAR = { sunset: "#15110d", daylight: "#fbf5ea", sea: "#0f1217" }; // browser toolbar color on phones
  var root = document.documentElement;
  function saved() {
    try { var t = localStorage.getItem(KEY); if (THEMES[t]) return t; } catch (e) { /* storage blocked */ }
    try { if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "daylight"; } catch (e) { /* ignore */ }
    return "sunset";
  }
  // The palm in the logo is white for dark themes; Daylight uses the version drawn for light backgrounds.
  function marks(t) {
    var imgs = document.querySelectorAll("img.logo-mark, img.about-mark");
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute("src") || "";
      var want = t === "daylight" ? src.replace("logo-mark.svg", "logo-mark-light.svg") : src.replace("logo-mark-light.svg", "logo-mark.svg");
      if (want !== src) imgs[i].setAttribute("src", want);
    }
  }
  function paintPicker(t) {
    var opts = document.querySelectorAll("[data-theme-pick]");
    for (var i = 0; i < opts.length; i++) opts[i].setAttribute("aria-checked", String(opts[i].getAttribute("data-theme-pick") === t));
  }
  function apply(t) {
    if (!THEMES[t]) t = "sunset";
    root.setAttribute("data-theme", t);
    var bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute("content", BAR[t]);
    marks(t);
    paintPicker(t);
  }
  function set(t) {
    try { localStorage.setItem(KEY, t); } catch (e) { /* still applies for this visit */ }
    apply(t);
  }
  apply(saved());
  document.addEventListener("DOMContentLoaded", function () {
    apply(root.getAttribute("data-theme"));
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-theme-pick]");
      if (!b) return;
      e.preventDefault();
      set(b.getAttribute("data-theme-pick"));
      var menu = b.closest("details");
      if (menu) menu.open = false;
    });
    // New logo images (the homepage renders after load) pick up the right version too.
    new MutationObserver(function () { marks(root.getAttribute("data-theme")); }).observe(document.body, { childList: true, subtree: true });
  });
  window.GYF_THEME = { themes: THEMES, get: function () { return root.getAttribute("data-theme"); }, set: set };
})();
