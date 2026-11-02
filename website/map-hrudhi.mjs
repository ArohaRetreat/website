import { makeGuideNetwork, guideRoute } from "./map-guide-route.mjs";
export function createMapHrudhi(root, { motion = true } = {}) {
  const rail = root.querySelector('[data-hrudhi-guide="map"]');
  if (!rail) return { select() {}, destroy() {} };
  const plane = rail.parentElement,
    traveller = rail.querySelector(".guide-traveller"),
    sheet = rail.querySelector(".guide-walk-sheet"),
    viewport = rail.querySelector(".guide-viewport");
  const paths = [...plane.querySelectorAll("[data-guide-path]")]
    .sort(
      (a, b) =>
        Number(b.dataset.guidePath === "main") -
        Number(a.dataset.guidePath === "main"),
    )
    .map((path) => {
      const length = path.getTotalLength(),
        steps = Math.ceil(length / 12);
      return Array.from({ length: steps + 1 }, (_, i) => {
        const p = path.getPointAtLength((length * i) / steps);
        return { x: p.x, y: p.y };
      });
    });
  const network = makeGuideNetwork(paths),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let point = network.nodes[0],
    destination = point,
    animation,
    disposed = false,
    generation = 0,
    initialized = false,
    visible = true;
  const transform = (p) => `translate3d(${p.x / 10}%,${p.y / 10}%,0)`;
  function stop() {
    if (!animation) return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(traveller).transform);
    point = {
      x: (matrix.m41 * 1000) / Math.max(1, plane.clientWidth),
      y: (matrix.m42 * 1000) / Math.max(1, plane.clientHeight),
    };
    animation.cancel();
    animation = null;
    facing = null;
    traveller.style.transform = transform(point);
    rail.classList.remove("guide-walking");
  }
  function pause() {
    const paused =
      document.hidden || !visible || !!root.querySelector("dialog[open]");
    rail.classList.toggle("guide-paused", paused);
    if (animation) paused ? animation.pause() : animation.play();
  }
  async function move(instant = false) {
    const request = ++generation;
    stop();
    const route = guideRoute(network, point, destination),
      target = route.at(-1);
    if (instant || !motion || reduced.matches) {
      point = target;
      traveller.style.transform = transform(point);
      return;
    }
    try {
      if (!sheet.src) sheet.src = sheet.dataset.src;
      await sheet.decode();
    } catch {
      if (!disposed && request === generation) {
        point = target;
        traveller.style.transform = transform(point);
      }
      return;
    }
    if (disposed || request !== generation) return;
    const lengths = [0];
    for (let i = 1; i < route.length; i++)
      lengths.push(
        lengths.at(-1) +
          Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y),
      );
    const total = lengths.at(-1);
    if (total < 1) return;
    rail.classList.add("guide-walking");
    const frames = route.map((p, i) => ({
      transform: transform(p),
      offset: lengths[i] / total,
    }));
    // Turn at each bend rather than moonwalking on return journeys.
    const turns = route.map((p, i) => ({
      transform:
        route[Math.min(i + 1, route.length - 1)].x - p.x < -0.1
          ? "scaleX(-1)"
          : "scaleX(1)",
      offset: lengths[i] / total,
    }));
    animation = traveller.animate(frames, {
      duration: Math.max(900, Math.min(8500, total * 11)),
      easing: "linear",
      fill: "forwards",
    });
    const turning = viewport.animate(turns, {
      duration: animation.effect.getTiming().duration,
      easing: "steps(1,end)",
      fill: "forwards",
    });
    // Keep facing synchronized with pause/cancel and avoid a second independent clock.
    animation.oncancel = () => turning.cancel();
    const active = animation;
    facing = turning;
    check();
    active.finished
      .then(() => {
        if (disposed || request !== generation) return;
        point = target;
        traveller.style.transform = transform(point);
        active.cancel();
        animation = null;
        facing = null;
        rail.classList.remove("guide-walking");
        viewport.style.transform = "none";
      })
      .catch(() => {});
  }
  let facing;
  const check = () => {
    pause();
    if (facing)
      animation?.playState === "paused" ? facing.pause() : facing.play();
  };
  document.addEventListener("visibilitychange", check);
  const dialogs = new MutationObserver(check);
  root
    .querySelectorAll("dialog")
    .forEach((d) =>
      dialogs.observe(d, { attributes: true, attributeFilter: ["open"] }),
    );
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    check();
  });
  observer.observe(plane);
  const reduce = () => {
    if (reduced.matches) move(true);
  };
  reduced.addEventListener("change", reduce);
  return {
    select(id, force = false) {
      const marker = plane.querySelector(
        `[data-map-place="${CSS.escape(id)}"]`,
      );
      if (!marker) return;
      destination = {
        x: parseFloat(marker.style.left) * 10,
        y: parseFloat(marker.style.top) * 10,
      };
      if (initialized && rail.dataset.place === id) return;
      rail.dataset.place = id;
      move(!initialized || force);
      initialized = true;
    },
    destroy() {
      disposed = true;
      generation++;
      stop();
      observer.disconnect();
      dialogs.disconnect();
      document.removeEventListener("visibilitychange", check);
      reduced.removeEventListener("change", reduce);
    },
  };
}
