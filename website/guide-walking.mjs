export function walkingDirection(dx, dy, previous = "south") {
  if (Math.hypot(dx, dy) < 0.0001) return previous;
  const horizontal = previous === "east" || previous === "west";
  const useX = horizontal
    ? Math.abs(dx) >= Math.abs(dy) * 0.8
    : Math.abs(dx) > Math.abs(dy) * 1.25;
  return useX ? (dx < 0 ? "west" : "east") : dy < 0 ? "north" : "south";
}
export function sampleGuidePath(points, distance) {
  if (!points.length)
    return { point: { x: 0, y: 0 }, direction: "south", done: true };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 0.0001) continue;
    if (distance < d) {
      const t = Math.max(0, distance / d);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        dx: b.x - a.x,
        dy: b.y - a.y,
        done: false,
      };
    }
    distance -= d;
  }
  return { point: points.at(-1), done: true };
}
export function createGuideWalker(
  rail,
  { transform, scale = () => 1, onPosition = () => {}, motion = true } = {},
) {
  const traveller = rail.querySelector(".guide-traveller"),
    sheet = rail.querySelector(".guide-walk-sheet"),
    viewport = rail.querySelector(".guide-viewport");
  let point = { x: 0, y: 0 },
    route = [],
    travel = 0,
    stride = 0,
    direction = "south",
    raf = 0,
    lastTime = 0,
    blocked = false,
    dead = false,
    generation = 0,
    decoded;
  rail.dataset.gait = "distance";
  function apply() {
    traveller.style.transform = transform(point);
    rail.dataset.direction = direction;
    const legacy = sheet.dataset.layout === "legacy",
      frame = Math.floor(stride) % (legacy ? 8 : 4);
    rail.style.setProperty("--guide-frame-x", `${-25 * (frame % 4)}%`);
    if (legacy) {
      rail.dataset.legacySheet = "true";
      rail.style.setProperty("--guide-row", frame < 4 ? "0%" : "-50%");
    }
    onPosition(point);
  }
  function settle() {
    route = [];
    rail.classList.remove("guide-walking");
    rail.style.setProperty("--guide-frame-x", "-25%");
  }
  function tick(now) {
    raf = 0;
    if (dead || blocked || !route.length) return;
    const dt = lastTime ? Math.min(0.06, (now - lastTime) / 1000) : 0;
    lastTime = now;
    const pixelScale = Math.max(0.001, scale()),
      body = viewport.clientHeight || 56,
      step = (dt * body * 1.25) / pixelScale;
    travel += step;
    stride += ((step * pixelScale) / (body * 0.9)) * 4;
    const next = sampleGuidePath(route, travel);
    if (next.dx !== undefined)
      direction = walkingDirection(next.dx, next.dy, direction);
    point = next.point;
    apply();
    if (next.done) settle();
    else raf = requestAnimationFrame(tick);
  }
  function resume() {
    if (!dead && !blocked && route.length && !raf) {
      lastTime = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  return {
    get position() {
      return { ...point };
    },
    get walking() {
      return !!route.length;
    },
    async walk(points, { instant = false } = {}) {
      const target = points.at(-1);
      if (!target || dead) return;
      if (
        route.length &&
        Math.hypot(target.x - route.at(-1).x, target.y - route.at(-1).y) < 0.1
      )
        return;
      const request = ++generation;
      if (instant || !motion) {
        cancelAnimationFrame(raf);
        raf = 0;
        point = target;
        settle();
        apply();
        return;
      }
      try {
        if (!sheet.getAttribute("src")) sheet.src = sheet.dataset.src;
        decoded ||= sheet.decode();
        await decoded;
      } catch {
        if (request === generation && !dead) {
          point = target;
          settle();
          apply();
        }
        return;
      }
      if (dead || request !== generation) return;
      rail.dataset.directionReady = "true";
      route = [point, ...points].filter(
        (p, i, a) =>
          i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 0.001,
      );
      travel = 0;
      if (route.length < 2) {
        point = target;
        settle();
        apply();
        return;
      }
      rail.classList.add("guide-walking");
      resume();
    },
    pause(value) {
      blocked = value;
      rail.classList.toggle("guide-paused", value);
      if (value) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastTime = 0;
      } else resume();
    },
    destroy() {
      dead = true;
      generation++;
      cancelAnimationFrame(raf);
      settle();
    },
  };
}
