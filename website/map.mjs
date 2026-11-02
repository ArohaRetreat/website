import { createHrudhiGuide } from "./hrudhi-guide.mjs";
import { hrudhiIntroduction } from "./hrudhi-gate.mjs";
import { natureContent } from "./nature-render.mjs";
import { esc, picture } from "./render.mjs";
import { createGuestAccount } from "./guest-account.mjs";
import { initializeAnalytics } from "./analytics.mjs";
import { createPublicMenu } from "./navigation.mjs";
import { openEnquiry, openPrivacy } from "./guest-dialogs.mjs";
import initial from "./content.json";
import { renderMap, mapContent } from "./map-render.mjs";
import { tourContent } from "./field-render.mjs";
import {
  placeFromHash,
  adjacentPlace,
  treeDescent,
  timelineProgress,
} from "./map-state.mjs";
import { validateContent } from "../functions/domain.mjs";
import { preference, setPreference } from "./preferences.mjs";
import { track, initializeMonitoring, reportError } from "./monitoring.mjs";
const root = document.getElementById("living-map");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const phone = matchMedia("(max-width: 650px)");
const preview = new URLSearchParams(location.search).has("preview");
let content = initial,
  map = mapContent(content),
  active = placeFromHash(location.hash, map.places) || map.places[0]?.id,
  reading =
    reduced.matches ||
    new URLSearchParams(location.search).get("view") === "reading" ||
    !initial.theme.motion ||
    preference("aroha-map-view") === "reading",
  dispose = () => {},
  guide,
  unsubscribe,
  scrollingTo = null,
  subscriptionGeneration = 0,
  pendingContent,
  overview = location.hash === "#map-overview";
const chapterSelection = new Map();
function render() {
  if (!content.theme.motion) reading = true;
  const scroll = scrollY,
    focus = document.activeElement?.dataset?.mapPlace;
  dispose();
  map = mapContent(content);
  if (!map.places.some((p) => p.id === active)) active = map.places[0]?.id;
  root.innerHTML = renderMap(content);
  document.body.classList.add("map-enhanced");
  document.body.classList.toggle("map-reading", reading);
  document.documentElement.dataset.routeMotion = reading || !content.theme.motion || reduced.matches ? "off" : "on";
  document.body.classList.toggle("map-overview-mode", overview);
  root.querySelector(".map-narrative").inert = overview;
  root.querySelector("[data-map-resume]").hidden = !overview;
  for (const key of ["forest", "ivory", "leaf", "bronze"])
    document.documentElement.style.setProperty("--" + key, content.theme[key]);
  if (preview) {
    const b = document.createElement("div");
    b.className = "map-preview";
    b.textContent = "Private draft preview — changes are not published";
    root.prepend(b);
  }
  dispose = bind();
  applySelection(active, false);
  scrollTo({ top: scroll, behavior: "instant" });
  if (focus)
    root
      .querySelector(`[data-map-place="${focus}"]`)
      ?.focus({ preventScroll: true });
}
function applySelection(id, announce = true) {
  const p = map.places.find((p) => p.id === id);
  if (!p) return;
  active = id;
  const stops=tourContent(content).stops,stop=stops.find(s=>s.id===id);
  guide?.select(stops.findIndex(s=>s.id===id),stop?.name||"Aroha",stops.length);
  chapterSelection.set(p.chapter, id);
  for (const chapter of map.chapters) {
    let selected = chapterSelection.get(chapter.id);
    if (!map.places.some((p) => p.id === selected))
      selected = map.places.find((p) => p.chapter === chapter.id)?.id;
    root
      .querySelectorAll(`[data-map-chapter="${chapter.id}"] [data-story]`)
      .forEach((el) => {
        el.hidden = !reading && el.dataset.story !== selected;
      });
  }
  root.querySelectorAll("[data-map-place]").forEach((a) => {
    const selected = a.dataset.mapPlace === id;
    if (selected) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
    a.classList.toggle("is-active", selected);
  });
  root
    .querySelectorAll("[data-root]")
    .forEach((el) => el.classList.toggle("is-active", el.dataset.root === id));
  root.querySelectorAll("video").forEach((video) => video.pause());
  const index = map.places.findIndex((p) => p.id === id);
  root.querySelectorAll("[data-place-count]").forEach((el) => {
    el.textContent = `${String(index + 1).padStart(2, "0")} / ${String(map.places.length).padStart(2, "0")} places`;
  });
  root
    .querySelectorAll("[data-map-previous]")
    .forEach((b) => (b.disabled = index === 0));
  root
    .querySelectorAll("[data-map-next]")
    .forEach((b) => (b.disabled = index === map.places.length - 1));
  root.querySelector("#place-chooser").value = id;
  const route = root.querySelector("[data-walking-route]");
  const length = route.getTotalLength();
  const progress =
    {
      arrival: 0.08,
      parking: 0.2,
      pond: 0.35,
      house: 0.55,
      kitchen: 0.53,
      library: 0.55,
      treehouses: 0.66,
      cottages: 0.83,
      meditation: 1,
      pool: 0.96,
      farm: 0.3,
    }[id] || 0.1;
  route.style.strokeDasharray = `${length * progress} ${length}`;
  if (announce)
    root.querySelector("#map-status").textContent =
      tourContent(content).stops.find((s) => s.id === id)?.name || "";
}
function navigate(
  id,
  { historyMode = "push", scroll = true, focus = false } = {},
) {
  if (!map.places.some((p) => p.id === id)) return;
  overview = false;
  document.body.classList.remove("map-overview-mode");
  root.querySelector(".map-narrative").inert = false;
  root.querySelector("[data-map-resume]").hidden = true;
  const changed = id !== active;
  applySelection(id);
  window.dispatchEvent(new Event("resize"));
  if (historyMode) history[historyMode + "State"](null, "", "#" + id);
  if (scroll) {
    scrollingTo = id;
    const target = reading
      ? document.getElementById(id)
      : root.querySelector(
          `[data-map-chapter="${map.places.find((p) => p.id === id).chapter}"]`,
        );
    target?.scrollIntoView({
      behavior: reduced.matches ? "instant" : "smooth",
      block: "start",
    });
  }
  if (focus)
    document
      .getElementById(id)
      ?.querySelector("h3")
      ?.focus({ preventScroll: true });
  if (changed) track("map.place-opened", { section: id, outcome: "selected" });
}
function bind() {
  const menu = createPublicMenu(root, {
    motion: !reading && content.theme.motion && !reduced.matches,
    onOpen: () => document.body.classList.add("map-paused"),
    onClose: () => {
      if (pendingContent) {
        content = pendingContent;
        pendingContent = null;
        render();
        root
          .querySelector("#public-menu-toggle")
          ?.focus({ preventScroll: true });
      } else schedule();
    },
  });
  const removals = [],
    listen = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      removals.push(() => el.removeEventListener(type, fn, opts));
    };
  let lastFocus;
  const dialog = root.querySelector("#details-dialog");
  function show(markup) {
    lastFocus = document.activeElement;
    root.querySelectorAll("video").forEach((v) => v.pause());
    document.body.classList.add("map-paused");
    root.querySelector("#dialog-content").innerHTML = markup;
    dialog.showModal();
    root.querySelector(".dialog-close").focus({ preventScroll: true });
  }
  const meetGuide = () => {
    track("hrudhi.introduction.opened");
    show(hrudhiIntroduction(natureContent(tourContent(content)).hrudhi,{esc,picture}));
    root.querySelector("#hrudhi-continue").onclick=()=>dialog.close();
  };
  guide = createHrudhiGuide(root,"map",{motion:!reading && content.theme.motion && !reduced.matches,meet:meetGuide});
  listen(root.querySelector("[data-map-meet-hrudhi]"),"click",meetGuide);
  const guestAccount = createGuestAccount(root,{show,close:()=>dialog.close(),closeMenu:()=>menu.whenClosed()});
  root
    .querySelectorAll("[data-enquire]")
    .forEach((b) =>
      listen(b, "click", () => openEnquiry(content, show, b.dataset.enquire)),
    );
  listen(root.querySelector("#privacy-settings"), "click", () =>
    openPrivacy(show),
  );
  listen(root.querySelector(".dialog-close"), "click", () => dialog.close());
  listen(dialog, "close", () => {
    if (pendingContent) {
      const id = lastFocus?.id;
      content = pendingContent;
      pendingContent = null;
      render();
      if (id)
        root
          .querySelector("#" + CSS.escape(id))
          ?.focus({ preventScroll: true });
    } else {
      if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
      schedule();
    }
  });
  listen(dialog, "click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  });
  let frame = 0,
    observer;
  const camera = root.querySelector(".tree-camera"),
    intro = root.querySelector(".map-introduction"),
    descent = root.querySelector(".map-descent");
  const connectors = [...root.querySelectorAll(".map-timeline")].map((el) => ({
    el,
    fill: el.querySelector(".timeline-growth"),
  }));
  function draw() {
    frame = 0;
    document.body.classList.toggle(
      "map-paused",
      document.hidden || !!root.querySelector("dialog[open]"),
    );
    root.querySelector(".map-tools").hidden =
      root.querySelector(".field-footer").getBoundingClientRect().top <
      innerHeight;
    // Measure all gaps first; only composited transforms are written during scrolling.
    const links = connectors.map(({ el, fill }) => ({
      fill,
      progress:
        reading || reduced.matches || !content.theme.motion
          ? 1
          : timelineProgress(
              el.getBoundingClientRect().top,
              el.offsetHeight,
              innerHeight,
            ),
    }));
    for (const { fill, progress } of links)
      fill.style.transform = `scaleY(${progress})`;
    if (reading) return;
    const introRect = intro.getBoundingClientRect();
    const progress = overview
      ? 1
      : treeDescent(
          introRect.top,
          intro.offsetHeight + descent.offsetHeight,
          innerHeight,
        );
    // A single reversible native-scroll camera. Reading text stays outside the transform.
    if (!phone.matches && !reduced.matches && content.theme.motion)
      camera.style.transform = `translate(-50%,${-34 - 49 * progress}%) scale(${1.05 + 0.08 * Math.sin(progress * Math.PI)})`;
    document.body.classList.toggle("at-roots", progress > 0.88);
    root.querySelector(".scene-stage").textContent =
      progress > 0.88
        ? "03 / THE FARM"
        : progress > 0.36
          ? "02 / TRUNK"
          : "01 / CANOPY";
    const scene = root.querySelector(".map-scene").getBoundingClientRect();
    document.body.classList.toggle(
      "map-paused",
      document.hidden ||
        !!root.querySelector("dialog[open]") ||
        scene.bottom < 0 ||
        scene.top > innerHeight,
    );
    const stop = tourContent(content).stops.find((s) => s.id === active);
    const plane = root.querySelector(".farm-map-plane");
    if (phone.matches && !overview && stop)
      plane.style.transform = `translate(-${stop.mapX}%, -${stop.mapY}%)`;
    else plane.style.transform = "translate(-50%,-50%)";
    const dot = root.querySelector(".walking-dot");
    if (stop) {
      dot.style.left = stop.mapX + "%";
      dot.style.top = stop.mapY + "%";
    }
    if (overview) return;
    root.querySelectorAll(".map-chapter").forEach((ch) => {
      const rect = ch.getBoundingClientRect();
      if (rect.top < innerHeight * 0.42 && rect.bottom > innerHeight * 0.42) {
        const id =
          chapterSelection.get(ch.dataset.mapChapter) ||
          map.places.find((p) => p.chapter === ch.dataset.mapChapter)?.id;
        if (
          scrollingTo &&
          map.places.find((p) => p.id === scrollingTo)?.chapter !==
            ch.dataset.mapChapter
        )
          return;
        scrollingTo = null;
        if (id !== active)
          navigate(id, { historyMode: "replace", scroll: false });
      }
    });
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  listen(window, "scroll", schedule, { passive: true });
  listen(window, "resize", schedule, { passive: true });
  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      root.querySelectorAll("video").forEach((v) => v.pause());
    }
    schedule();
  });
  const hash = () => {
    const id = placeFromHash(location.hash, map.places);
    if (id) navigate(id, { historyMode: null });
    else if (location.hash === "#map-overview") showOverview(false);
    else if (location.hash === "#map-start" || !location.hash)
      root.querySelector("#map-start").scrollIntoView({ behavior: "instant" });
  };
  listen(window, "hashchange", hash);
  for (const event of ["wheel", "touchstart", "keydown"])
    listen(
      window,
      event,
      (event) => {
        if (root.querySelector("dialog[open]")) return;
        if (
          event.type === "keydown" &&
          ![
            "ArrowDown",
            "ArrowUp",
            "PageDown",
            "PageUp",
            "Home",
            "End",
            " ",
          ].includes(event.key)
        )
          return;
        scrollingTo = null;
        if (overview) {
          overview = false;
          root.querySelector(".map-narrative").inert = false;
          document.body.classList.remove("map-overview-mode");
          root.querySelector("[data-map-resume]").hidden = true;
          history.replaceState(null, "", "#" + active);
          schedule();
        }
      },
      { passive: true },
    );
  root.querySelectorAll("[data-map-place]").forEach((a) =>
    listen(a, "click", (e) => {
      e.preventDefault();
      navigate(a.dataset.mapPlace);
    }),
  );
  root.querySelectorAll(".map-follow").forEach((a) => {
    if (a.hash)
      listen(a, "click", (e) => {
        e.preventDefault();
        navigate(map.places[0]?.id);
      });
  });
  function showOverview(push = true) {
    if (reading) {
      root.querySelector("#map-start").scrollIntoView({ behavior: "instant" });
      return;
    }
    overview = true;
    root.querySelector(".map-narrative").inert = true;
    document.body.classList.add("map-overview-mode", "at-roots");
    root.querySelector("[data-map-resume]").hidden = false;
    root.querySelectorAll("video").forEach((v) => v.pause());
    if (push) {
      history.pushState(null, "", "#map-overview");
      root.querySelector("[data-map-resume]").focus({ preventScroll: true });
    }
    track("map.mode-changed", { section: "map", outcome: "overview" });
    schedule();
  }
  root.querySelectorAll("[data-map-overview]").forEach((a) =>
    listen(a, "click", (e) => {
      e.preventDefault();
      showOverview();
    }),
  );
  listen(root.querySelector("[data-map-resume]"), "click", () => {
    navigate(active);
    schedule();
  });
  listen(root.querySelector("#place-chooser"), "change", (e) =>
    navigate(e.target.value),
  );
  root.querySelectorAll("[data-map-previous],[data-map-next]").forEach((b) => {
    b.parentElement.hidden = reading;
    listen(b, "click", () =>
      navigate(
        adjacentPlace(
          map.places,
          active,
          b.hasAttribute("data-map-next") ? 1 : -1,
        ),
      ),
    );
  });
  const modeButton = root.querySelector("[data-reading]");
  modeButton.setAttribute("aria-pressed", String(reading));
  modeButton.textContent = reading ? "Immersive view" : "Reading view";
  listen(modeButton, "click", () => {
    reading = !reading;
    setPreference("aroha-map-view", reading ? "reading" : "immersive");
    track("map.mode-changed", {
      section: "map",
      outcome: reading ? "reading" : "immersive",
    });
    render();
    navigate(active, { historyMode: null, focus: false });
    root.querySelector("[data-reading]")?.focus({ preventScroll: true });
  });
  root.querySelectorAll("[data-film]").forEach((b) =>
    listen(b, "click", () => {
      const media = tourContent(content).media.find(
        (m) => m.id === b.dataset.film,
      );
      if (!media) return;
      root.querySelectorAll("video").forEach((v) => {
        v.pause();
        const f = v.closest("figure");
        f?.querySelector("img")?.removeAttribute("hidden");
        f?.querySelector("[data-film]")?.removeAttribute("hidden");
        v.remove();
      });
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.muted = true;
      v.preload = "none";
      v.poster = media.image;
      v.src = media.src;
      v.setAttribute("aria-label", media.name);
      const figure = b.closest("figure");
      figure.querySelector("img").hidden = true;
      figure.prepend(v);
      if (b.classList.contains("map-film-button")) b.hidden = true;
      v.addEventListener(
        "error",
        () => {
          v.remove();
          figure.querySelector("img").hidden = false;
          b.hidden = false;
          reportError("MAP_MEDIA_FAILED");
          track("map.fallback", { section: "map", outcome: "media-failed" });
        },
        { once: true },
      );
      v.play().catch(() => {});
    }),
  );
  const image = root.querySelector(".living-tree");
  listen(image, "error", () => {
    root.querySelector(".map-scene").classList.add("art-unavailable");
    reportError("MAP_ART_FAILED");
    track("map.fallback", { section: "map", outcome: "art-failed" });
  });
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (!entry.isIntersecting) entry.target.pause();
    },
    { threshold: 0.1 },
  );
  // Delegate playback observation so dynamically created films are included.
  listen(
    root,
    "play",
    (e) => {
      if (e.target.tagName === "VIDEO") {
        observer.observe(e.target);
        root.querySelectorAll("video").forEach((v) => {
          if (v !== e.target) v.pause();
        });
      }
    },
    true,
  );
  schedule();
  return () => {
    menu.destroy();
    guestAccount.destroy();
    guide?.destroy();
    removals.forEach((fn) => fn());
    cancelAnimationFrame(frame);
    observer.disconnect();
    root.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  };
}
render();
initializeMonitoring();
initializeAnalytics();
track("map.opened", {
  section: "map",
  outcome: reading ? "reading" : "immersive",
});
if (location.hash) {
  const openInitialPlace = () =>
    requestAnimationFrame(() => {
      const id = placeFromHash(location.hash, map.places);
      if (id) navigate(id, { historyMode: null });
    });
  if (document.readyState === "complete") openInitialPlace();
  else window.addEventListener("load", openInitialPlace, { once: true });
}
reduced.addEventListener("change", () => {
  if (reduced.matches) {
    reading = true;
    render();
  }
});
phone.addEventListener("change", () => render());
if (preview)
  window.addEventListener("message", (e) => {
    if (
      e.origin !== location.origin ||
      e.source !== parent ||
      e.data?.type !== "aroha-preview"
    )
      return;
    try {
      content = validateContent(e.data.content);
      render();
    } catch {
      reportError("INVALID_PREVIEW");
    }
  });
else watchContent();
function watchContent() {
  const generation = ++subscriptionGeneration;
  import("./firebase-public.mjs")
    .then(({ subscribeSite }) => {
      if (generation !== subscriptionGeneration) return;
      unsubscribe?.();
      unsubscribe = subscribeSite(
        (data) => {
          if (generation !== subscriptionGeneration) return;
          try {
            const next = validateContent(data.content);
            if (JSON.stringify(content) !== JSON.stringify(next)) {
              if (root.querySelector("dialog[open]")) {
                pendingContent = next;
                return;
              }
              content = next;
              render();
            }
          } catch {
            reportError("CONTENT_READ_FAILED");
          }
        },
        () => reportError("CONTENT_READ_FAILED"),
      );
    })
    .catch(() => reportError("CONTENT_READ_FAILED"));
}
window.addEventListener("pagehide", () => {
  subscriptionGeneration++;
  dispose();
  unsubscribe?.();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    render();
    if (!preview) watchContent();
  }
});
