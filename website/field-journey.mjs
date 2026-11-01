import { createHeroAtmosphere } from "./hero-atmosphere.mjs";
import { createBotanicalMotion, orbitPose } from "./botanical-motion.mjs";
import { tourContent } from "./field-render.mjs";
const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function routeState(progress, count) {
  const q = clamp(progress) * Math.max(1, count),
    index = Math.min(Math.max(0, count - 1), Math.floor(q));
  return { index, local: clamp(q - index), progress: clamp(progress) };
}
export function createFieldJourney(
  root,
  c,
  actions,
  { simple = false, resumeAt = 0 } = {},
) {
  const tour = tourContent(c),
    section = root.querySelector("#journey"),
    header = root.querySelector(".field-header");
  const hero = root.querySelector(".field-hero"),
    heroImage = root.querySelector(".field-hero-visual");
  const stage = section?.querySelector(".field-tour-stage"),
    visual = section?.querySelector(".tour-visual"),
    image = section?.querySelector(".tour-scene-image");
  const film = section?.querySelector("#tour-film"),
    frame = section?.querySelector(".tour-film-frame"),
    status = section?.querySelector("#tour-status");
  const dialog = root.querySelector("#details-dialog");
  let current = -1,
    progress = resumeAt,
    paused = false,
    offscreen = true,
    dead = false,
    raf = 0,
    px = 0,
    py = 0,
    observer,
    mediaObserver;
  const listeners = [];
  const listen = (el, type, fn, opt) => {
    el?.addEventListener(type, fn, opt);
    listeners.push(() => el?.removeEventListener(type, fn, opt));
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowData = navigator.connection?.saveData === true;
  const motion = !simple && !reduced && c.theme.motion;
  const atmosphere = createHeroAtmosphere(root);
  const botanical = createBotanicalMotion(root, motion, () => request());
  const panels = [...root.querySelectorAll("[data-orbit-panel]")];
  const filmHome = frame?.parentElement;
  if (section) {
    section.classList.toggle("is-simple", !motion);
    section.style.height = motion
      ? `${Math.max(1, tour.stops.length) * 135 + 100}svh`
      : "auto";
    if (!motion) {
      const readable = document.createElement("div");
      readable.className = "tour-simple-stops";
      tour.stops.forEach((s, i) => {
        const article = document.createElement("article");
        article.id = "tour-place-" + i;
        const photo = document.createElement("img");
        photo.src = s.image;
        photo.alt = s.imageAlt;
        photo.loading = "lazy";
        photo.width = 1800;
        photo.height = 1200;
        const text = document.createElement("div"),
          number = document.createElement("p"),
          title = document.createElement("h2"),
          description = document.createElement("p"),
          button = document.createElement("button");
        number.className = "eyebrow";
        number.textContent = String(i + 1).padStart(2, "0") + " / " + s.name;
        title.textContent = s.title;
        description.textContent = s.detail;
        button.className = "field-text-link";
        button.textContent = "Explore this place ↗";
        button.onclick = () => actions.stop(i);
        text.append(number, title, description, button);
        article.append(photo, text);
        readable.append(article);
      });
      section.append(readable);
    }
  }
  function go(index) {
    if (!section || !tour.stops.length) return;
    index = Math.max(0, Math.min(tour.stops.length - 1, index));
    if (!motion) {
      section
        .querySelector("#tour-place-" + index)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    const range = section.offsetHeight - innerHeight;
    window.scrollTo({
      top:
        scrollY +
        section.getBoundingClientRect().top +
        (range * (index + 0.4)) / tour.stops.length,
      behavior: reduced ? "instant" : "smooth",
    });
  }
  function playback() {
    botanical.paused(document.hidden || dialog.open);
    if (!film?.getAttribute("src")) return;
    const play =
      !paused &&
      !offscreen &&
      !document.hidden &&
      !dialog.open &&
      motion &&
      !lowData;
    if (play && film.paused)
      film
        .play()
        .then(() => {
          if (dead || paused || offscreen || document.hidden || dialog.open)
            film.pause();
        })
        .catch(() => {
          if (!dead) {
            section.querySelector("#tour-play").textContent = "Play film ▷";
          }
        });
    else if (!play) film.pause();
  }
  function setStop(i) {
    if (i === current || !tour.stops[i] || !stage) return;
    current = i;
    const s = tour.stops[i];
    const m = tour.media.find((m) => m.id === s.film && m.kind === "video");
    const previous = image.cloneNode();
    previous.className = "tour-scene-image tour-scene-ghost";
    previous.alt = "";
    previous.setAttribute("aria-hidden", "true");
    previous.style.zIndex = "1";
    visual.querySelectorAll(".tour-scene-ghost").forEach((x) => x.remove());
    visual.append(previous);
    image.onload = () => {
      if (dead) return;
      previous
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 650,
          easing: "ease-out",
        })
        .finished.then(() => previous.remove())
        .catch(() => previous.remove());
    };
    image.onerror = () => previous.remove();
    image.src = s.image;
    image.alt = s.imageAlt;
    if (image.complete) image.onload();
    stage.querySelector("#tour-index").textContent =
      String(i + 1).padStart(2, "0") +
      " / " +
      String(tour.stops.length).padStart(2, "0") +
      " — " +
      s.name;
    stage.querySelector("#tour-walk").hidden = !s.walk?.length;
    stage.querySelector("#tour-title").textContent = s.title;
    stage.querySelector("#tour-description").textContent = s.description;
    stage.querySelector("#tour-context").textContent = s.detail;
    stage.querySelector("#tour-place-name").textContent = s.name;
    const dot = stage.querySelector("#tour-map-dot");
    dot.hidden = s.onMap === false;
    dot.style.display = s.onMap === false ? "none" : "";
    dot.setAttribute("cx", s.mapX);
    dot.setAttribute("cy", s.mapY);
    stage.querySelectorAll("[data-tour-stop]").forEach((b, n) => {
      if (i === n) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    const active = stage.querySelector(`[data-tour-stop="${i}"]`),
      nav = stage.querySelector(".tour-stop-nav");
    if (active && innerWidth < 900)
      nav.scrollTo({
        left:
          active.offsetLeft -
          nav.offsetLeft -
          nav.clientWidth / 2 +
          active.clientWidth / 2,
        behavior: "instant",
      });
    stage.querySelector("#tour-previous").disabled = i === 0;
    stage
      .querySelector("#tour-next")
      .setAttribute(
        "aria-label",
        i === tour.stops.length - 1 ? "Explore stays and visits" : "Next place",
      );
    stage.querySelector("#tour-instruction").textContent =
      i === tour.stops.length - 1
        ? "TAKE YOUR TIME. STAY A WHILE."
        : "SCROLL TO WANDER";
    if (panels[i] && frame) {
      panels[i].append(frame);
      panels.forEach((p, n) => p.classList.toggle("is-active", n === i));
    }
    film.pause();
    film.removeAttribute("src");
    film.load();
    frame.hidden = !m;
    stage.classList.toggle("has-film", !!m);
    const play = stage.querySelector("#tour-play");
    play.hidden = !m;
    play.textContent = paused ? "Play film ▷" : "Pause film Ⅱ";
    play.setAttribute("aria-pressed", String(paused));
    if (m) {
      film.poster = m.image;
      film.src = m.src;
      film.load();
      frame.classList.remove("film-ready");
      playback();
    }
    if (status) status.textContent = s.name + ". " + s.description;
    actions.track("journey.stop", { section: s.id });
  }
  function paint() {
    raf = 0;
    if (dead) return;
    const h = hero.getBoundingClientRect(),
      s = section?.getBoundingClientRect();
    const light = h.bottom < 90 && (!s || s.top > 90 || s.bottom < 90);
    header.classList.toggle("on-paper", light);
    botanical.paint(h);
    if (motion && h.bottom > 0)
      heroImage.style.transform = `translate3d(0,${Math.min(180, -h.top * 0.13)}px,0) scale(${1 + clamp(-h.top / innerHeight) * 0.035})`;
    if (!stage || !motion) return;
    offscreen = s.bottom <= 0 || s.top >= innerHeight;
    if (offscreen) {
      film.pause();
      return;
    }
    const range = Math.max(1, section.offsetHeight - innerHeight);
    progress = clamp(-s.top / range);
    const state = routeState(progress, tour.stops.length);
    setStop(state.index);
    const local = state.local;
    const center = progress * tour.stops.length - 0.4;
    const radius =
      innerWidth < 700 ? innerWidth * 0.88 : Math.min(1100, innerWidth * 0.45);
    panels.forEach((panel, i) => {
      const p = orbitPose(i, center, {
        radius,
        step: innerWidth < 700 ? 52 : 40,
      });
      panel.style.transform = `translate3d(${p.x}px,0,${p.z}px) rotateY(${-p.angle}deg)`;
      panel.style.opacity = p.visible
        ? String(Math.max(0.18, 1 - Math.abs(p.angle) / 130))
        : "0";
      panel.style.visibility = p.visible ? "visible" : "hidden";
      panel.style.zIndex = String(100 - Math.round(Math.abs(p.angle)));
      const pic = panel.querySelector("[data-orbit-src]");
      if (p.visible && pic && !pic.getAttribute("src"))
        pic.src = pic.dataset.orbitSrc;
    });
    image.style.transform = `translate3d(${px * 10}px,${py * 7 - local * 12}px,0) scale(${1.035 + local * 0.055})`;
    // Only this visual moves. Text and controls stay still for reading.
    visual.style.transform = `perspective(1800px) rotateY(${px * 0.45}deg)`;
    const open = clamp(progress * tour.stops.length * 3);
    const doors = stage.querySelectorAll(".tour-threshold>div");
    doors[0].style.transform = `perspective(1200px) translateX(${-open * 106}%) rotateY(${-open * 16}deg)`;
    doors[1].style.transform = `perspective(1200px) translateX(${open * 106}%) rotateY(${open * 16}deg)`;
    stage.querySelector(".tour-threshold").hidden = open >= 1;
    stage.querySelector(".tour-progress>span").style.transform =
      `scaleX(${progress})`;
    playback();
  }
  function request() {
    if (!raf && !dead) raf = requestAnimationFrame(paint);
  }
  listen(window, "scroll", request, { passive: true });
  listen(window, "resize", () => {
    // Keep the same place when a phone rotates or the viewport changes height.
    // The section's svh geometry has already changed by the resize event.
    if (motion && section && !offscreen && progress > 0 && progress < 1) {
      const top = scrollY + section.getBoundingClientRect().top;
      window.scrollTo({
        top: top + progress * Math.max(1, section.offsetHeight - innerHeight),
        behavior: "instant",
      });
    }
    request();
  });
  listen(document, "visibilitychange", playback);
  listen(stage, "pointermove", (e) => {
    if (e.pointerType === "mouse" && motion) {
      const r = stage.getBoundingClientRect();
      px = clamp((e.clientX - r.left) / r.width) * 2 - 1;
      py = clamp((e.clientY - r.top) / r.height) * 2 - 1;
      request();
    }
  });
  listen(stage, "pointerleave", () => {
    px = py = 0;
    request();
  });
  listen(film, "loadeddata", () => {
    frame.classList.add("film-ready");
    playback();
  });
  listen(film, "error", () => {
    if (!dead && film.getAttribute("src")) {
      frame.hidden = true;
      stage.classList.remove("has-film");
      section.querySelector("#tour-play").hidden = true;
      actions.error("TOUR_FILM_UNAVAILABLE");
    }
  });
  listen(section?.querySelector("#tour-play"), "click", () => {
    paused = !paused;
    const b = section.querySelector("#tour-play");
    b.textContent = paused ? "Play film ▷" : "Pause film Ⅱ";
    b.setAttribute("aria-pressed", String(paused));
    if (!paused && lowData) film.play().catch(() => {});
    else playback();
  });
  listen(section?.querySelector("#tour-discover"), "click", () =>
    actions.stop(current < 0 ? 0 : current),
  );
  listen(section?.querySelector("#tour-walk"), "click", () =>
    actions.walk(Math.max(0, current)),
  );
  listen(film, "loadedmetadata", () =>
    frame.classList.toggle("is-portrait", film.videoHeight > film.videoWidth),
  );
  listen(section?.querySelector("#tour-next"), "click", () => {
    if (current === tour.stops.length - 1) {
      const next = section.nextElementSibling;
      next?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
    } else go(current + 1);
  });
  listen(section?.querySelector("#tour-previous"), "click", () =>
    go(current - 1),
  );
  root
    .querySelectorAll("[data-tour-stop]")
    .forEach((b) => listen(b, "click", () => go(Number(b.dataset.tourStop))));
  if (dialog) {
    observer = new MutationObserver(playback);
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  }
  if ("IntersectionObserver" in window) {
    mediaObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          offscreen = !e.isIntersecting;
          playback();
        }
      },
      { threshold: 0 },
    );
    if (stage) mediaObserver.observe(stage);
  }
  paint();
  return {
    go,
    get progress() {
      return progress;
    },
    get index() {
      return Math.max(0, current);
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      botanical.destroy();
      atmosphere.destroy();
      if (frame && filmHome) filmHome.append(frame);
      listeners.forEach((fn) => fn());
      observer?.disconnect();
      mediaObserver?.disconnect();
      film?.pause();
      if (film) {
        film.removeAttribute("src");
        film.load();
      }
    },
  };
}
