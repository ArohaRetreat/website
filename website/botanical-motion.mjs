const clamp = (n) => Math.max(0, Math.min(1, n));
// Scroll supplies the time. Real photographs revolve; reading surfaces stay fixed.
export function orbitPose(index, center, { radius = 640, step = 36 } = {}) {
  const angle = (index - center) * step,
    rad = (angle * Math.PI) / 180;
  return {
    angle,
    x: Math.sin(rad) * radius,
    z: (Math.cos(rad) - 1) * radius,
    visible: Math.abs(angle) < 92,
  };
}
export function createBotanicalMotion(root, enabled, request) {
  const hero = root.querySelector(".field-hero"),
    light = root.querySelector(".hero-light"),
    gardenOrbit = root.querySelector(".hero-garden-orbit"),
    fronds = [...root.querySelectorAll(".hero-frond")],
    story = root.querySelector(".nature-story"),
    plant = root.querySelector(".nature-plant"),
    petals = [...root.querySelectorAll(".nature-photo-petal")],
    line = root.querySelector(".nature-connecting-line path");
  let px = 0,
    py = 0,
    observer;
  const entrances = new Set();
  root.classList.toggle("living-motion", enabled);
  const move = (e) => {
    if (!enabled || e.pointerType !== "mouse") return;
    const r = hero.getBoundingClientRect();
    px = clamp((e.clientX - r.left) / r.width) * 2 - 1;
    py = clamp((e.clientY - r.top) / r.height) * 2 - 1;
    request();
  };
  const leave = () => {
    px = py = 0;
    request();
  };
  hero.addEventListener("pointermove", move, { passive: true });
  hero.addEventListener("pointerleave", leave);
  if (enabled && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const entrance = e.target.animate(
            [
              {
                opacity: 0.35,
                transform: "translate3d(0,45px,0) rotate(-2deg) scale(.97)",
              },
              {
                opacity: 1,
                transform: "translate3d(0,0,0) rotate(0deg) scale(1)",
              },
            ],
            { duration: 850, easing: "cubic-bezier(.23,1,.32,1)" },
          );
          entrances.add(entrance);
          entrance.finished.then(
            () => entrances.delete(entrance),
            () => entrances.delete(entrance),
          );
          observer.unobserve(e.target);
        }
      },
      { threshold: 0.12 },
    );
    root
      .querySelectorAll(".field-stay-photo,.field-experience-photo")
      .forEach((el) => observer.observe(el));
  }
  return {
    paint(h) {
      if (!enabled) return;
      const vh = innerHeight;
      hero.classList.toggle("is-visible", h.bottom > 0 && h.top < vh);
      const r = story?.getBoundingClientRect();
      if (h.bottom > 0 && h.top < vh) {
        const p = clamp(-h.top / Math.max(1, h.height));
        if (light)
          light.style.transform = `translate3d(${px * 45}px,${py * 35 - p * 70}px,0) scale(${1 + p * 0.15})`;
        if (gardenOrbit)
          gardenOrbit.style.transform = `rotate(${p * 95 + px * 4}deg)`;
        fronds.forEach(
          (el, i) =>
            (el.style.transform = `translate3d(${-px * (i ? 14 : 22)}px,${p * (i ? 85 : -80) - py * 10}px,0) rotate(${(i ? -1 : 1) * (p * 20 + px * 3)}deg)`),
        );
      }
      if (r && r.top < vh && r.bottom > 0) {
        const p = clamp((vh - r.top) / (vh + r.height)),
          radius = innerWidth < 700 ? 105 : innerWidth < 1100 ? 200 : 280;
        if (plant)
          plant.style.transform = `translate3d(0,${(1 - p) * 35}px,0) rotate(${-5 + p * 10}deg) scale(${0.88 + p * 0.2})`;
        petals.forEach((el, i) => {
          const a = ((i * 120 + p * 115 - 100) * Math.PI) / 180;
          el.style.transform = `translate3d(${Math.sin(a) * radius}px,${Math.cos(a) * radius * 0.68}px,0) rotate(${Math.sin(a) * 16}deg)`;
        });
        if (line)
          line.style.strokeDashoffset = String(1 - clamp((p - 0.15) / 0.55));
      }
    },
    paused(value) {
      root.classList.toggle("botany-paused", value);
      for (const a of entrances) value ? a.pause() : a.play();
    },
    destroy() {
      observer?.disconnect();
      for (const a of entrances) a.cancel();
      entrances.clear();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      root.classList.remove("living-motion", "botany-paused");
    },
  };
}
