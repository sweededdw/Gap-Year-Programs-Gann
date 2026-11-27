// Login page scenery: six photos of Israel that crossfade every few seconds while each drifts slowly
// (the drift is CSS). The dots along the bottom show progress and jump to a scene. With reduced motion
// the first photo stays put and the dots still work. Photos load one by one after the first.
(function () {
  "use strict";
  const slides = Array.prototype.slice.call(document.querySelectorAll(".scene-slide"));
  const dots = document.querySelector(".scene-dots");
  const place = document.getElementById("scene-place");
  const credit = document.getElementById("scene-credit");
  if (!slides.length || !dots) return;

  const HOLD = 6500; // ms each scene stays
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let at = 0, timer = null;

  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "scene-dot";
    b.setAttribute("aria-label", s.dataset.place);
    b.innerHTML = "<span></span>";
    b.addEventListener("click", () => { go(i); });
    dots.appendChild(b);
  });
  const dotEls = dots.children;

  function load(i) {
    const img = slides[i] && slides[i].querySelector("img[data-src]");
    if (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
  }
  function go(i) {
    load(i);
    const was = slides[at];
    if (i % slides.length !== at) {
      // The old scene keeps drifting while it fades out (same animation, so it doesn't jump back).
      was.classList.add("out"); was.classList.remove("on");
      setTimeout(() => { if (!was.classList.contains("on")) was.classList.remove("out"); }, 1400);
    }
    dotEls[at].classList.remove("on");
    at = (i + slides.length) % slides.length;
    const s = slides[at];
    // Restart this scene's drift from the beginning.
    s.classList.remove("on", "out"); void s.offsetWidth; s.classList.add("on");
    dotEls[at].classList.remove("on"); void dotEls[at].offsetWidth; dotEls[at].classList.add("on");
    place.textContent = s.dataset.place;
    credit.textContent = "Photo: " + s.dataset.by + " / Unsplash";
    credit.href = s.dataset.href;
    load(at + 1); // the next one is ready before it's needed
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (still.matches || document.hidden) return;
    timer = setTimeout(() => go(at + 1), HOLD);
  }

  document.documentElement.style.setProperty("--scene-hold", HOLD + "ms");
  dotEls[0].classList.add("on");
  // Start the rest loading once the first photo is up, then begin the cycle.
  const first = slides[0].querySelector("img");
  const begin = () => { load(1); schedule(); };
  if (first.complete) begin(); else first.addEventListener("load", begin, { once: true });
  document.addEventListener("visibilitychange", schedule);
  if (still.addEventListener) still.addEventListener("change", schedule);
})();
