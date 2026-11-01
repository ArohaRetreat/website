import { createAlbum } from "./album.mjs";
import { startWelcome } from "./welcome.mjs";
import { natureContent } from "./nature-render.mjs";
import initial from "./content.json";
import { preference, setPreference } from "./preferences.mjs";
import { renderSite, esc, picture, money } from "./render.mjs";
import { tourContent, renderFarmMap } from "./field-render.mjs";
import { createFieldJourney } from "./field-journey.mjs";
import { validateContent, enquiryText } from "../functions/domain.mjs";
import { track, initializeMonitoring, reportError } from "./monitoring.mjs";
let content = initial,
  lastFocus,
  journey,
  album,
  unsubscribe,
  pendingContent,
  subscriptionGeneration = 0;
const root = document.getElementById("site"),
  motion = matchMedia("(prefers-reduced-motion: reduce)"),
  preview = new URLSearchParams(location.search).has("preview");
let simple = motion.matches || preference("aroha-view") === "simple";
function render() {
  const y = scrollY;
  const albumState = album?.state;
  album?.destroy();
  journey?.destroy();
  root.innerHTML = renderSite(content);
  for (const key of ["forest", "ivory", "leaf", "bronze"])
    document.documentElement.style.setProperty("--" + key, content.theme[key]);
  document.body.classList.toggle("simple", simple || !content.theme.motion);
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
  journey = createFieldJourney(
    root,
    content,
    { stop: openTourStop, walk: openWalk, track, error: reportError },
    { simple: simple || !content.theme.motion },
  );
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
  show(
    `<div class="dialog-copy"><p class="eyebrow">LET’S PLAN YOUR VISIT</p><h2 id="dialog-title">A conversation comes first.</h2><p>Tell your hosts a little about your visit. They will personally confirm availability and the details.</p><form class="enquiry-form"><label>How would you like to visit?<select name="package" required><option value="">Choose a package</option>${content.packages.map((p) => `<option value="${esc(p.id)}" ${p.id === packageId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Guests<input name="guests" type="number" min="1" max="100" value="2" required></label><label>Visit / check-in date<input name="checkin" type="date" min="${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}" required></label><label data-overnight>Check-out date<input name="checkout" type="date"></label><label data-overnight class="full">Preferred cottage<select name="cottage"><option value="">Please advise</option>${content.cottages.map((x) => `<option value="${esc(x.id)}" ${x.id === cottageId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Your name<input name="name" autocomplete="name" maxlength="100" required></label><label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label class="full">Anything you would like us to know? <small>(optional)</small><textarea name="message" rows="3" maxlength="1000"></textarea></label><p class="full form-note">Your details will be included in a WhatsApp message. You review and send it there. This does not reserve a room, confirm a booking or make a payment.</p><p class="full form-error" role="alert" hidden></p><button class="button full" type="submit">Continue to WhatsApp <span aria-hidden="true">↗</span></button></form></div>`,
  );
  const form = document.querySelector(".enquiry-form"),
    select = form.elements.package;
  function change() {
    const overnight =
      content.packages.find((p) => p.id === select.value)?.overnight ?? false;
    form
      .querySelectorAll("[data-overnight]")
      .forEach((el) => (el.hidden = !overnight));
    form.elements.checkout.required = overnight;
  }
  select.onchange = change;
  change();
  form.elements.checkin.onchange = () => {
    form.elements.checkout.min = form.elements.checkin.value;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      const text = enquiryText(content, data);
      const url =
        "https://wa.me/" +
        content.visit.phone +
        "?text=" +
        encodeURIComponent(text);
      track("enquiry.prepared", { section: data.package, outcome: "prepared" });
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (error) {
      const box = form.querySelector(".form-error");
      box.hidden = false;
      box.textContent =
        {
          CHOOSE_PACKAGE: "Choose a package.",
          CHOOSE_DATE: "Choose a visit date.",
          INVALID_CHECKOUT: "Choose a check-out date after check-in.",
          CONTACT_DETAILS_REQUIRED: "Enter your name and a valid phone number.",
        }[error.message] || "Please check your visit details.";
    }
  };
}

function openTourStop(index) {
  const t = tourContent(content),
    s = t.stops[index];
  if (!s) return;
  const media = t.media.filter((m) => m.stop === s.id),
    ids = media.map((m) => m.id);
  show(
    `<article class="field-stop-dialog">${picture(s.image, s.imageAlt, "stop-dialog-photo")}<p class="stop-dialog-caption">${esc(s.imageAlt)}</p><div class="dialog-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${esc(s.name)}</p><h2 id="dialog-title">${esc(s.title)}</h2><p>${esc(s.detail)}</p>${media.length ? `<div class="stop-media-grid">${media.map((m) => `<button data-stop-media="${esc(m.id)}" aria-label="${m.kind === "video" ? "Watch" : "View"}: ${esc(m.name)}">${picture(m.image, m.name)}<span>${m.kind === "video" ? "▷ Film" : "View ↗"}</span></button>`).join("")}</div>` : ""}<button class="button" id="stop-enquire">${esc(content.visit.enquiryLabel)} ↗</button><button class="field-text-link" id="stop-section">${s.target === "cottages" ? "Explore accommodation" : s.target === "packages" ? "Compare visits" : "Discover more"} ↗</button><div class="stop-nearby"><span>Continue exploring</span>${s.nearby
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
  const toggle = root.querySelector("#view-toggle");
  toggle.textContent = simple ? "Journey view" : "Simple view";
  toggle.setAttribute("aria-pressed", String(simple));
  toggle.hidden = !content.theme.motion;
  toggle.onclick = () => {
    const el = root.querySelector("#journey"),
      r = el?.getBoundingClientRect(),
      inTour = r && r.top <= 120 && r.bottom > 120,
      index = journey?.index || 0;
    simple = !simple;
    setPreference("aroha-view", simple ? "simple" : "journey");
    render();
    if (inTour) journey.go(index);
    root.querySelector("#view-toggle").focus({ preventScroll: true });
  };
  root
    .querySelectorAll("[data-simple-view]")
    .forEach((b) => (b.onclick = toggle.onclick));
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
      journey.go(0);
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
  root.querySelector("#privacy-settings").onclick = () => {
    show(
      '<div class="dialog-copy"><h2 id="dialog-title">Privacy & monitoring</h2><p>Optional Dynatrace monitoring helps us understand page performance and errors. Enquiry messages, names and phone numbers are excluded. Google Analytics and session replay are not enabled.</p><p>You can use the site without optional monitoring. Essential Google sign-in is used only in the host portal.</p><button class="button" id="allow-monitoring">Allow monitoring</button> <button class="text-link" id="deny-monitoring">Decline / withdraw</button></div>',
    );
    root.querySelector("#allow-monitoring").onclick = () => {
      setPreference("aroha-monitoring", "allowed");
      initializeMonitoring();
      dialog.close();
    };
    root.querySelector("#deny-monitoring").onclick = () => {
      setPreference("aroha-monitoring", "denied");
      location.reload();
    };
  };
}
render();
const finishWelcome = startWelcome(root, natureContent(tourContent(content)), {
  enabled: !simple && content.theme.motion && !preview,
});
initializeMonitoring();
motion.addEventListener("change", (e) => {
  if (e.matches) {
    finishWelcome();
    simple = true;
    render();
  }
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
    ({ subscribeSite } = await import("./firebase.mjs"));
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
        if (root.querySelector("#details-dialog")?.open) {
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
  finishWelcome();
  unsubscribe?.();
  journey?.destroy();
  album?.destroy();
});
