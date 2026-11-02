import { createGuideWalker } from "./guide-walking.mjs";
// Bundled v1 content is upgraded without replacing a host-selected custom sheet.
export function guideSheet(h) {
  const custom =
    h.walkSheet &&
    ![
      "/assets/retreat/hrudhi-walk-sheet-v1.webp",
      "/assets/retreat/hrudhi-directions-v2.webp",
    ].includes(h.walkSheet);
  return {
    src: custom ? h.walkSheet : "/assets/retreat/hrudhi-directions-v2.webp",
    layout: custom ? "legacy" : "directions",
  };
}
export function renderHrudhiGuide(mode, h, { esc }) {
  if (!h?.enabled) return "";
  const sheet = guideSheet(h);
  if (mode === "map")
    return `<div class="hrudhi-guide-track map-hrudhi-companion" data-hrudhi-guide="map" aria-hidden="true"><div class="guide-traveller"><span class="guide-viewport"><img class="guide-rest" src="${esc(h.portrait)}" alt="" width="512" height="768" loading="lazy"><img class="guide-walk-sheet" data-layout="${sheet.layout}" data-src="${esc(sheet.src)}" alt="" width="1246" height="1262" decoding="async"></span></div></div>`;
  return `<div class="hrudhi-guide-track ${mode === "map" ? "map-hrudhi-companion" : "tour-hrudhi-companion"}" data-hrudhi-guide="${mode}"><span class="guide-ground" aria-hidden="true"></span><div class="guide-traveller"><button type="button" class="hrudhi-guide-button" id="hrudhi-guide-${mode}" aria-label="Discover this place with Hrudhi" aria-haspopup="dialog"><span class="guide-viewport" aria-hidden="true"><img class="guide-rest" src="${esc(h.portrait)}" alt="" width="512" height="768" loading="lazy"><img class="guide-walk-sheet" data-layout="${sheet.layout}" data-src="${esc(sheet.src)}" alt="" width="1246" height="1262" decoding="async"></span><span class="guide-name">Hrudhi ↗</span></button></div><span class="guide-place-caption">YOUR NATURE GUIDE</span></div>`;
}
export function createHrudhiGuide(root, mode, { meet, motion = true } = {}) {
  const rail = root.querySelector(`[data-hrudhi-guide="${mode}"]`);
  if (!rail) return { select() {}, follow() {}, pause() {}, destroy() {} };
  const button = rail.querySelector("button"),
    caption = rail.querySelector(".guide-place-caption"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    lastIndex = 0,
    lastName = "",
    lastCount = 11,
    lastProgress = 0,
    offscreen = false,
    keyboardFocus = false;
  const walker = createGuideWalker(rail, {
    transform: (p) => `translate3d(${p.x}px,0,0)`,
    motion: motion && !reduced.matches,
  });
  const onClick = () => meet();
  button.addEventListener("click", onClick);
  function visibility() {
    walker.pause(
      offscreen ||
        keyboardFocus ||
        document.hidden ||
        !!root.querySelector("dialog[open]"),
    );
  }
  const focus = () => {
      keyboardFocus = button.matches(":focus-visible");
      visibility();
    },
    blur = () => {
      keyboardFocus = false;
      visibility();
    };
  button.addEventListener("focus", focus);
  button.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  const dialogs = new MutationObserver(visibility);
  root
    .querySelectorAll("dialog")
    .forEach((d) =>
      dialogs.observe(d, { attributes: true, attributeFilter: ["open"] }),
    );
  const observer = new IntersectionObserver((entries) => {
    offscreen = !entries.some((e) => e.isIntersecting);
    visibility();
  });
  observer.observe(rail);
  function target(index, count) {
    const width = Math.max(0, rail.clientWidth - button.offsetWidth);
    if (innerWidth <= 700) return (width * index) / Math.max(1, count - 1);
    const stop = root.querySelector(`[data-tour-stop="${index}"]`);
    if (!stop) return (width * index) / Math.max(1, count - 1);
    const r = stop.getBoundingClientRect(),
      bounds = rail.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(
        width,
        r.left + r.width / 2 - bounds.left - button.offsetWidth / 2,
      ),
    );
  }
  function select(index, name, count = 11, force = false) {
    if (disposed) return;
    lastIndex = index;
    lastName = name;
    lastCount = count;
    caption.textContent = `WITH YOU / ${name}`;
    button.setAttribute("aria-label", `Discover ${name} with Hrudhi`);
    if (innerWidth <= 700 && !force) return;
    walker.walk([{ x: target(index, count), y: 0 }], {
      instant: force || reduced.matches,
    });
  }
  function follow(progress) {
    lastProgress = progress;
    if (innerWidth > 700 || disposed) return;
    walker.walk(
      [
        {
          x:
            Math.max(0, rail.clientWidth - button.offsetWidth) *
            Math.max(0, Math.min(1, progress)),
          y: 0,
        },
      ],
      { instant: reduced.matches },
    );
  }
  const resize = () => {
    if (innerWidth <= 700)
      walker.walk(
        [
          {
            x:
              Math.max(0, rail.clientWidth - button.offsetWidth) * lastProgress,
            y: 0,
          },
        ],
        { instant: true },
      );
    else select(lastIndex, lastName, lastCount, true);
  };
  window.addEventListener("resize", resize);
  const reduce = () => {
    if (reduced.matches) resize();
  };
  reduced.addEventListener("change", reduce);
  visibility();
  return {
    select,
    follow,
    pause: (value) => walker.pause(value),
    destroy() {
      disposed = true;
      walker.destroy();
      observer.disconnect();
      dialogs.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", reduce);
      button.removeEventListener("click", onClick);
      button.removeEventListener("focus", focus);
      button.removeEventListener("blur", blur);
    },
  };
}
