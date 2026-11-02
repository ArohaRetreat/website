import { placePhoto } from "./place-photos.mjs";
import { atmospherePreference } from "./atmosphere.mjs";
import { createHrudhiGuide } from "./hrudhi-guide.mjs";
import { createGuestAccount } from "./guest-account.mjs";
import { initializeAnalytics } from "./analytics.mjs";
import { createLocationMap } from "./location-map.mjs";
import { createGateWelcome, hrudhiIntroduction } from "./hrudhi-gate.mjs";
import { createPublicMenu } from "./navigation.mjs";
import { openEnquiry, openPrivacy, openUpcoming } from "./guest-dialogs.mjs";
import { createAlbum } from "./album.mjs";
import { startWelcome } from "./welcome.mjs";
import { natureContent } from "./nature-render.mjs";
import initial from "./content.json";
import { renderSite, esc, picture, money } from "./render.mjs";
import { tourContent, renderFarmMap } from "./field-render.mjs";
import { createFieldJourney } from "./field-journey.mjs";
import { validateContent } from "../functions/domain.mjs";
import { track, initializeMonitoring, reportError } from "./monitoring.mjs";
let content = initial,
  lastFocus,
  menu,
  journey,
  gate,
  guestAccount,
  guide,
  locationMap,
  album,
  unsubscribe,
  pendingContent,
  subscriptionGeneration = 0;
const root = document.getElementById("site"),
  motion = matchMedia("(prefers-reduced-motion: reduce)"),
  preview = new URLSearchParams(location.search).has("preview");
let simple = motion.matches;
function render() {
  const y = scrollY;
  const albumState = album?.state;
  menu?.destroy();
  album?.destroy();
  journey?.destroy();
  gate?.destroy();
  guestAccount?.destroy();
  guide?.destroy();
  locationMap?.destroy();
  root.innerHTML = renderSite(content);
  for (const key of ["forest", "ivory", "leaf", "bronze"])
    document.documentElement.style.setProperty("--" + key, content.theme[key]);
  document.body.classList.toggle("simple", simple || !content.theme.motion);
  document.documentElement.dataset.routeMotion = simple || !content.theme.motion || motion.matches ? "off" : "on";
  document.title = content.seo.title;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", content.seo.description);
  if (preview) {
    const banner = document.createElement("div");
    banner.className = "preview-banner";
    banner.textContent = "Private draft preview — changes are not published";
    root.prepend(banner);
  }
  bind();
  menu = createPublicMenu(root, {
    motion: !simple && content.theme.motion && !motion.matches,
    onOpen: () => { lastFocus = root.querySelector("#public-menu-toggle"); },
    onClose: () => root.querySelector("#details-dialog")?.onclose?.(),
  });
  const discoverWithGuide = () => openTourStop(journey?.index ?? 0);
  guide = createHrudhiGuide(root,"tour",{meet:discoverWithGuide,motion:!simple && content.theme.motion});
  journey = createFieldJourney(
    root,
    content,
    { stop: openTourStop, walk: openWalk, track, error: reportError, guideProgress:p=>guide.follow(p), guide: (i,force=false)=>{const stops=tourContent(content).stops;guide.select(i,stops[i]?.name||"Aroha",stops.length,force);} },
    { simple: simple || !content.theme.motion },
  );
  gate = createGateWelcome(root, natureContent(tourContent(content)).hrudhi, {
    motion: !simple && content.theme.motion && !motion.matches,
    meet: () => {
      track("hrudhi.introduction.opened");
      show(hrudhiIntroduction(natureContent(tourContent(content)).hrudhi, { esc, picture }));
      root.querySelector("#hrudhi-continue").onclick = () => root.querySelector("#details-dialog").close();
    },
    track,
    enter: () => journey.go(0),
  });
  guestAccount = createGuestAccount(root,{show,close:()=>root.querySelector("#details-dialog").close(),closeMenu:()=>menu.whenClosed()});
  locationMap = createLocationMap(root);
  album = createAlbum(root, tourContent(content).media, {
    resume: albumState,
    motion: !simple && content.theme.motion && !motion.matches,
  });
  if (Math.abs(scrollY - y) > 1)
    window.scrollTo({ top: y, behavior: "instant" });
  root.dataset.ready = "true";
}
function show(markup) {
  if (!document.getElementById("details-dialog").open)
    lastFocus = document.activeElement;
  document.querySelectorAll("#dialog-content video").forEach((v) => v.pause());
  document.getElementById("dialog-content").innerHTML = markup;
  document.getElementById("details-dialog").showModal();
  document.querySelector(".dialog-close").focus({ preventScroll: true });
}
function openCottage(id) {
  const x = content.cottages.find((x) => x.id === id);
  if (!x) return;
  track("cottage.opened", { section: x.id });
  show(
    `${picture(x.image, x.imageAlt, "dialog-photo")}<div class="dialog-copy"><p class="eyebrow">YOUR QUIET CORNER</p><h2 id="dialog-title">${esc(x.name)}</h2><p>${esc(x.description)}</p><p>${esc(x.detail)}</p>${x.images.length ? `<div class="interior-gallery">${x.images.map((src) => picture(src, x.name + " interior")).join("")}</div>` : ""}<button class="button" id="cottage-enquire">Enquire about a stay <span aria-hidden="true">↗</span></button></div>`,
  );
  document.getElementById("cottage-enquire").onclick = () => enquire("", id);
}
function openFarmExperience(id) {
  const item =
    content.experiences.find((x) => x.id === id) || content.experiences[0];
  const photo =
    id === "animals" ? "/assets/retreat/DSC_3823.webp" : content.intro.image;
  show(
    `${picture(photo, id === "animals" ? "Farm animals at Aroha" : content.intro.imageAlt, "dialog-photo")}<div class="dialog-copy"><p class="eyebrow">${esc(content.brand.tagline)}</p><h2 id="dialog-title">${esc(item.name)}</h2><p>${esc(item.description)}</p><button class="button" id="experience-enquire">${esc(content.visit.enquiryLabel)} ↗</button></div>`,
  );
  document.getElementById("experience-enquire").onclick = () => enquire();
}
function enquire(packageId = "", cottageId = "") {
  openEnquiry(content, show, packageId, cottageId);
}

function openTourStop(index) {
  const t = tourContent(content),
    s = t.stops[index];
  if (!s) return;
  const photo = placePhoto(s,atmospherePreference());
  const media = t.media.filter((m) => m.stop === s.id),
    ids = media.map((m) => m.id);
  show(
    `<article class="field-stop-dialog">${picture(photo.image, photo.imageAlt, "stop-dialog-photo")}<p class="stop-dialog-caption">${esc(photo.imageAlt)}</p><div class="dialog-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${esc(s.name)}</p><h2 id="dialog-title">${esc(s.title)}</h2><p>${esc(s.detail)}</p>${media.length ? `<div class="stop-media-grid">${media.map((m) => `<button data-stop-media="${esc(m.id)}" aria-label="${m.kind === "video" ? "Watch" : "View"}: ${esc(m.name)}">${picture(m.image, m.name)}<span>${m.kind === "video" ? "▷ Film" : "View ↗"}</span></button>`).join("")}</div>` : ""}<button class="button" id="stop-enquire">${esc(content.visit.enquiryLabel)} ↗</button><button class="field-text-link" id="stop-section">${s.target === "cottages" ? "Explore accommodation" : s.target === "packages" ? "Compare visits" : "Discover more"} ↗</button><div class="stop-nearby"><span>Continue exploring</span>${s.nearby
      .map((id) => {
        const next = t.stops.find((x) => x.id === id);
        return next
          ? `<button data-nearby="${esc(id)}">${esc(next.name)} ↗</button>`
          : "";
      })
      .join("")}</div></div></article>`,
  );
  root
    .querySelectorAll("[data-stop-media]")
    .forEach(
      (b) => (b.onclick = () => openMedia(b.dataset.stopMedia, ids, index)),
    );
  root.querySelector("#stop-enquire").onclick = () => enquire();
  root.querySelector("#stop-section").onclick = () => {
    root.querySelector("#details-dialog").close();
    requestAnimationFrame(() =>
      root
        .querySelector("#" + s.target)
        ?.scrollIntoView({ behavior: motion.matches ? "instant" : "smooth" }),
    );
  };
  root.querySelectorAll("[data-nearby]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = t.stops.findIndex((x) => x.id === b.dataset.nearby);
        openTourStop(i);
      }),
  );
}
function openWalk(index, part = 0) {
  const t = tourContent(content),
    s = t.stops[index],
    steps = s?.walk,
    step = steps?.[part],
    m = t.media.find((m) => m.id === step?.film);
  if (!m) return;
  show(
    `<article class="walk-dialog"><video controls autoplay muted playsinline preload="metadata" poster="${esc(m.image)}" src="${esc(m.src)}" aria-label="${esc(step.name)}"></video><div class="walk-caption"><p class="eyebrow">A WALK INSIDE / ${esc(s.name)}</p><h2 id="dialog-title">${esc(step.name)}</h2><nav aria-label="Room walkthrough">${steps.map((x, i) => `<button data-walk-step="${i}" ${i === part ? 'aria-current="step"' : ""}><span>0${i + 1}</span>${esc(x.name)}</button>`).join("")}</nav><button class="field-light-link" id="walk-continue">${part < steps.length - 1 ? esc(steps[part + 1].name) + " →" : "Return to the farm ↗"}</button></div></article>`,
  );
  root
    .querySelectorAll("[data-walk-step]")
    .forEach(
      (b) => (b.onclick = () => openWalk(index, Number(b.dataset.walkStep))),
    );
  root.querySelector("#walk-continue").onclick = () =>
    part < steps.length - 1
      ? openWalk(index, part + 1)
      : root.querySelector("#details-dialog").close();
}
function openMedia(id, scope, returnStop) {
  const t = tourContent(content),
    ids = scope || t.media.map((m) => m.id),
    i = ids.indexOf(id),
    m = t.media.find((m) => m.id === id);
  if (!m) return;
  show(
    `<article class="field-media-dialog">${m.kind === "video" ? `<video controls playsinline muted autoplay preload="metadata" poster="${esc(m.image)}" src="${esc(m.src)}" aria-label="${esc(m.name)}"></video>` : picture(m.image, m.name)}<div><h2 id="dialog-title">${esc(m.name)}</h2><p>${esc(m.description)}</p><div class="media-dialog-navigation"><button id="media-previous" aria-label="Previous moment">← Previous</button><span>${i + 1} / ${ids.length}</span><button id="media-next" aria-label="Next moment">Next →</button></div>${returnStop !== undefined ? '<button class="field-light-link" id="media-back">Back to this place ↗</button>' : ""}</div></article>`,
  );
  root.querySelector("#media-previous").onclick = () =>
    openMedia(ids[(i - 1 + ids.length) % ids.length], ids, returnStop);
  root.querySelector("#media-next").onclick = () =>
    openMedia(ids[(i + 1) % ids.length], ids, returnStop);
  if (returnStop !== undefined)
    root.querySelector("#media-back").onclick = () => openTourStop(returnStop);
  track("gallery.opened", { section: m.stop });
}
function openMap() {
  show(renderFarmMap(content, esc));
  root.querySelectorAll("[data-map-stop]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.mapStop);
        root.querySelector("#details-dialog").close();
        requestAnimationFrame(() => journey?.go(i));
      }),
  );
}
function bind() {
  root.querySelectorAll("[data-coming-soon]").forEach(b=>b.onclick=()=>openUpcoming(content,show,b.dataset.comingSoon));
  root
    .querySelectorAll("[data-cottage]")
    .forEach((b) => (b.onclick = () => openCottage(b.dataset.cottage)));
  root
    .querySelectorAll("[data-enquire]")
    .forEach((b) => (b.onclick = () => enquire(b.dataset.enquire)));
  root
    .querySelectorAll("[data-farm-map]")
    .forEach((b) => (b.onclick = openMap));
  root
    .querySelectorAll("[data-media]")
    .forEach((b) => (b.onclick = () => openMedia(b.dataset.media, album?.ids)));
  root.querySelector("#start-journey").onclick = (e) => {
    track("journey.started");
    if (root.querySelector("#journey")) {
      e.preventDefault();
      root.querySelector("#journey").scrollIntoView({ behavior: simple || !content.theme.motion ? "instant" : "smooth" });
    }
  };
  const dialog = root.querySelector("#details-dialog");
  root.querySelector(".dialog-close").onclick = () => dialog.close();
  dialog.onclose = () => {
    root.querySelectorAll("#dialog-content video").forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    if (pendingContent) {
      const id = lastFocus?.id;
      const attribute = [
        "data-media",
        "data-cottage",
        "data-enquire",
        "data-farm-map",
      ].find((key) => lastFocus?.hasAttribute(key));
      const value = attribute ? lastFocus.getAttribute(attribute) : null;
      content = pendingContent;
      pendingContent = null;
      render();
      if (attribute === "data-media") album?.reveal?.(value);
      if (id)
        root
          .querySelector("#" + CSS.escape(id))
          ?.focus({ preventScroll: true });
      else if (attribute)
        root
          .querySelector(`[${attribute}="${CSS.escape(value)}"]`)
          ?.focus({ preventScroll: true });
    } else if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  };
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  };
  root.querySelector("#privacy-settings").onclick = () => openPrivacy(show);
}
render();
// The gate's sticky travel is added during enhancement. Resolve a fresh deep
// link against the final geometry; restored/reloaded documents keep native scroll.
if (location.hash && performance.getEntriesByType("navigation")[0]?.type === "navigate") {
  try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant" }); } catch { /* Malformed fragments stay native. */ }
}
const finishWelcome = startWelcome(root, natureContent(tourContent(content)), {
  enabled: !simple && content.theme.motion && !preview && !document.documentElement.dataset.routeArrival,
});
window.addEventListener("aroha:route-arrival", finishWelcome, { once: true });
initializeMonitoring();
initializeAnalytics();
motion.addEventListener("change", (e) => {
  if (e.matches) {
    finishWelcome();
  }
  simple = e.matches;
  render();
});
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
async function watchContent() {
  const generation = ++subscriptionGeneration;
  unsubscribe?.();
  // Public controls become interactive before loading the optional live-data SDK.
  let subscribeSite;
  try {
    ({ subscribeSite } = await import("./firebase-public.mjs"));
  } catch {
    reportError("CONTENT_READ_FAILED");
    return;
  }
  if (generation !== subscriptionGeneration) return;
  unsubscribe = subscribeSite(
    (data) => {
      try {
        const next = validateContent(data.content);
        if (JSON.stringify(next) === JSON.stringify(content)) return;
        if (root.querySelector("dialog[open]")) {
          pendingContent = next;
          return;
        }
        content = next;
        render();
      } catch {
        reportError("INVALID_PUBLISHED_CONTENT");
      }
    },
    () => reportError("CONTENT_READ_FAILED"),
  );
}
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    // pagehide disposed motion/media; a restored document needs fresh controllers.
    render();
    if (!preview) watchContent();
  }
});
window.addEventListener("pagehide", () => {
  subscriptionGeneration++;
  menu?.destroy();
  finishWelcome();
  unsubscribe?.();
  journey?.destroy();
  gate?.destroy();
  guestAccount?.destroy();
  guide?.destroy();
  locationMap?.destroy();
  album?.destroy();
});
