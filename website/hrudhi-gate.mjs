export const GATE_TRAVEL = 1.25;
export function gateReveal(progress) {
  const complete = progress >= 1;
  return {
    complete,
    opacity: complete ? 0 : 1 - clamp((progress - 0.8) / 0.2),
  };
}
const clamp = (n) => Math.max(0, Math.min(1, n));
export function gatePose(progress) {
  const p = clamp(progress),
    points = [
      [0, 0.14],
      [0.25, 0.22],
      [0.5, 0.32],
      [0.7, 0.43],
      [0.85, 0.46],
      [1, 0.44],
    ];
  const i = points.findIndex(([x]) => x >= p);
  const a = points[Math.max(0, i - 1)],
    b = points[Math.max(0, i)];
  return {
    time: Math.min(479 / 60, Math.round(p * 480) / 60),
    x: a[1] + (b[1] - a[1]) * (b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0])),
  };
}
export function renderGateWelcome(nature, _tour, { esc }) {
  const h = nature.hrudhi;
  if (!nature.enabled || !h.enabled) return "";
  // Still-first markup is useful without JS and never fetches a film before enhancement.
  return `<div id="hrudhi-welcome" class="hrudhi-welcome" aria-labelledby="hrudhi-welcome-title"><div class="hrudhi-gate-stage"><div class="hrudhi-gate-heading"><p class="eyebrow">AN ILLUSTRATED WELCOME TO AROHA</p><h2 id="hrudhi-welcome-title">${esc(h.invitation)}</h2><p>${esc(h.description)}</p></div><div class="hrudhi-gate-frame"><img class="hrudhi-gate-still" src="${esc(h.still)}" alt="Hrudhi, Aroha’s illustrated guide, welcoming you through an open farm gate" width="1344" height="756" loading="lazy" decoding="async"><video class="hrudhi-gate-film" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video><button class="hrudhi-character" type="button" aria-label="Meet Hrudhi, your illustrated nature guide" hidden><span>Meet Hrudhi <span aria-hidden="true">↗</span></span></button><span class="hrudhi-film-caption" aria-hidden="true">A LITTLE CURIOSITY GOES A LONG WAY</span></div><div class="hrudhi-gate-controls"><button class="hrudhi-meet button" type="button">Meet Hrudhi <span aria-hidden="true">↗</span></button><span class="hrudhi-scroll-hint" hidden>SCROLL TO OPEN THE GATE <span aria-hidden="true">↓</span></span><a class="button hrudhi-enter" href="#journey">Enter the farm <span aria-hidden="true">↗</span></a></div></div></div>`;
}
export function hrudhiIntroduction(h, { esc, picture }) {
  return `<div class="hrudhi-portrait">${picture(h.portrait, "Hrudhi, Aroha’s illustrated nature guide", "")}</div><div class="dialog-copy"><p class="eyebrow">YOUR ILLUSTRATED NATURE GUIDE</p><h2 id="dialog-title">${esc(h.bioTitle)}</h2><p>${esc(h.bio)}</p><p>${esc(h.role)}</p><button id="hrudhi-continue" class="button" type="button">Continue exploring <span aria-hidden="true">↗</span></button></div>`;
}
// One pending destination, never a queue of obsolete scroll seeks.
export function createGateSeeker(video, { changed = () => {} } = {}) {
  let target = 0,
    disposed = false,
    blocked = false;
  function flush() {
    if (
      disposed ||
      blocked ||
      video.seeking ||
      !Number.isFinite(video.duration) ||
      video.readyState < 1
    )
      return;
    const time = Math.min(Math.max(0, video.duration - 1 / 60), target);
    if (Math.abs(video.currentTime - time) < 1 / 120) {
      changed(video.currentTime);
      return;
    }
    video.currentTime = time;
  }
  const settled = () => {
    if (!disposed) {
      changed(video.currentTime);
      flush();
    }
  };
  video.addEventListener("loadedmetadata", flush);
  video.addEventListener("seeked", settled);
  return {
    seek(time) {
      target = time;
      flush();
    },
    block(value) {
      blocked = value;
      if (!value) flush();
    },
    destroy() {
      disposed = true;
      video.removeEventListener("loadedmetadata", flush);
      video.removeEventListener("seeked", settled);
    },
  };
}
export function createGateWelcome(
  root,
  config,
  { motion = true, meet, enter = () => {}, track = () => {} } = {},
) {
  motion = motion && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const section = root.querySelector("#hrudhi-welcome");
  if (!section) return { destroy() {} };
  const journey = root.querySelector("#journey");
  const stage = root.querySelector(".field-tour-stage");
  const video = section.querySelector("video"),
    still = section.querySelector(".hrudhi-gate-still"),
    character = section.querySelector(".hrudhi-character"),
    hint = section.querySelector(".hrudhi-scroll-hint"),
    button = section.querySelector(".hrudhi-meet");
  let disposed = false,
    loaded = false,
    failed = false,
    frame = 0,
    visible = false,
    keyboardFocus = false,
    started = false,
    completed = false;
  const animated =
    motion &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !navigator.connection?.saveData &&
    !!config.film;
  const listeners = [];
  const on = (target, name, fn, options) => {
    target.addEventListener(name, fn, options);
    listeners.push(() => target.removeEventListener(name, fn, options));
  };
  on(button, "click", meet);
  on(character, "click", meet);
  on(section.querySelector(".hrudhi-enter"), "click", (e) => {
    e.preventDefault();
    enter();
  });
  let seeker, observer, dialogs;
  const blocked = () =>
    document.hidden ||
    !visible ||
    keyboardFocus ||
    !!root.querySelector("dialog[open]");
  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(paint);
  }
  function pose(time) {
    if (disposed) return;
    const p = gatePose(time / 8);
    character.style.transform = `translate3d(${((p.x - 0.14) / 0.23) * 100}%,0,0)`;
  }
  function paint() {
    frame = 0;
    if (disposed || !motion) return;
    const r = journey.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < innerHeight;
    seeker?.block(blocked());
    if (blocked()) return;
    const progress = clamp(-r.top / Math.max(1, innerHeight * GATE_TRAVEL));
    const reveal = gateReveal(progress);
    section.style.opacity = String(reveal.opacity);
    section.style.visibility = reveal.complete ? "hidden" : "visible";
    for (const child of stage.children)
      if (child !== section) child.inert = !reveal.complete;
    if (reveal.complete && section.contains(document.activeElement))
      stage.querySelector("#tour-discover")?.focus({ preventScroll: true });
    section.inert = reveal.complete;
    if (!failed) seeker?.seek(gatePose(progress / 0.8).time);
    if (progress > 0.02 && !started) {
      started = true;
      track("hrudhi.gate.started");
    }
    if (progress > 0.97 && !completed) {
      completed = true;
      track("hrudhi.gate.completed");
    }
  }
  function fail() {
    if (disposed || failed) return;
    failed = true;
    section.dataset.gate = "still";
    hint.hidden = true;
    character.hidden = true;
    still.src = config.still;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  function load() {
    if (disposed || loaded || failed) return;
    loaded = true;
    still.src = config.poster || config.still;
    video.muted = true;
    video.preload = "auto";
    video.src =
      innerWidth < 800 && config.mobileFilm ? config.mobileFilm : config.film;
    video.load();
    schedule();
  }
  if (motion) {
    section.dataset.gate = animated ? "motion" : "still";
  } else {
    section.dataset.gate = "reading";
    journey.insertBefore(section, journey.querySelector(".tour-simple-stops"));
  }
  if (animated) {
    hint.hidden = false;
    seeker = createGateSeeker(video, { changed: pose });
    on(video, "loadeddata", () => {
      if (!disposed && !failed) {
        section.classList.add("gate-film-ready");
        character.hidden = false;
        schedule();
      }
    });
    on(video, "error", fail);
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) load();
          schedule();
        },
        { rootMargin: "300px" },
      );
      observer.observe(journey);
    } else load();
    schedule();
  }
  if (motion) {
    on(window, "scroll", schedule, { passive: true });
    on(window, "resize", schedule, { passive: true });
    on(document, "visibilitychange", schedule);
    on(character, "focus", () => {
      keyboardFocus = character.matches(":focus-visible");
      schedule();
    });
    on(character, "blur", () => {
      keyboardFocus = false;
      schedule();
    });
    dialogs = new MutationObserver(schedule);
    root
      .querySelectorAll("dialog")
      .forEach((d) =>
        dialogs.observe(d, { attributes: true, attributeFilter: ["open"] }),
      );
    schedule();
  }
  return {
    destroy() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      dialogs?.disconnect();
      seeker?.destroy();
      listeners.forEach((off) => off());
      for (const child of stage.children) child.inert = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
