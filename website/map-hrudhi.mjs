import { createGuideWalker } from "./guide-walking.mjs";
import {
  makeGuideNetwork,
  guideRoute,
  guideDestination,
} from "./map-guide-route.mjs";
export function createMapHrudhi(
  root,
  { motion = true, onPosition = () => {} } = {},
) {
  const rail = root.querySelector('[data-hrudhi-guide="map"]');
  if (!rail)
    return {
      select() {},
      destroy() {},
      get position() {
        return null;
      },
      get walking() {
        return false;
      },
    };
  const plane = rail.parentElement,
    viewport = rail.querySelector(".guide-viewport"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const paths = [...plane.querySelectorAll("[data-guide-path]")]
    .sort(
      (a, b) =>
        Number(b.dataset.guidePath === "main") -
        Number(a.dataset.guidePath === "main"),
    )
    .map((path) => {
      const length = path.getTotalLength(),
        steps = Math.ceil(length / 10);
      return Array.from({ length: steps + 1 }, (_, i) => {
        const p = path.getPointAtLength((length * i) / steps);
        return { x: p.x, y: p.y };
      });
    });
  const network = makeGuideNetwork(paths),
    walker = createGuideWalker(rail, {
      transform: (p) => `translate3d(${p.x / 10}%,${p.y / 10}%,0)`,
      scale: () => plane.clientWidth / 1000,
      motion: motion && !reduced.matches,
      onPosition,
    });
  let initialized = false,
    visible = true,
    destination = network.nodes[0],
    lastId = "",
    disposed = false;
  function visibility() {
    walker.pause(
      document.hidden || !visible || !!root.querySelector("dialog[open]"),
    );
  }
  function select(id, force = false) {
    if (disposed || (!force && id === lastId)) return;
    const marker = plane.querySelector(`[data-map-place="${CSS.escape(id)}"]`);
    if (!marker) return;
    lastId = id;
    const bounds = plane.getBoundingClientRect(),
      scale = 1000 / Math.max(1, bounds.width),
      avatar = viewport.getBoundingClientRect();
    const obstacles = [...plane.querySelectorAll("[data-map-place]")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return {
          left: (r.left - bounds.left - 6) * scale,
          right: (r.right - bounds.left + 6) * scale,
          top: (r.top - bounds.top - 6) * scale,
          bottom: (r.bottom - bounds.top + 6) * scale,
        };
      },
    );
    destination = guideDestination(
      network.nodes,
      {
        x: parseFloat(marker.style.left) * 10,
        y: parseFloat(marker.style.top) * 10,
      },
      obstacles,
      { width: avatar.width * scale, height: avatar.height * scale },
    );
    rail.dataset.place = id;
    walker.walk(guideRoute(network, walker.position, destination), {
      instant: !initialized || force || reduced.matches,
    });
    initialized = true;
  }
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    visibility();
  });
  observer.observe(plane);
  const dialogs = new MutationObserver(visibility);
  root
    .querySelectorAll("dialog")
    .forEach((d) =>
      dialogs.observe(d, { attributes: true, attributeFilter: ["open"] }),
    );
  document.addEventListener("visibilitychange", visibility);
  const reduce = () => {
    if (reduced.matches) select(lastId, true);
  };
  reduced.addEventListener("change", reduce);
  return {
    select,
    get position() {
      return walker.position;
    },
    get walking() {
      return walker.walking;
    },
    destroy() {
      disposed = true;
      walker.destroy();
      observer.disconnect();
      dialogs.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", reduce);
    },
  };
}
