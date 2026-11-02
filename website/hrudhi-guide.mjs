// Reuse the approved character artwork; one short walk accompanies a new place.
export function renderHrudhiGuide(mode, h, { esc }) {
  if (!h?.enabled) return "";
  return `<div class="hrudhi-guide-track ${mode === "map" ? "map-hrudhi-companion" : "tour-hrudhi-companion"}" data-hrudhi-guide="${mode}"><span class="guide-ground" aria-hidden="true"></span><div class="guide-traveller"><button type="button" class="hrudhi-guide-button" id="hrudhi-guide-${mode}" aria-label="Meet Hrudhi, your nature guide"><span class="guide-viewport" aria-hidden="true"><img class="guide-rest" src="${esc(h.portrait)}" alt="" width="512" height="768" loading="lazy"><img class="guide-walk-sheet" data-src="${esc(h.walkSheet || "/assets/retreat/hrudhi-walk-sheet-v1.webp")}" alt="" width="1774" height="887" decoding="async"></span><span class="guide-name">Hrudhi ↗</span></button></div><span class="guide-place-caption">YOUR NATURE GUIDE</span></div>`;
}
export function createHrudhiGuide(root, mode, { meet, motion = true } = {}) {
  const rail = root.querySelector(`[data-hrudhi-guide="${mode}"]`);
  if (!rail) return { select() {}, pause() {}, destroy() {} };
  const traveller = rail.querySelector(".guide-traveller"),
    button = rail.querySelector("button"),
    sheet = rail.querySelector(".guide-walk-sheet"),
    caption = rail.querySelector(".guide-place-caption");
  let animation,
    disposed = false,
    generation = 0,
    last = "",
    currentX = 0,
    lastTarget = 0,
    blocked = false,
    offscreen = false,
    keyboardFocus = false;
  const onClick = () => meet();
  button.addEventListener("click", onClick);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const allowed = () => motion && !reduced.matches;
  function pause(value) {
    blocked = value;
    rail.classList.toggle("guide-paused", value);
    if (animation) value ? animation.pause() : animation.play();
  }
  const visibility = () =>
    !disposed &&
    pause(
      offscreen ||
        keyboardFocus ||
        document.hidden ||
        !!root.querySelector("dialog[open]"),
    );
  const focus = () => {
    keyboardFocus = button.matches(":focus-visible");
    visibility();
  };
  const blur = () => {
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
  async function select(index, name, count = 11, force = false) {
    if (disposed) return;
    const width = rail.clientWidth,
      avatar = button.offsetWidth;
    let target = Math.max(
      0,
      ((width - avatar) * index) / Math.max(1, count - 1),
    );
    if (mode === "tour") {
      const stop = root.querySelector(`[data-tour-stop="${index}"]`);
      if (stop) {
        const rect = stop.getBoundingClientRect(),
          r = rail.getBoundingClientRect();
        target = Math.max(
          0,
          Math.min(
            width - avatar,
            rect.left + rect.width / 2 - r.left - avatar / 2,
          ),
        );
      }
    } else target = Math.max(0, ((width - avatar) * (index % 3)) / 2);
    if (!force && last === String(index) && Math.abs(target - lastTarget) < 1)
      return;
    last = String(index);
    lastTarget = target;
    caption.textContent = `WITH YOU / ${name}`;
    button.setAttribute("aria-label", `Meet Hrudhi, exploring ${name}`);
    const request = ++generation;
    if (animation) {
      const matrix = getComputedStyle(traveller).transform;
      animation.cancel();
      traveller.style.transform = matrix;
      const parsed = /matrix(3d)?\(([^)]+)\)/.exec(matrix);
      if (parsed) {
        const values = parsed[2].split(",").map(Number);
        const x = values[parsed[1] ? 12 : 4];
        if (Number.isFinite(x)) currentX = x;
      }
      animation = null;
    }
    rail.classList.remove("guide-walking");
    if (!allowed() || Math.abs(currentX - target) < 2 || force) {
      currentX = target;
      traveller.style.transform = `translate3d(${target}px,0,0)`;
      return;
    }
    try {
      if (!sheet.getAttribute("src")) sheet.src = sheet.dataset.src;
      await sheet.decode();
    } catch {
      if (!disposed && request === generation) {
        currentX = target;
        traveller.style.transform = `translate3d(${target}px,0,0)`;
      }
      return;
    }
    if (disposed || request !== generation) return;
    const backwards = target < currentX;
    button.querySelector(".guide-viewport").style.transform = backwards
      ? "scaleX(-1)"
      : "none";
    rail.classList.add("guide-walking");
    const active = (animation = traveller.animate(
      [
        { transform: `translate3d(${currentX}px,0,0)` },
        { transform: `translate3d(${target}px,0,0)` },
      ],
      {
        duration: Math.max(
          600,
          Math.min(1200, Math.abs(target - currentX) * 5),
        ),
        easing: "linear",
        fill: "forwards",
      },
    ));
    if (blocked) active.pause();
    active.finished
      .then(() => {
        if (!disposed && request === generation) {
          currentX = target;
          traveller.style.transform = `translate3d(${target}px,0,0)`;
          active.cancel();
          animation = null;
          rail.classList.remove("guide-walking");
          button.querySelector(".guide-viewport").style.transform = "none";
        }
      })
      .catch(() => {});
  }
  const observer =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          offscreen = !entries.some((e) => e.isIntersecting);
          visibility();
        })
      : null;
  observer?.observe(rail);
  visibility();
  return {
    select,
    pause,
    destroy() {
      disposed = true;
      generation++;
      animation?.cancel();
      observer?.disconnect();
      dialogs.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      button.removeEventListener("click", onClick);
      button.removeEventListener("focus", focus);
      button.removeEventListener("blur", blur);
    },
  };
}
