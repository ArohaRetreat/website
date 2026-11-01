import { renderAlbum } from "./album.mjs";
import {
  natureContent,
  heroGarden,
  natureStory,
  orbitGallery,
  heroTitle,
  heroEvening,
  heroMoments,
} from "./nature-render.mjs";
import defaultTour from "./tour-content.json" with { type: "json" };
export function tourContent(c) {
  if (c.tour) return c.tour;
  // Preserve gallery additions made with the original studio during migration.
  const known = new Set(defaultTour.media.map((m) => m.image));
  const extra = (c.gallery || [])
    .filter((m) => !known.has(m.image))
    .map((m, i) => ({
      id: "legacy-" + i,
      kind: "photo",
      name: m.imageAlt,
      description: m.imageAlt,
      image: m.image,
      src: "",
      stop: "farm",
    }));
  return extra.length
    ? { ...defaultTour, media: [...defaultTour.media, ...extra] }
    : defaultTour;
}
const arrow = '<span aria-hidden="true">↗</span>';
export function renderFieldSite(c, { esc, lines, picture, money }) {
  const tour = tourContent(c),
    hero = c.hero,
    nature = natureContent(tour);
  const sections = new Map(
    c.sections.filter((x) => x.visible).map((x) => [x.id, x]),
  );
  const title = (id) => {
    const s = sections.get(id);
    return `<div class="field-heading"><p class="eyebrow">${esc(s.eyebrow)}</p><h2>${lines(s.title)}</h2></div>`;
  };
  const content = {
    journey: () =>
      !tour.stops.length
        ? `<section class="field-section" id="journey"><h2>${esc(tour.title)}</h2><p>${esc(tour.description)}</p></section>`
        : `<section class="field-tour-section" id="journey" aria-label="Walk through Aroha"><div class="field-tour-stage"><div class="tour-visual" id="tour-visual">${picture(tour.stops[0]?.image || hero.image, tour.stops[0]?.imageAlt || hero.imageAlt, "tour-scene-image", false)}</div><div class="tour-film-frame" hidden><video id="tour-film" muted playsinline loop preload="none" aria-label="Silent film of this part of the farm"></video><span class="film-caption">MOVING MOMENTS / AROHA</span></div><div class="tour-vignette" aria-hidden="true"></div>${orbitGallery(tour, { esc, picture })}<div class="tour-top"><div><span class="eyebrow">${esc(tour.eyebrow)}</span><button class="tour-view-toggle" data-simple-view>Simple view</button></div><button class="tour-map-button" data-farm-map>Explore the farm map <span aria-hidden="true">⌁</span></button></div><div class="tour-reading"><p class="eyebrow" id="tour-index">01 / ${String(tour.stops.length).padStart(2, "0")} — ${esc(tour.stops[0]?.name || "Aroha")}</p><h2 id="tour-title">${esc(tour.stops[0]?.title || tour.title)}</h2><p id="tour-description">${esc(tour.stops[0]?.description || tour.description)}</p><p class="tour-context" id="tour-context">${esc(tour.stops[0]?.detail || "")}</p><div class="tour-reading-actions"><button id="tour-walk" class="field-light-link" hidden>Step inside <span aria-hidden="true">↗</span></button><button id="tour-discover" class="field-light-link">Discover this place ${arrow}</button><button id="tour-play" class="tour-play" aria-pressed="false">Pause film <span aria-hidden="true">Ⅱ</span></button></div></div><div class="tour-location-card"><span class="eyebrow">YOU ARE HERE</span><strong id="tour-place-name">${esc(tour.stops[0]?.name || "Aroha")}</strong><svg class="tour-mini-map" viewBox="0 0 100 100" aria-hidden="true"><path d="M48 90 C45 78 35 74 46 66 S62 60 48 52 S62 43 55 29 S40 20 48 13"/><path class="map-branch" d="M46 80L81 82M48 52L32 51M48 52L40 60M55 47L68 43M48 20L22 22"/>${tour.stops
            .filter((s) => s.onMap !== false)
            .map(
              (s, i) =>
                `<circle data-mini-stop="${i}" cx="${s.mapX}" cy="${s.mapY}" r="1.5"/>`,
            )
            .join(
              "",
            )}<circle class="map-current" id="tour-map-dot" cx="48" cy="90" r="3"/></svg><button class="field-light-link" data-farm-map>See the route ${arrow}</button></div><nav class="tour-stop-nav" aria-label="Tour destinations">${tour.stops.map((s, i) => `<button data-tour-stop="${i}" ${i === 0 ? 'aria-current="step"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${esc(s.name)}</button>`).join("")}</nav><div class="tour-bottom"><button id="tour-previous" aria-label="Previous place">←</button><span id="tour-instruction">SCROLL TO WANDER</span><button id="tour-next" aria-label="Next place">↓</button></div><div class="tour-progress" aria-hidden="true"><span></span></div><div class="tour-threshold" aria-hidden="true"><div><span lang="kn">${esc(c.brand.kannada)}</span></div><div><span>Come on in.</span></div></div><span class="sr-only" id="tour-status" role="status" aria-live="polite"></span></div></section>`,
    cottages: () =>
      `<section class="field-section field-stays" id="cottages">${title("cottages")}<div class="field-stay-grid">${c.cottages.map((x, i) => `<article><button class="field-stay-photo" data-cottage="${esc(x.id)}">${picture(x.image, x.imageAlt)}<span>Explore the stay ${arrow}</span></button><div class="field-card-heading"><span class="field-number">0${i + 1}</span><h3>${esc(x.name)}</h3></div><p>${esc(x.description)}</p><button class="field-text-link" data-cottage="${esc(x.id)}">Inside your quiet corner ${arrow}</button></article>`).join("")}</div><div class="field-aside-note"><span lang="kn">${esc(c.brand.kannada)}</span><p>Private rooms. Personal welcomes.<br>Let your hosts help you choose.</p><button class="field-text-link" data-enquire="">Find your stay ${arrow}</button></div></section>`,
    experiences: () =>
      `<section class="field-section field-experiences" id="experiences">${title("experiences")}<div class="field-experience-layout"><div class="field-experience-photo">${picture("/assets/retreat/DSC_3823.webp", "Oxen and a bullock cart at Aroha")}<span>${esc(c.brand.tagline)}</span></div><div class="field-experience-list">${c.experiences.map((x, i) => `<details ${i === 0 ? "open" : ""} name="field-experiences"><summary><span class="field-number">0${i + 1}</span><h3>${esc(x.name)}</h3><span aria-hidden="true">+</span></summary><p>${esc(x.description)}</p></details>`).join("")}</div></div></section>`,
    packages: () =>
      `<section class="field-section field-packages" id="packages">${title("packages")}<div class="field-package-grid">${c.packages.map((p, i) => `<article><p class="eyebrow">0${i + 1} / ${esc(p.subtitle)}</p><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="field-price"><strong>${money(p.price)}</strong><span>${esc(p.unit)}<br>starting from</span></div><ul>${p.inclusions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><details><summary>Children & group visits <span aria-hidden="true">+</span></summary><p>${esc(p.note)}</p></details><button class="button" data-enquire="${esc(p.id)}">Enquire about this visit ${arrow}</button></article>`).join("")}</div><p class="field-price-note">${esc(c.visit.priceNote)}</p></section>`,
    gallery: () =>
      `<section class="field-section field-journal" id="gallery">${title("gallery")}${renderAlbum(tour, { esc, picture })}</section>`,
    visit: () =>
      `<section class="field-section field-visit" id="visit">${title("visit")}<div class="field-visit-grid"><div><p class="field-visit-lede">${esc(c.visit.description)}</p><button class="button" data-enquire="">${esc(c.visit.enquiryLabel)} ${arrow}</button><a class="field-text-link" href="${esc(c.visit.mapUrl)}" target="_blank" rel="noopener noreferrer">Find your way ${arrow}</a><p class="field-visit-policy">${esc(c.visit.note)}</p><a href="tel:+${esc(c.visit.phone)}">+${esc(c.visit.phone)}</a><br><a href="mailto:${esc(c.visit.email)}">${esc(c.visit.email)}</a></div><div class="field-faqs">${c.faqs.map((x) => `<details><summary>${esc(x.question)}<span aria-hidden="true">+</span></summary><p>${esc(x.answer)}</p></details>`).join("")}</div></div></section>`,
  };
  return `<a class="skip-link" href="#main">Skip to content</a><header class="field-header"><a href="#home" class="field-brand" aria-label="${esc(c.brand.name)} home"><img src="/assets/brand/logo-white.svg" width="190" height="65" alt="${esc(c.brand.name)}"></a><nav aria-label="Main navigation">${[
    ["journey", "The farm"],
    ["cottages", "Stay"],
    ["experiences", "Experience"],
    ["packages", "Visit"],
  ]
    .filter(([id]) => sections.has(id))
    .map(([id, label]) => `<a href="#${id}">${label}</a>`)
    .join(
      "",
    )}</nav><div><button id="view-toggle" aria-pressed="false">Simple view</button><button class="field-header-enquire" data-enquire="">Plan a visit ${arrow}</button></div></header><main id="main"><section id="home" class="field-hero"><div class="field-hero-visual hero-day">${picture(hero.image, hero.imageAlt, "", true, hero.mobileImage)}</div>${heroEvening(nature, esc)}<div class="field-hero-shade" aria-hidden="true"></div>${heroGarden(c, nature, { esc, picture })}<div class="field-hero-content"><p class="eyebrow">${esc(hero.eyebrow)}</p><h1>${heroTitle(hero.title, esc)}</h1><p>${esc(hero.description)}</p><a href="${sections.has("journey") ? "#journey" : "#intro"}" id="start-journey" class="field-enter"><span class="enter-orbit" aria-hidden="true">↗</span>${esc(hero.primaryLabel)}</a></div>${heroMoments(nature)}<div class="field-hero-foot"><span lang="kn">${esc(c.brand.welcomeKannada)}</span><span>${esc(c.brand.tagline)}</span><a href="#intro">SCROLL TO SLOW DOWN <span aria-hidden="true">↓</span></a></div></section><section id="intro" class="field-section field-intro"><div><p class="eyebrow">${esc(c.intro.eyebrow)}</p><span lang="kn">${esc(c.brand.kannada)}</span>${picture(c.intro.image, c.intro.imageAlt, "field-intro-photo")}</div><h2>${lines(c.intro.title)}</h2><div class="field-intro-copy"><p>${esc(c.intro.description)}</p><span>${esc(c.brand.welcome)}</span></div></section>${natureStory(nature, { esc, lines, picture })}${c.sections
    .filter((x) => x.visible)
    .map((x) => content[x.id]?.() || "")
    .join(
      "",
    )}</main><footer class="field-footer"><div>${picture("/assets/retreat/DSC_3779.webp", "The main house glowing after sunset")}<div class="field-footer-shade"></div></div><p class="eyebrow">${esc(c.brand.tagline)}</p><h2>${lines(c.brand.welcome.replace(", ", ",\n"))}</h2><button class="field-enter" data-enquire=""><span class="enter-orbit" aria-hidden="true">↗</span>${esc(c.visit.enquiryLabel)}</button><span lang="kn">${esc(c.brand.welcomeKannada)}</span><div class="field-footer-bottom"><a href="/admin/">Host login</a><span>© ${new Date().getFullYear()} ${esc(c.brand.name)}</span><button id="privacy-settings">Privacy & monitoring</button></div></footer><dialog id="details-dialog" class="details-dialog" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="Close details">×</button><div id="dialog-content"></div></dialog><div class="toast" role="status" hidden></div>`;
}
export function renderFarmMap(c, esc) {
  const t = tourContent(c);
  return `<div class="farm-map-dialog"><p class="eyebrow">${esc(t.eyebrow)}</p><h2 id="dialog-title">One farm.<br>Make it your own.</h2><div class="farm-map-layout"><div class="farm-map-canvas"><svg viewBox="0 0 100 100" role="img" aria-label="Indicative walking route from the gate past the pond, house and cottages to the meditation hall"><path class="map-lawn" d="M6 38Q19 28 33 42L35 85Q12 96 6 78Z"/><path class="map-water" d="M60 61Q88 57 90 72Q92 87 64 84Q57 76 60 61Z"/><path class="map-grove" d="M28 9Q67 0 86 24Q92 43 76 50Q69 29 55 29Q38 33 28 9Z"/><path class="map-road" d="M48 94 C45 78 35 74 46 66 S62 60 48 52 S62 43 55 29 S40 20 48 13"/><path class="map-road map-side" d="M46 80L81 82M48 52L32 51M48 52L40 60M55 47L68 43M48 20L22 22"/><text x="70" y="73">POND</text><text x="13" y="57">LAWN</text><text x="68" y="16">PALMS</text></svg>${t.stops.map((s, i) => (s.onMap === false ? "" : `<button data-map-stop="${i}" style="left:${s.mapX}%;top:${s.mapY}%" aria-label="Go to ${esc(s.name)}"><span>${String(i + 1).padStart(2, "0")}</span></button>`)).join("")}</div><nav aria-label="Farm route">${t.stops.map((s, i) => (s.onMap === false ? "" : `<button data-map-stop="${i}"><span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(s.name)}</strong><span aria-hidden="true">↗</span></button>`)).join("")}</nav></div><p class="farm-map-note">${esc(t.mapNote)}</p></div>`;
}
